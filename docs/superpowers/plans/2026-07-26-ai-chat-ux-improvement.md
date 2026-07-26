# AI 对话模块 UX 改进 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 AI 对话模块添加停止机制、工具调用状态展示、错误重试、改进加载动画，并用 marked 替换手写 Markdown 渲染器，同时将 AIView.vue 整合到 aiSessionStore。

**架构：** 后端通过 AbortController 支持请求中断，通过 IPC push 事件通知前端工具调用状态；前端 AIView.vue 改用 Pinia aiSessionStore 管理数据，增加 stop 按钮、工具状态条、重试按钮和脉冲动画。

**技术栈：** Electron IPC + Vue 3 + Pinia + TypeScript + marked + CSS animation

**规格文档：** `docs/superpowers/specs/2026-07-26-ai-chat-ux-improvement-design.md`

---

### 任务 1：后端 — 安装 marked 依赖

**文件：**
- 执行：`npm install marked`

- [ ] **步骤 1：安装 marked**

```bash
npm install marked
```

- [ ] **步骤 2：验证安装**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

预期：无 TypeScript 错误。

- [ ] **步骤 3：Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add marked dependency for AI markdown rendering"
```

---

### 任务 2：后端 — deepseekClient.ts 增加 AbortSignal 支持

**文件：**
- 修改：`src/main/service/ai/deepseekClient.ts:44-79`（postJSON）
- 修改：`src/main/service/ai/deepseekClient.ts:81-144`（postStream）
- 修改：`src/main/service/ai/deepseekClient.ts:155-176`（chat）
- 修改：`src/main/service/ai/deepseekClient.ts:178-202`（chatStream）
- 修改：`src/main/service/ai/deepseekClient.ts:204-256`（chatWithTools）

- [ ] **步骤 1：`postJSON` 增加 `signal` 参数**

将第 44 行 `function postJSON(path: string, body: Record<string, unknown>, apiKey: string): Promise<unknown>` 改为：

```typescript
function postJSON(
  path: string,
  body: Record<string, unknown>,
  apiKey: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = https.request({
      hostname: BASE_URL,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            const err = json as { error?: { message?: string } }
            reject(new Error(err.error?.message || `HTTP ${res.statusCode}`))
          } else {
            resolve(json)
          }
        } catch {
          reject(new Error(`解析响应失败: ${data.slice(0, 200)}`))
        }
      })
    })
    signal?.addEventListener('abort', () => req.destroy())
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(payload)
    req.end()
  })
}
```

关键改动：在第 74 行 `req.on('error', reject)` 之前插入 `signal?.addEventListener('abort', () => req.destroy())`。

- [ ] **步骤 2：`postStream` 增加 `signal` 参数**

将第 81 行函数签名改为：

```typescript
export function postStream(
  path: string,
  body: Record<string, unknown>,
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
```

在第 139 行 `req.on('error', reject)` 之前插入：

```typescript
signal?.addEventListener('abort', () => req.destroy())
```

- [ ] **步骤 3：`chat` 方法透传 `signal`**

将第 155 行签名改为：

```typescript
async chat(
  messages: ChatMessage[],
  temperature = 0.3,
  ctx: AILogContext = { requestId: newRequestId() },
  signal?: AbortSignal,
): Promise<string> {
```

第 161-165 行 `postJSON` 调用增加第四个参数：

```typescript
const res = await postJSON('/v1/chat/completions', {
  model: this.model,
  messages,
  temperature,
}, this.apiKey, signal) as { ... }
```

- [ ] **步骤 4：`chatStream` 方法透传 `signal`**

将第 178 行签名改为：

```typescript
chatStream(
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  temperature = 0.3,
  ctx: AILogContext = { requestId: newRequestId() },
  signal?: AbortSignal,
): Promise<string> {
```

第 188-193 行 `postStream` 调用增加第五个参数：

```typescript
return postStream('/v1/chat/completions', {
  model: this.model,
  messages,
  temperature,
  stream: true,
}, this.apiKey, onChunk, signal).then(...)
```

- [ ] **步骤 5：`chatWithTools` 方法透传 `signal`**

将第 204 行签名改为：

```typescript
async chatWithTools(
  messages: ChatMessage[],
  tools: ToolDef[],
  temperature = 0.3,
  ctx: AILogContext = { requestId: newRequestId() },
  signal?: AbortSignal,
): Promise<{
  finishReason: string
  content: string | null
  toolCalls: ToolCall[]
}> {
```

第 219-224 行 `postJSON` 调用增加第四个参数：

```typescript
const res = await postJSON('/v1/chat/completions', {
  model: this.model,
  messages,
  tools,
  temperature,
}, this.apiKey, signal) as { ... }
```

- [ ] **步骤 6：运行 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

预期：无错误。

- [ ] **步骤 7：Commit**

```bash
git add src/main/service/ai/deepseekClient.ts
git commit -m "feat: add AbortSignal support to deepseekClient for chat cancellation"
```

---

### 任务 3：后端 — aiAnalysisService.ts 支持中断和 stopped 标记

**文件：**
- 修改：`src/main/service/ai/aiAnalysisService.ts:6`（SYSTEM_PROMPT 不变）
- 修改：`src/main/service/ai/aiAnalysisService.ts:54-82`（chat 方法签名和行为）

- [ ] **步骤 1：定义 ChatResult 接口**

在 `aiAnalysisService.ts` 第 5 行（`import` 语句之后、`const SYSTEM_PROMPT` 之前）添加：

```typescript
export interface ChatResult {
  text: string
  stopped: boolean
}
```

- [ ] **步骤 2：修改 `chat()` 方法签名和逻辑**

将第 54 行 `async chat(...)` 签名的返回类型改为 `Promise<ChatResult>`，增加 `signal` 参数：

```typescript
async chat(
  historyMessages: ChatMessage[],
  onChunk: (text: string) => void,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<ChatResult> {
  const c = this.client()
  if (!c) throw new Error('未配置 API Key')
  const requestId = newRequestId()
  const baseCtx: AILogContext = { requestId, sessionId, ledgerId: this.ledgerId }

  const toolService = new AIToolService(this.ledgerId)
  const tools = toolService.getToolDefs()
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...historyMessages]

  let round = 0
  while (round < MAX_TOOL_ROUNDS) {
    if (signal?.aborted) {
      // 被中断，用当前 messages 做最后一次流式输出
      const partialResult = await c.chatStream([...messages], onChunk, 0.3, { ...baseCtx, round }, signal)
      return { text: partialResult, stopped: true }
    }
    round++
    const ctx: AILogContext = { ...baseCtx, round }
    const res = await c.chatWithTools(messages, tools, 0.3, ctx, signal)

    if (res.finishReason !== 'tool_calls' || res.toolCalls.length === 0) {
      const finalResult = await c.chatStream([...messages], onChunk, 0.3, ctx, signal)
      return { text: finalResult, stopped: false }
    }

    messages.push({ role: 'assistant', content: null, tool_calls: res.toolCalls })
    const toolResults = toolService.handleToolCalls(res.toolCalls, ctx)
    messages.push(...toolResults)
  }

  const finalResult = await c.chatStream([...messages], onChunk, 0.3, { ...baseCtx, round }, signal)
  return { text: finalResult, stopped: false }
}
```

关键改动：
- 返回类型 `Promise<string>` → `Promise<ChatResult>`
- 参数增加 `signal?: AbortSignal`
- 第 68、72、89 行的 `c.chatWithTools`、`c.chatStream` 调用增加 `signal` 参数
- 每轮循环前检查 `signal?.aborted`

- [ ] **步骤 3：运行 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

预期：无错误。

- [ ] **步骤 4：Commit**

```bash
git add src/main/service/ai/aiAnalysisService.ts
git commit -m "feat: add AbortSignal and ChatResult support to chat method"
```

---

### 任务 4：后端 — aiController.ts 增加取消和工具状态推送

**文件：**
- 修改：`src/main/controller/aiController.ts:50-94`（ai:chat handler）
- 新增：`ai:chat:cancel` handler
- 新增：tool-start/tool-end 事件推送

- [ ] **步骤 1：添加 AbortController 映射和取消 handler**

在 `registerAIController` 函数开头（第 19 行之后）添加：

```typescript
const abortControllers = new Map<string, AbortController>()
```

在 `ai:config:test` handler（第 48 行）之后、`ai:chat` handler 之前添加：

```typescript
ipcMain.handle('ai:chat:cancel', async (_event, sessionId: string) => {
  const controller = abortControllers.get(sessionId)
  if (controller) {
    controller.abort()
    abortControllers.delete(sessionId)
  }
  return { code: 0, data: null, msg: 'ok' }
})
```

- [ ] **步骤 2：重写 `ai:chat` handler 支持中断和工具状态推送**

将第 50-94 行 `ai:chat` handler 替换为：

```typescript
ipcMain.handle('ai:chat', async (event, params: { messages: ChatMessage[]; ledgerId: number; sessionId?: string }) => {
  const { messages, ledgerId, sessionId: inputSid } = params
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return { code: -1, data: null, msg: '窗口未找到' }

  let sid = inputSid || ''
  try {
    if (!sid) {
      const s = createSession(ledgerId)
      sid = s.session_id
    } else if (!sessionExists(sid)) {
      return { code: -1, data: null, msg: '会话不存在' }
    }

    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'user' && lastMsg.content) {
      appendMessage(sid, 'user', lastMsg.content)
    }

    if (getMessageCount(sid) <= 2) {
      const title = (lastMsg?.content || '').slice(0, 30) || '新对话'
      updateSessionTitle(sid, title)
    }

    const controller = new AbortController()
    abortControllers.set(sid, controller)

    const service = new AIAnalysisService(ledgerId)
    const recentMsgs = getRecentMessages(sid).map((r) => ({
      role: r.role as 'user' | 'assistant' | 'system',
      content: r.content,
    }))

    const result = await service.chat(
      recentMsgs,
      (chunk: string) => {
        win.webContents.send('ai:chat:chunk', { sessionId: sid, chunk })
      },
      sid,
      controller.signal,
      (toolName, phase) => {
        win.webContents.send('ai:chat:tool-status', { sessionId: sid, toolName, phase })
      },
    )

    abortControllers.delete(sid)

    if (result.stopped) {
      const stoppedContent = result.text + '\n\n---\n⚠️ 用户已手动停止'
      appendMessage(sid, 'assistant', stoppedContent)
      win.webContents.send('ai:chat:done', { sessionId: sid, result: stoppedContent })
      return { code: 0, data: { sessionId: sid }, msg: 'ok' }
    }

    if (result.text) {
      appendMessage(sid, 'assistant', result.text)
    }

    win.webContents.send('ai:chat:done', { sessionId: sid, result: result.text })
    return { code: 0, data: { sessionId: sid }, msg: 'ok' }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`AI 对话失败: ${msg}`)
    abortControllers.delete(sid)
    win.webContents.send('ai:chat:error', { sessionId: sid, error: msg })
    return { code: -1, data: null, msg }
  }
})
```

- [ ] **步骤 3：在 aiAnalysisService.chat() 中添加工具状态回调**

修改 [aiAnalysisService.ts](file:///f:/project/pc_app/electron-01/src/main/service/ai/aiAnalysisService.ts) 的 `chat` 方法，增加 `onToolCall` 回调参数。

将第 54 行签名改为：

```typescript
async chat(
  historyMessages: ChatMessage[],
  onChunk: (text: string) => void,
  sessionId?: string,
  signal?: AbortSignal,
  onToolCall?: (toolName: string, phase: 'start' | 'end') => void,
): Promise<ChatResult> {
```

在 tool calling 循环中（`messages.push({ role: 'assistant', ... })` 之后），工具调用前后调用回调：

```typescript
const toolResults = toolService.handleToolCalls(res.toolCalls, ctx)
// 推送工具状态
res.toolCalls.forEach(tc => onToolCall?.(tc.function.name, 'start'))
messages.push(...toolResults)
res.toolCalls.forEach(tc => onToolCall?.(tc.function.name, 'end'))
```

然后在 `aiController.ts` 的 `ai:chat` handler 中传入 `onToolCall`：

```typescript
const result = await service.chat(recentMsgs, (chunk: string) => {
  win.webContents.send('ai:chat:chunk', { sessionId: sid, chunk })
}, sid, controller.signal, (toolName, phase) => {
  win.webContents.send('ai:chat:tool-status', { sessionId: sid, toolName, phase })
})
```

- [ ] **步骤 4：运行 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

预期：无错误。

- [ ] **步骤 5：Commit**

```bash
git add src/main/controller/aiController.ts src/main/service/ai/aiAnalysisService.ts
git commit -m "feat: add chat cancel IPC and tool status push events"
```

---

### 任务 5：IPC — preload 增加新通道

**文件：**
- 修改：`src/preload/index.ts:130-133`（chat 方法签名适配）
- 新增：`src/preload/index.ts` 中 `cancelChat` 和事件监听
- 修改：`src/preload/index.d.ts:140-160`（AIAPI 类型）

- [ ] **步骤 1：preload/index.ts — 添加 cancelChat 和 tool 事件**

在 `aiAPI` 对象中（第 130 行 `chat` 定义之后）添加：

```typescript
cancelChat: (sessionId: string) =>
  ipcRenderer.invoke('ai:chat:cancel', sessionId),
```

在 `onChatError`（第 151-153 行）之后添加：

```typescript
onToolStatus: (cb: (data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) => void) => {
  ipcRenderer.on('ai:chat:tool-status', (_event, data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) => cb(data))
},
```

在 `removeAllListeners`（第 163-170 行）中增加一行：

```typescript
ipcRenderer.removeAllListeners('ai:chat:tool-status')
```

- [ ] **步骤 2：preload/index.d.ts — 添加类型声明**

在 `AIAPI` interface（第 153-156 行附近）添加：

```typescript
cancelChat(sessionId: string): Promise<ApiResponse<null>>
onToolStatus(cb: (data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) => void): void
```

- [ ] **步骤 3：Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: add cancelChat and onToolStatus IPC channels"
```

---

### 任务 6：前端 — aiSessionStore 增强

**文件：**
- 修改：`src/renderer/src/stores/aiSessionStore.ts`

- [ ] **步骤 1：添加消息管理到 Store**

将 `aiSessionStore.ts` 完整替换为：

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SessionItem {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  recordCount: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool-status'
  content: string
  timestamp: number
  // tool-status 专用
  toolName?: string
  toolDone?: boolean
}

export const useAISessionStore = defineStore('aiSession', () => {
  const sessions = ref<SessionItem[]>([])
  const currentSessionId = ref<string | null>(null)
  const loading = ref(false)
  const messages = ref<ChatMessage[]>([])

  function genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  }

  function setMessages(msgs: ChatMessage[]) {
    messages.value = msgs
  }

  function addUserMessage(content: string) {
    const msg: ChatMessage = { id: genId(), role: 'user', content, timestamp: Date.now() }
    messages.value = [...messages.value, msg]
    return msg
  }

  function addAssistantMessage(content: string) {
    const msg: ChatMessage = { id: genId(), role: 'assistant', content, timestamp: Date.now() }
    messages.value = [...messages.value, msg]
    return msg
  }

  function addToolStatus(toolName: string) {
    const msg: ChatMessage = {
      id: genId(),
      role: 'tool-status',
      content: '',
      timestamp: Date.now(),
      toolName,
      toolDone: false,
    }
    messages.value = [...messages.value, msg]
    return msg
  }

  function markToolDone(toolName: string) {
    const idx = messages.value.findIndex(m => m.role === 'tool-status' && m.toolName === toolName && !m.toolDone)
    if (idx !== -1) {
      const updated = [...messages.value]
      updated[idx] = { ...updated[idx], toolDone: true }
      messages.value = updated
    }
  }

  function clearToolStatuses() {
    messages.value = messages.value.filter(m => m.role !== 'tool-status')
  }

  function clearMessages() {
    messages.value = []
  }

  async function fetchSessions() {
    try {
      const res = await window.aiAPI.listSessions()
      if (res.code === 0 && res.data) {
        sessions.value = res.data
      }
    } catch { /* ignore */ }
  }

  async function createSession(ledgerId: number): Promise<string | null> {
    try {
      const res = await window.aiAPI.createSession(ledgerId)
      if (res.code === 0) {
        await fetchSessions()
        const sid = res.data?.sessionId || null
        if (sid) currentSessionId.value = sid
        return sid
      }
    } catch { /* ignore */ }
    return null
  }

  async function switchSession(sessionId: string) {
    currentSessionId.value = sessionId
    loading.value = true
    try {
      const res = await window.aiAPI.getHistory({ sessionId })
      if (res.code === 0 && res.data) {
        messages.value = res.data.map((r: { id: string; role: string; content: string; timestamp: number }) => ({
          ...r,
          role: r.role as 'user' | 'assistant',
        } as ChatMessage))
      }
    } catch { /* ignore */ }
    loading.value = false
  }

  async function deleteSession(sessionId: string) {
    try {
      await window.aiAPI.deleteSession(sessionId)
      sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = null
        messages.value = []
      }
    } catch { /* ignore */ }
  }

  async function init(ledgerId: number) {
    await fetchSessions()
    if (sessions.value.length > 0) {
      await switchSession(sessions.value[0].sessionId)
    } else {
      await createSession(ledgerId)
    }
  }

  function formatTime(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const time = `${hh}:${mm}`
    if (isToday) return time
    if (isYesterday) return `昨天 ${time}`
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const DD = String(d.getDate()).padStart(2, '0')
    if (d.getFullYear() === now.getFullYear()) return `${MM}-${DD} ${time}`
    return `${d.getFullYear()}-${MM}-${DD} ${time}`
  }

  return {
    sessions,
    currentSessionId,
    loading,
    messages,
    setMessages,
    addUserMessage,
    addAssistantMessage,
    addToolStatus,
    markToolDone,
    clearToolStatuses,
    clearMessages,
    fetchSessions,
    createSession,
    switchSession,
    deleteSession,
    init,
    formatTime,
  }
})
```

- [ ] **步骤 2：运行 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/stores/aiSessionStore.ts
git commit -m "feat: enhance aiSessionStore with messages and tool status management"
```

---

### 任务 7：前端 — AIView.vue 重构

**文件：**
- 修改：`src/renderer/src/views/AIView.vue`（完整重写）

这是最大的任务。将 AIView.vue 改写为使用 `aiSessionStore`，并整合所有 UX 改进。

- [ ] **步骤 1：重写 `<template>` 部分**

将 `AIView.vue` 的第 1-93 行（template）替换为：

```html
<template>
  <div class="ai-layout">
    <aside class="ai-sidebar">
      <div class="ai-sidebar-top">
        <button class="ai-new-btn" @click="handleNewSession">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>新对话</span>
        </button>
      </div>
      <div class="ai-session-list">
        <div
          v-for="s in store.sessions"
          :key="s.sessionId"
          :class="['ai-session-item', { active: store.currentSessionId === s.sessionId }]"
          @click="handleSwitch(s.sessionId)"
        >
          <div class="ai-session-title">{{ s.title }}</div>
          <div class="ai-session-meta">
            <span class="ai-session-time">{{ store.formatTime(s.updatedAt) }}</span>
          </div>
          <button class="ai-session-del" title="删除" @click.stop="handleDelete(s.sessionId)">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
        <div v-if="store.sessions.length === 0" class="ai-no-sessions">暂无对话记录</div>
      </div>
    </aside>

    <div class="ai-main">
      <div class="ai-main-body" ref="bodyRef">
        <div v-if="store.messages.length === 0 && !isStreaming && !isThinking" class="ai-welcome">
          <div class="ai-welcome-logo">🤖</div>
          <p class="ai-welcome-text">有什么可以帮你的？</p>
          <p class="ai-welcome-hint">你可以问我收支情况、消费分析、省钱建议</p>
          <div class="ai-suggestions">
            <button v-for="q in suggestions" :key="q" class="ai-suggestion-btn" @click="handleSuggest(q)">{{ q }}</button>
          </div>
        </div>

        <template v-for="(msg, idx) in store.messages" :key="msg.id">
          <div v-if="showTimestamp(idx)" class="ai-time-divider">
            <span>{{ formatDateTime(msg.timestamp) }}</span>
          </div>

          <!-- tool-status 消息 -->
          <div v-if="msg.role === 'tool-status'" class="ai-tool-status">
            <span v-if="!msg.toolDone" class="ai-tool-spinner"></span>
            <span v-else class="ai-tool-done">&#10003;</span>
            <span class="ai-tool-label">{{ TOOL_LABELS[msg.toolName || ''] || msg.toolName }}</span>
            <span class="ai-tool-phase">{{ msg.toolDone ? '完成' : '中...' }}</span>
          </div>

          <!-- 用户/AI 消息 -->
          <div v-else :class="['ai-msg', msg.role === 'user' ? 'ai-msg--user' : 'ai-msg--assistant']">
            <div class="ai-msg-avatar">
              <svg v-if="msg.role === 'user'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              </svg>
            </div>
            <div class="ai-msg-content" v-html="renderContent(msg.content)"></div>
          </div>
        </template>

        <!-- 流式输出 -->
        <div v-if="isStreaming" class="ai-msg ai-msg--assistant">
          <div class="ai-msg-avatar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div class="ai-msg-content" v-html="renderContent(streamingText || '')"></div>
        </div>

        <!-- 思考中状态 -->
        <div v-if="isThinking && !isStreaming" class="ai-msg ai-msg--assistant">
          <div class="ai-msg-avatar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div class="ai-msg-content ai-thinking-msg">
            <span class="ai-thinking">
              <span class="ai-thinking-dot"></span>
              <span>AI 正在思考...</span>
            </span>
          </div>
        </div>

        <!-- 错误 + 重试 -->
        <div v-if="errorMsg" class="ai-error">
          <span>&#10060; {{ errorMsg }}</span>
          <button class="ai-retry-btn" @click="handleRetry">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>重试</span>
          </button>
        </div>
      </div>

      <div class="ai-main-footer">
        <input
          v-model="inputText"
          class="ai-input"
          placeholder="输入你的问题..."
          maxlength="500"
          :disabled="sending"
          @keyup.enter="handleSend"
        />
        <button
          v-if="isStreaming || isThinking"
          class="ai-stop-btn"
          title="停止生成"
          @click="handleStop"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
        </button>
        <button
          v-else
          class="ai-send-btn"
          :disabled="!inputText.trim()"
          @click="handleSend"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **步骤 2：重写 `<script setup>` 部分**

将第 95-407 行（script 部分）替换为：

```typescript
<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useLedgerStore } from '../stores/ledgerStore'
import { useAISessionStore } from '../stores/aiSessionStore'
import { marked } from 'marked'

