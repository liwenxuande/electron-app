# MCP Server 设计规格

> 日期：2026-07-27 | 状态：已确认
> 
> 为个人记账应用增加 Stdio MCP 服务，使外部 AI 应用（如 TraeWork）可以通过标准 MCP 协议查询和操作账单数据。

## 一、背景

当前个人记账应用通过 IPC 通道（`ipcMain.handle`）向渲染进程暴露业务能力，外部 AI 应用无法直接访问。需要基于现有 Service 层封装一套 MCP 服务，类似 Obsidian 的 MCP 插件，让外部 AI 通过标准协议操控本软件数据。

### 核心约束

- 不修改现有 Service/Repository/Controller 层
- 零外部 npm 依赖（HTTP server 使用 Node 内置 `http` 模块，MCP agent 使用 Node 内置 `http` 模块）
- 仅监听 `127.0.0.1`，不暴露给局域网
- 同步复用现有 `ApiResponse<T>` 统一返回格式

## 二、方案选型

### 最终选择：HTTP 桥接模式

```
外部 AI (Stdio MCP Client)
  │ 启动子进程，JSON-RPC via stdin/stdout
  ▼
mcp-agent.cjs（独立 Node.js 脚本）
  │ HTTP POST → localhost:19527/mcp
  ▼
Electron 主进程内嵌 HTTP Server
  │ 路由 dispatchTool() → Service 层
  ▼
Service → Repository → SQLite
```

| 方案 | 结论 |
|------|------|
| 方案 A：fork 子进程 + IPC 转发 | 否决 — Stdio MCP 要求外部 AI 启动目标进程，而非 Electron 启动 |
| 方案 B：HTTP 桥接（推荐）| 选中 — 解耦清晰，mcp-agent 独立运行，通过 HTTP 桥接到 Electron |
| 方案 C：子进程直连 SQLite | 否决 — Service 校验逻辑重复维护、WAL 多进程写隐患 |

## 三、功能范围

### 3.1 暴露的 MCP Tool

| Tool 名 | 对应 IPC | 参数 | 返回 |
|---|---|---|---|
| `list_transactions` | `transaction:list` | `type?, categoryId?, ledgerId?, startDate?, endDate?, keyword?, page?, pageSize?` | `{list, total}` |
| `get_transaction` | `transaction:getById` | `id: number` | 单条记录 |
| `create_transaction` | `transaction:create` | `type, amount, categoryId, ledgerId, transDate, description?, paymentMethod?` | 成功/失败 |
| `update_transaction` | `transaction:update` | `id` + 同 create | 成功/失败 |
| `delete_transaction` | `transaction:delete` | `id: number` | 成功/失败 |
| `list_ledgers` | `ledger:list` | 无 | 账本数组 |
| `list_categories` | `category:list` | `type?: income/expense` | 分类数组 |

### 3.2 不包含

- CSV 导入、月度统计、分类/账本 CRUD — 这些不在当前范围
- 多客户端并发 — 单连接足以满足需求
- 鉴权 — 仅本地回环，假设本机环境可信任

## 四、文件结构

```
src/main/mcp/
  mcp-server.ts       # 主进程：内嵌 HTTP Server + dispatchTool 分发
  mcp-tools.ts        # 共享：Tool 定义、JSON Schema、inputSchema

resources/
  mcp-agent.cjs       # 独立脚本：MCP stdio 协议层，HTTP 桥接到 Electron

plugin/               # TraeWork 插件包（独立目录，非源码）
  .trae-plugin/
    plugin.json
  .mcp.json
  assets/
    icon.svg
```

### 4.1 各文件职责

| 文件 | 运行环境 | 职责 | 依赖 |
|---|---|---|---|
| `mcp-server.ts` | Electron 主进程 | 监听 `localhost:19527`，解析 `{tool, args}`，分发到 Service | Service 层各实例 |
| `mcp-tools.ts` | 被 mcp-server 引用 | 定义 7 个 Tool 的 name/description/inputSchema | 无外部依赖 |
| `mcp-agent.cjs` | 独立 Node.js | MCP 协议（initialize/tools/list/tools/call），HTTP POST 到 Electron | Node 内置 `http` |

### 4.2 修改现有文件

| 文件 | 改动 |
|---|---|
| `src/main/index.ts` | `app.whenReady()` 末尾新增：`startMCPServer()` 启动 HTTP 服务 |
| `electron-builder.yml` | 添加 `extraResources` 配置，将 `resources/mcp-agent.cjs` 打包到安装目录 |

