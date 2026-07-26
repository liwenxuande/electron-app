# AI 对话模块 UX 改进设计规格

> 日期：2026-07-26 | 状态：已确认

## 一、背景

当前 AI 对话模块存在以下体验缺陷：
- 用户无法手动停止正在进行的对话（AI 思考中或流式输出中只能干等）
- 工具调用过程对用户不可见，只有一个简陋的"思考中..."三个点，用户不知道 AI 在做什么
- 发生错误时没有重试按钮，用户需要手动重新输入
- 手写的 Markdown 渲染器不支持完整语法，维护成本高
- AIView.vue 自行维护 `sessionCacheMap`，与已有的 `aiSessionStore`（Pinia）重复

## 二、需求清单

| # | 需求 | 决定 |
|---|------|------|
| 1 | 手动停止对话 | 保留已输出内容，末尾追加"用户已手动停止"标记 |
| 2 | 工具调用过程可见 | 展示"正在调用 xxx 工具..."状态 + 改进加载动画 |
| 3 | 输入框 | 保持单行 `<input>`，不改为 textarea |
| 4 | 错误重试 | 错误消息旁提供"重试"按钮 |
| 5 | 欢迎页推荐问题 | 不改动 |

## 三、架构调整

### 3.1 分层职责

```
AIView.vue (视图层)
  ├── 使用 aiSessionStore (数据层)
  │     ├── sessions[]        — 会话列表
  │     ├── currentSessionId  — 当前会话
  │     ├── 增删改查方法      — 调用 window.aiAPI
  │     └── messages[]        — 当前会话的消息列表（含 tool-status 角色）
  │
  ├── 本地响应式状态（仅视图）
  │     ├── streamingText      — 正在流式输出的文本
  │     ├── isStreaming        — 是否正在接收
  │     ├── isThinking         — 是否在工具调用中
  │     ├── currentToolName    — 正在执行的工具名
  │     ├── errorMsg           — 错误信息
  │     └── sending            — 发送锁
  │
  └── IPC 监听 (onMounted/onUnmounted)
        ├── ai:chat:chunk       — 流式文本块（已有）
        ├── ai:chat:done        — 完成（已有）
        ├── ai:chat:error       — 错误（已有）
        ├── ai:chat:tool-start  — 工具调用开始（新增）
        └── ai:chat:tool-end    — 工具调用结束（新增）
```

### 3.2 消息类型扩展

`ChatMessage` 新增 `tool-status` 角色，用于前端展示工具调用状态条：

```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'tool-status' | 'system'
  content: string
  // tool-status 专用字段
  toolName?: string   // 工具名（如 'get_monthly_summary'）
  toolDone?: boolean  // 工具是否已执行完成
}
```

tool-status 消息不持久化到数据库，仅在当前会话生命周期内临时展示。

## 四、停止机制

### 4.1 后端 HTTP 层（deepseekClient.ts）

`postJSON` 和 `postStream` 增加可选的 `AbortSignal` 参数：

```typescript
function postJSON(path, body, apiKey, signal?: AbortSignal) {
  return new Promise((resolve, reject) => {
    const req = https.request({...})
    signal?.addEventListener('abort', () => req.destroy())
    // ...
  })
}
```

`postStream` 同理。`DeepSeekClient.chatWithTools` 和 `DeepSeekClient.chatStream` 透传 `signal`。

### 4.2 后端对话编排层（aiAnalysisService.ts）

`chat()` 方法增加 `AbortSignal` 参数：

- 每轮 tool calling 循环前检查 `signal?.aborted`
- 如果已中断，将已收集的 tool 结果和当前 partial 文本拼接返回
- 返回值增加 `stopped: boolean` 标记

```typescript
interface ChatResult {
  text: string
  stopped: boolean
}

async chat(
  historyMessages: ChatMessage[],
  onChunk: (text: string) => void,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<ChatResult>
```

### 4.3 后端 IPC 层（aiController.ts）

维护 `Map<string, AbortController>`（key=sessionId）：

```typescript
const abortControllers = new Map<string, AbortController>()

// ai:chat handler
ipcMain.handle('ai:chat', async (event, { messages, ledgerId, sessionId }) => {
  const controller = new AbortController()
  abortControllers.set(sessionId, controller)
  try {
    const result = await service.chat(messages, onChunk, sessionId, controller.signal)
    // ...
  } finally {
    abortControllers.delete(sessionId)
  }
})

// ai:chat:cancel handler
ipcMain.handle('ai:chat:cancel', async (_event, sessionId) => {
  const controller = abortControllers.get(sessionId)
  controller?.abort()
})
```

### 4.4 前端 IPC（preload/index.ts）

新增：
- `invoke('ai:chat:cancel', sessionId)` → `cancelChat(sessionId)`
- Window 类型声明 `window.aiAPI.cancelChat(sessionId: string): Promise<void>`

### 4.5 前端交互（AIView.vue）

发送后输入框右侧按钮切换为停止按钮：

```
[输入框_______________________] [■]   ← 停止按钮（方形 stop 图标）
```