const TOOL_LABELS: Record<string, string> = {
  get_current_time: '获取当前时间',
  get_monthly_summary: '查询月度收支',
  get_category_breakdown: '分析分类排行',
  get_daily_trend: '查看每日走势',
  get_top_entries: '查看交易明细',
  compare_months: '对比月度数据',
}

const ledgerStore = useLedgerStore()
const store = useAISessionStore()
const bodyRef = ref<HTMLElement>()
const inputText = ref('')
const isStreaming = ref(false)
const streamingText = ref('')
const isThinking = ref(false)
const errorMsg = ref('')
const sending = ref(false)

const suggestions = [
  '这个月花最多的是哪个分类？',
  '帮我分析一下本月消费趋势',
  '有什么省钱建议？',
  '上月和这月支出对比有什么变化？',
]

// marked 配置
const renderer = new marked.Renderer()
renderer.html = () => ''

marked.setOptions({
  renderer,
  breaks: true,
  gfm: true,
})

function renderContent(text: string): string {
  if (!text) return ''
  return marked.parse(text) as string
}

function scrollToBottom() {
  nextTick(() => {
    const el = bodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function showTimestamp(idx: number): boolean {
  if (idx === 0) return true
  const msgs = store.messages
  if (!msgs[idx] || !msgs[idx - 1]) return false
  const gap = msgs[idx].timestamp - msgs[idx - 1].timestamp
  return gap > 5 * 60 * 1000
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  return `${MM}-${DD} ${hh}:${mm}`
}

async function handleSuggest(text: string) {
  inputText.value = text
  await handleSend()
}

async function handleNewSession() {
  const sid = await store.createSession(ledgerStore.currentId)
  if (sid) {
    store.clearToolStatuses()
  }
}

async function handleSwitch(sessionId: string) {
  isStreaming.value = false
  streamingText.value = ''
  errorMsg.value = ''
  await store.switchSession(sessionId)
  scrollToBottom()
}

async function handleDelete(sessionId: string) {
  await store.deleteSession(sessionId)
}

async function handleSend() {
  const text = inputText.value.trim()
  inputText.value = ''
  if (!text || sending.value) return

  let sid = store.currentSessionId
  if (!sid) {
    sid = await store.createSession(ledgerStore.currentId)
    if (!sid) return
  }

  store.addUserMessage(text)
  sending.value = true
  isStreaming.value = false
  streamingText.value = ''
  isThinking.value = true
  errorMsg.value = ''
  scrollToBottom()

  try {
    await window.aiAPI.chat({
      messages: [{ role: 'user', content: text }],
      ledgerId: ledgerStore.currentId,
      sessionId: sid,
    })
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '请求失败'
    isThinking.value = false
    isStreaming.value = false
    sending.value = false
  }
}

async function handleStop() {
  const sid = store.currentSessionId
  if (!sid) return
  await window.aiAPI.cancelChat(sid)
}

async function handleRetry() {
  if (store.messages.length === 0) return
  const lastUserMsg = [...store.messages].reverse().find(m => m.role === 'user')
  if (!lastUserMsg) return

  errorMsg.value = ''
  sending.value = true
  isThinking.value = true
  isStreaming.value = false
  streamingText.value = ''

  try {
    await window.aiAPI.chat({
      messages: [{ role: 'user', content: lastUserMsg.content }],
      ledgerId: ledgerStore.currentId,
      sessionId: store.currentSessionId || undefined,
    })
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '请求失败'
    isThinking.value = false
    sending.value = false
  }
}

// IPC 事件监听
function onChunk(data: { sessionId: string; chunk: string }) {
  if (data.sessionId !== store.currentSessionId) return
  isThinking.value = false
  isStreaming.value = true
  streamingText.value += data.chunk
  // 第一个 chunk 时清除 tool status
  if (store.messages.some(m => m.role === 'tool-status')) {
    store.clearToolStatuses()
  }
  scrollToBottom()
}

function onDone(data: { sessionId: string; result: string }) {
  if (data.sessionId !== store.currentSessionId) return
  if (streamingText.value) {
    store.addAssistantMessage(streamingText.value)
  }
  isStreaming.value = false
  streamingText.value = ''
  isThinking.value = false
  sending.value = false
  errorMsg.value = ''
  store.clearToolStatuses()
  store.fetchSessions()
  scrollToBottom()
}

function onError(data: { sessionId: string; error: string }) {
  if (data.sessionId !== store.currentSessionId) return
  errorMsg.value = data.error
  isStreaming.value = false
  streamingText.value = ''
  isThinking.value = false
  sending.value = false
  store.clearToolStatuses()
}

function onToolStatus(data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) {
  if (data.sessionId !== store.currentSessionId) return
  if (data.phase === 'start') {
    isThinking.value = true
    store.addToolStatus(data.toolName)
  } else {
    store.markToolDone(data.toolName)
  }
}

let listenersRegistered = false
function ensureListeners() {
  if (listenersRegistered) return
  listenersRegistered = true
  window.aiAPI.onChatChunk(onChunk)
  window.aiAPI.onChatDone(onDone)
  window.aiAPI.onChatError(onError)
  window.aiAPI.onToolStatus(onToolStatus)
}

ensureListeners()

onMounted(async () => {
  await store.init(ledgerStore.currentId)
  scrollToBottom()
})
</script>
```

- [ ] **步骤 3：替换 `<style>` 部分**

在原 style 基础上追加以下新样式（在 `</style>` 之前）：

```css
/* 工具调用状态条 */
.ai-tool-status {
  display: flex; align-items: center; gap: 6px;
  width: 100%; max-width: 720px; padding: 0 32px; box-sizing: border-box;
  font-size: 0.75rem; color: #6B7280;
}

.ai-tool-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid #E5E7EB; border-top-color: #FF8C00; border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
}

@keyframes ai-spin { to { transform: rotate(360deg); } }

.ai-tool-done { color: #10B981; font-size: 0.875rem; }

.ai-tool-label { color: #374151; }

.ai-tool-phase { color: #9CA3AF; }

/* 思考动画 */
.ai-thinking { display: flex; align-items: center; gap: 6px; }

.ai-thinking-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; background: #FF8C00;
  animation: ai-pulse 1.2s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.5); opacity: 1; }
}

.ai-thinking-msg { min-height: 36px; display: flex; align-items: center; }

/* 停止按钮 */
.ai-stop-btn {
  width: 42px; height: 42px; border-radius: 12px; border: none;
  background: #EF4444; color: #fff; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: background-color 0.15s;
  flex-shrink: 0;
}
.ai-stop-btn:hover { background: #DC2626; }

/* 重试按钮 */
.ai-error { display: flex; align-items: center; gap: 10px; }
.ai-retry-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 12px; border-radius: 6px; border: 1px solid #EF4444;
  background: transparent; color: #EF4444; font-size: 0.75rem;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
  white-space: nowrap;
}
.ai-retry-btn:hover { background: rgba(239,68,68,0.08); }
```

注意：保留原 style 中所有其他 CSS 规则，只追加以上内容。同时将原 `.ai-error` 的 `max-width`s 改为不限制：

```css
.ai-error { padding: 10px 14px; border-radius: 8px; background: rgba(239,68,68,0.08); color: #EF4444; font-size: 0.8125rem; max-width: 720px; width: 100%; margin: 0 auto; }
```

改为（添加 `display: flex; align-items: center; gap: 10px;` 并保持原有属性）：

```css
.ai-error { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; background: rgba(239,68,68,0.08); color: #EF4444; font-size: 0.8125rem; max-width: 720px; width: 100%; margin: 0 auto; }
```

- [ ] **步骤 4：运行 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

- [ ] **步骤 5：Commit**

```bash
git add src/renderer/src/views/AIView.vue
git commit -m "feat: refactor AIView with stop button, tool status, retry, marked, and store integration"
```