## 五、详细设计

### 5.1 HTTP 内部桥接 API

**单端点设计**（不对每个 tool 分路由）：

```
POST /mcp
Content-Type: application/json

{
  "tool": "list_transactions",
  "args": { "ledgerId": 1, "page": 1, "pageSize": 20 }
}

→ 响应：
{
  "code": 0,
  "data": { "list": [...], "total": 42 },
  "msg": "查询成功"
}
```

**实现要点**：

```typescript
// mcp-server.ts
import http from 'http'

export function startMCPServer(): void {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(404).end()
      return
    }
    let body = ''
    req.on('data', c => body += c)
    req.on('end', async () => {
      try {
        const { tool, args } = JSON.parse(body)
        const result = await dispatchTool(tool, args || {})
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(400).end(JSON.stringify({
          code: -1, data: null, msg: `请求解析失败: ${e.message}`
        }))
      }
    })
  })
  server.listen(19527, '127.0.0.1')
  logger.info('MCP HTTP 服务已启动: http://127.0.0.1:19527')
}
```

### 5.2 dispatchTool 分发

```typescript
async function dispatchTool(tool: string, args: Record<string, unknown>) {
  switch (tool) {
    case 'list_transactions':
      return transactionService.getList(args as ListParams)
    case 'get_transaction':
      return transactionService.getById(args.id as number)
    case 'create_transaction':
      return transactionService.create(args as TransactionInput)
    case 'update_transaction':
      return transactionService.update(args.id as number, args as TransactionInput)
    case 'delete_transaction':
      return transactionService.delete(args.id as number)
    case 'list_ledgers':
      return ledgerService.getList()
    case 'list_categories':
      return categoryService.getList(args.type as string | undefined)
    default:
      return { code: -1, data: null, msg: `未知工具: ${tool}` }
  }
}
```

### 5.3 Tool 定义（mcp-tools.ts）

每个 Tool 包含 `name`、`description`（中文描述供 AI 理解）、`inputSchema`（JSON Schema）：

```typescript
export const MCP_TOOLS = [
  {
    name: 'list_transactions',
    description: '查询账单记录，支持按类型、分类、账本、日期范围、关键字筛选和分页',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型' },
        categoryId: { type: 'integer', description: '分类ID' },
        ledgerId: { type: 'integer', description: '账本ID，默认1' },
        startDate: { type: 'string', description: '开始日期 YYYY-MM-DD' },
        endDate: { type: 'string', description: '结束日期 YYYY-MM-DD' },
        keyword: { type: 'string', description: '备注模糊搜索' },
        page: { type: 'integer', description: '页码，默认1' },
        pageSize: { type: 'integer', description: '每页条数，默认20' }
      }
    }
  },
  {
    name: 'get_transaction',
    description: '按ID查询单条账单记录',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: '账单ID' } },
      required: ['id']
    }
  },
  {
    name: 'create_transaction',
    description: '新增一条收支记录',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型（必填）' },
        amount: { type: 'number', description: '金额，必须大于0（必填）' },
        categoryId: { type: 'integer', description: '分类ID（必填）' },
        ledgerId: { type: 'integer', description: '账本ID（必填）' },
        transDate: { type: 'string', description: '交易日期 YYYY-MM-DD（必填）' },
        description: { type: 'string', description: '备注（可选）' },
        paymentMethod: { type: 'string', description: '支付方式（可选）' }
      },
      required: ['type', 'amount', 'categoryId', 'ledgerId', 'transDate']
    }
  },
  {
    name: 'update_transaction',
    description: '编辑一条已有账单记录',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: '账单ID（必填）' },
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型（必填）' },
        amount: { type: 'number', description: '金额，必须大于0（必填）' },
        categoryId: { type: 'integer', description: '分类ID（必填）' },
        ledgerId: { type: 'integer', description: '账本ID（必填）' },
        transDate: { type: 'string', description: '交易日期 YYYY-MM-DD（必填）' },
        description: { type: 'string', description: '备注（可选）' },
        paymentMethod: { type: 'string', description: '支付方式（可选）' }
      },
      required: ['id', 'type', 'amount', 'categoryId', 'ledgerId', 'transDate']
    }
  },
  {
    name: 'delete_transaction',
    description: '删除一条账单记录（不可恢复）',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: '账单ID（必填）' } },
      required: ['id']
    }
  },
  {
    name: 'list_ledgers',
    description: '查询所有账本列表',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_categories',
    description: '查询分类列表，可按收支类型筛选',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string', enum: ['income', 'expense'], description: '收支类型（可选）' } }
    }
  }
]
```