停止按钮在 `isStreaming || isThinking` 时显示，点击调用 `window.aiAPI.cancelChat(sessionId)`。

停止后行为：
- `streamingText` 末尾追加 `\n\n---\n⚠️ 用户已手动停止`
- 将该消息（含停止标记）作为 assistant 消息持久化到数据库
- 发送锁 `sending` 释放

## 五、工具调用状态 + 加载动画

### 5.1 工具名中文映射

```typescript
const TOOL_LABELS: Record<string, string> = {
  get_current_time: '获取当前时间',
  get_monthly_summary: '查询月度收支',
  get_category_breakdown: '分析分类排行',
  get_daily_trend: '查看每日走势',
  get_top_entries: '查看交易明细',
  compare_months: '对比月度数据',
}
```

### 5.2 后端事件推送（aiController.ts）

在 `chat()` 方法内的 tool calling 循环中，工具调用前后推送：

```typescript
// 工具调用前
win.webContents.send('ai:chat:tool-start', {
  sessionId,
  toolName: tc.function.name,
})

// 工具调用后
win.webContents.send('ai:chat:tool-end', {
  sessionId,
  toolName: tc.function.name,
})
```

### 5.3 前端展示（AIView.vue）

收到 `tool-start` 时，在消息列表插入 `tool-status` 消息（`toolDone: false`），显示动画图标 + 中文描述。

收到 `tool-end` 时，更新对应 `tool-status` 消息的 `toolDone: true`，动画变为静态完成图标。

```
┌──────────────────────────────────────────┐
│ 🔄 正在：查询月度收支...                    │  ← 动画（工具执行中）
│ ✅ 查询月度收支 完成                        │  ← 静态（工具完成）
└──────────────────────────────────────────┘
```

所有工具调用完成后，在 AI 开始流式输出时（收到第一个 `ai:chat:chunk` 事件），移除所有 tool-status 消息，让对话记录保持干净。

### 5.4 加载动画改进

替换现有三个点"思考中..."为 CSS 脉冲动画：

```html
<span class="ai-thinking">
  <span class="ai-thinking-dot"></span>
  <span>AI 正在思考...</span>
</span>
```

```css
.ai-thinking-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #FF8C00;
  animation: ai-pulse 1.2s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.5); opacity: 1; }
}
```

## 六、错误重试

### 6.1 前端交互

错误消息区域新增"重试"按钮：

```
┌──────────────────────────────────────────┐
│ 用户：这个月花了多少钱                         │
├──────────────────────────────────────────┤
│ ❌ 请求超时，请检查网络后重试                    │
│ [🔄 重试]                                  │
└──────────────────────────────────────────┘
```

```typescript
function handleRetry() {
  const lastUserMsg = messages.value
    .filter(m => m.role === 'user')
    .pop()
  if (!lastUserMsg) return
  errorMsg.value = ''
  // 不动 messages 数组，直接用原内容重新发送
  // 调用 handleSend(lastUserMsg.content) 或直接 invoke ai:chat
}
```

重试时不新增 user 消息，复用原来的 user 消息内容重新发起 `ai:chat`。成功后新建 assistant 消息。

## 七、Markdown 渲染替换

### 7.1 引入 marked

```bash
npm install marked
```

### 7.2 配置

```typescript
import { marked } from 'marked'

const renderer = new marked.Renderer()
renderer.html = () => ''  // 禁止原始 HTML，防 XSS

marked.setOptions({
  renderer,
  breaks: true,   // 单个换行也转 <br>
  gfm: true,      // GitHub Flavored Markdown
})

function renderContent(text: string): string {
  if (!text) return ''
  return marked.parse(text) as string
}
```

### 7.3 移除

删除 `AIView.vue` 中现有的自写 `renderContent()` 函数（约 50 行）。

## 八、涉及文件

| 文件 | 改动类型 | 改动内容 |
|------|----------|----------|
| `src/renderer/src/views/AIView.vue` | 重写 | 使用 aiSessionStore；停止按钮；工具状态条；新动画；重试按钮；marked 渲染 |
| `src/renderer/src/stores/aiSessionStore.ts` | 增强 | 增加 messages[] 管理；增加 tool call 状态方法 |
| `src/preload/index.ts` | 新增 | `cancelChat` IPC 通道；`tool-start/tool-end` 事件监听 |
| `src/preload/index.d.ts` | 新增 | `cancelChat` 和事件回调类型声明 |
| `src/main/controller/aiController.ts` | 增强 | AbortController 映射；`ai:chat:cancel` handler；tool-start/tool-end 推送 |
| `src/main/service/ai/aiAnalysisService.ts` | 增强 | `chat()` 增加 AbortSignal 参数，返回 stopped 标记 |
| `src/main/service/ai/deepseekClient.ts` | 增强 | `postJSON`/`postStream` 增加 AbortSignal 参数 |

## 九、不涉及

- 不修改欢迎页推荐问题
- 不修改输入框（保持单行 `<input>`）
- 不修改 AI 工具定义（`getToolDefs`）
- 不修改系统提示词（`SYSTEM_PROMPT`）
- 不修改 `aiConfigService`、`aiDatabase`