### 5.4 mcp-agent.cjs 协议层

**Tool 定义获取方式**：mcp-agent.cjs 是 CommonJS 脚本，无法 import TS 模块。Tool 定义以纯 JS 常量直接内嵌在脚本中（7 个 Tool 共约 80 行），`tools/list` 时直接返回。业务数据仍通过 HTTP 调用 Electron。

**MCP 协议处理**：

| JSON-RPC Method | 处理逻辑 |
|---|---|
| `initialize` | 返回 `serverInfo` + `capabilities.tools` |
| `notifications/initialized` | 忽略 |
| `tools/list` | 返回 7 个 Tool 定义 |
| `tools/call` | HTTP POST → Electron → 结果转 MCP content 格式 |

**核心骨架**：

```javascript
// mcp-agent.cjs
const http = require('http')
const ELECTRON_URL = 'http://127.0.0.1:19527/mcp'

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000
    }, (res) => {
      let responseData = ''
      res.on('data', c => responseData += c)
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)) }
        catch (e) { reject(new Error('响应解析失败')) }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function writeResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

async function handleToolsCall(msg) {
  try {
    const resp = await postJson(ELECTRON_URL, {
      tool: msg.params.name,
      args: msg.params.arguments || {}
    })
    const content = resp.code === 0
      ? [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }]
      : [{ type: 'text', text: `操作失败: ${resp.msg}` }]
    writeResponse(msg.id, { content })
  } catch (e) {
    writeResponse(msg.id, null, { code: -32000, message: e.message })
  }
}
```

### 5.5 发现与安装（TraeWork 插件 + 通用配置）

#### A. TraeWork 插件

参考 Gitee 插件的结构，创建一个 TraeWork 插件包：

```
personal-finance-mcp/
  .trae-plugin/
    plugin.json          # 插件元数据
  .mcp.json              # MCP 服务定义
  assets/
    icon.svg             # 插件图标
```

**`.mcp.json`**（stdio 模式，指向 mcp-agent.cjs）：

```json
{
  "mcpServers": {
    "personal-finance": {
      "type": "stdio",
      "command": "node",
      "args": ["%APPDATA%/personal-finance/resources/mcp-agent.cjs"]
    }
  }
}
```

> 路径 `%APPDATA%/personal-finance` 是 `electron-builder` 的默认安装目录，`mcp-agent.cjs` 通过 `extraResources` 打包到该路径下。

**`.trae-plugin/plugin.json`**：

```json
{
  "name": "personal-finance-mcp",
  "version": "1.0.0",
  "description": "通过 MCP 协议查询和管理个人记账应用的账单数据",
  "author": { "name": "个人记账" },
  "mcp": ".mcp.json",
  "interface": {
    "displayName": "个人记账",
    "shortDescription": "查询和新增个人账单记录",
    "longDescription": "连接本地个人记账应用，支持通过 AI 助手查询账本、分类和交易记录，以及新增、编辑、删除账单。",
    "category": "Productivity",
    "capabilities": ["Read", "Write"],
    "defaultPrompt": [
      "帮我看一下这个月的支出情况",
      "记一笔餐饮支出",
      "列出我的所有账本"
    ],
    "brandColor": "#E07800",
    "logo": "./assets/icon.svg"
  }
}
```

**安装方式**：用户在 TraeWork 插件市场搜索"个人记账"一键安装，或手动加载插件目录。

**不需要 connector.json**：本方案通过 stdio + 本地 HTTP 桥接，无需鉴权。

#### B. 通用配置（Claude Code / Cursor / Codex / Continue.dev 等）

所有支持 MCP stdio 的 AI 工具，只需在对应的配置文件中添加：

```json
{
  "mcpServers": {
    "个人记账": {
      "command": "node",
      "args": ["{mcp-agent.cjs 的绝对路径}"]
    }
  }
}
```

各工具配置文件位置：

| 工具 | 配置文件 | 示例路径 |
|---|---|---|
| TraeWork | 插件 `.mcp.json` | 见上节 |
| **Claude Code** | 项目 `.mcp.json` 或全局 `claude_desktop_config.json` | `~/.claude/claude_desktop_config.json` |
| **Cursor** | 项目 `.cursor/mcp.json` | 项目根目录 |
| **VS Code Copilot** | 项目 `.vscode/mcp.json` | 项目根目录 |
| **Codex (OpenAI)** | Agent 配置 → MCP Server → Add | GUI 配置 |
| **Continue.dev** | `~/.continue/config.json` | 用户目录 |

#### C. 应用内路径生成

为了解决"用户不知道 mcp-agent.cjs 在哪"的问题，`mcp-agent.cjs` 打包到 `extraResources` 后，固定位于：

- **Windows**: `%LOCALAPPDATA%/personal-finance/resources/mcp-agent.cjs`
- **macOS**: `~/Library/Application Support/personal-finance/resources/mcp-agent.cjs`

Electron 主进程在启动时可将此路径写入日志，供用户查阅。后续可在应用设置页提供"复制 MCP 配置"按钮。

## 六、生命周期

### 6.1 启动时序

```
app.whenReady()
  ├── ① initFileTransport() — 日志
  ├── ② DbManager.init(dbPath) — 数据库
  ├── ③ registerXxxController() — IPC 控制器
  ├── ④ registerAIController() — AI 控制器
  ├── ⑤ startMCPServer() — 🆕 启动 MCP HTTP 服务
  ├── ⑥ createSplashWindow() — 启动动画
  └── ⑦ createWindow() — 主窗口
```

### 6.2 关闭

```
app.on('before-quit')
  └── mcpServer?.close() — 优雅关闭 HTTP 服务
```

### 6.3 应用退出后

- HTTP 端口释放，mcp-agent 再发起请求会收到 `ECONNREFUSED`
- mcp-agent 返回 JSON-RPC error: "请先启动个人记账应用"

## 七、错误处理矩阵

| 场景 | 主进程处理 | mcp-agent 处理 |
|---|---|---|
| Electron 未启动（端口无响应） | — | `ECONNREFUSED` → JSON-RPC error "请先启动个人记账应用" |
| Service 层抛异常 | try/catch → `{code:-1, msg}` | 正常解析，返回 error content |
| 非法参数 | Service.validateInput() 拦截 | 同上 |
| DB 锁定 | p-queue + WAL，极低概率 | 30s 超时 → "操作超时，请重试" |
| HTTP 请求格式错误 | 400 + JSON error | 协议错误 → JSON-RPC error |
| 端口被占用 | 启动失败，log error | — |
| 主进程异常退出 | — | 连接断开 → "服务已断开" |

## 八、安全约束

| 约束 | 实现 |
|---|---|
| 仅本地回环 | `server.listen(19527, '127.0.0.1')` |
| 无外网暴露 | 不监听 `0.0.0.0` |
| 无探测端点 | 仅 `POST /mcp`，GET 返回 404 |
| 无数据泄露 | 服务仅在应用运行期间存活 |
| 无鉴权 | 本机回环假设可信任，未来可加 token |

## 九、测试策略

### 9.1 单元测试（mcp-tools.ts）

- 验证 Tool 定义格式正确（name/description/inputSchema 齐全）
- 验证 dispatchTool 对未知 tool 返回错误

### 9.2 集成测试（手动验证）

1. 启动应用，`curl` 测试 HTTP 端点
2. 用 `node mcp-agent.cjs` 手动启动，stdin 输入 JSON-RPC 消息验证协议
3. 在 TraeWork 中配置 MCP，测试全链路

### 9.3 测试用例

| 用例 | 步骤 | 预期 |
|---|---|---|
| 查询账单列表 | `POST /mcp {"tool":"list_transactions","args":{"ledgerId":1}}` | 返回 `{code:0, data:{list:[], total:N}}` |
| 新增账单 | `POST /mcp {"tool":"create_transaction","args":{"type":"expense","amount":35,"categoryId":1,"ledgerId":1,"transDate":"2026-07-27","description":"午餐"}}` | 返回 `{code:0, msg:"新增成功"}` |
| 缺少必填字段 | `POST /mcp {"tool":"create_transaction","args":{"type":"income"}}` | 返回 `{code:-1, msg:"金额必须大于0"}` |
| 未启动 Electron | `node mcp-agent.cjs` 输入 `tools/call` | 返回 error "请先启动个人记账应用" |
