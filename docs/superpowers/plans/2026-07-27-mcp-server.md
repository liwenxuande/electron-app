# MCP Server 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为个人记账 Electron 应用增加 MCP Server，使外部 AI 通过 Stdio MCP 协议查询和操作账单数据。

**架构：** Electron 主进程内嵌极简 HTTP Server（`localhost:19527`），提供 `POST /mcp` 单端点对接现有 Service 层；独立 `mcp-agent.cjs` 脚本由外部 AI spawn，通过 stdin/stdout 处理 MCP 协议，内部 HTTP POST 桥接到 Electron。

**技术栈：** Node 内置 `http` 模块（零外部依赖）+ TypeScript + better-sqlite3 现有 Service 层

**规格文档：** `docs/superpowers/specs/2026-07-27-mcp-server-design.md`

---

### 任务 1：创建 Tool 定义模块

**文件：**
- 创建：`src/main/mcp/mcp-tools.ts`

- [ ] **步骤 1：创建 mcp 目录并编写 Tool 定义**

```bash
mkdir -p src/main/mcp
```

```typescript
// src/main/mcp/mcp-tools.ts
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const MCP_TOOLS: MCPTool[] = [
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
      properties: {
        type: { type: 'string', enum: ['income', 'expense'], description: '收支类型（可选）' }
      }
    }
  }
]
```

- [ ] **步骤 2：验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "mcp-tools"
```

预期：无报错。

- [ ] **步骤 3：Commit**

```bash
git add src/main/mcp/mcp-tools.ts
git commit -m "feat: 新增 MCP Tool 定义 — 7 个工具覆盖账本、分类、账单 CRUD"
```

---

### 任务 2：创建 MCP HTTP Server + 分发逻辑

**文件：**
- 创建：`src/main/mcp/mcp-server.ts`

**依赖：** 任务 1 的 `mcp-tools.ts`，以及现有 Service 层（`TransactionService`、`LedgerService`、`CategoryService`）

- [ ] **步骤 1：编写 mcp-server.ts**

```typescript
// src/main/mcp/mcp-server.ts
import http from 'http'
import { logger } from '../utils/logger'
import { MCP_TOOLS } from './mcp-tools'
import { TransactionService } from '../service/transactionService'
import { TransactionRepository } from '../repository/transactionRepository'
import { CategoryRepository } from '../repository/categoryRepository'
import { CategoryService } from '../service/categoryService'
import { LedgerService } from '../service/ledgerService'
import { LedgerRepository } from '../repository/ledgerRepository'
import DbManager from '../db/database'
import { ApiResponse } from '../types'

let httpServer: http.Server | null = null

/**
 * 根据 tool 名称分发到对应 Service 方法
 * 复用 100% 现有 Service 校验逻辑
 */
function dispatchTool(
  tool: string,
  args: Record<string, unknown>,
  txService: TransactionService,
  ledgerService: LedgerService,
  categoryService: CategoryService
): Promise<ApiResponse<unknown>> | ApiResponse<unknown> {
  switch (tool) {
    case 'list_transactions':
      return txService.getList(args as Record<string, unknown>)
    case 'get_transaction':
      return txService.getById(args.id as number)
    case 'create_transaction':
      return txService.create(args as Parameters<TransactionService['create']>[0])
    case 'update_transaction':
      return txService.update(args.id as number, args as Parameters<TransactionService['create']>[0])
    case 'delete_transaction':
      return txService.delete(args.id as number)
    case 'list_ledgers':
      return ledgerService.getAllLedgers()
    case 'list_categories':
      if (args.type && (args.type === 'income' || args.type === 'expense')) {
        return categoryService.getCategoriesByType(args.type)
      }
      return categoryService.getAllCategories()
    default:
      return { code: -1, data: null, msg: `未知工具: ${tool}` }
  }
}

/**
 * 启动 MCP HTTP 服务，监听 localhost:19527
 * 必须在 app.whenReady() 后、数据库初始化完成后调用
 */
export function startMCPServer(): void {
  const dbManager = DbManager.getInstance()
  const txRepository = new TransactionRepository(dbManager)
  const categoryRepository = new CategoryRepository(dbManager)
  const ledgerRepository = new LedgerRepository(dbManager)
  const txService = new TransactionService(txRepository, categoryRepository, dbManager)
  const ledgerService = new LedgerService(ledgerRepository, dbManager)
  const categoryService = new CategoryService(categoryRepository)

  httpServer = http.createServer((req, res) => {
    // 仅处理 POST /mcp
    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(404).end()
      return
    }

    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', async () => {
      try {
        const { tool, args } = JSON.parse(body)
        logger.info(`[MCP] tool=${tool} args=${JSON.stringify(args)}`)
        const result = await dispatchTool(tool, args || {}, txService, ledgerService, categoryService)
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(result))
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        logger.error(`[MCP] 请求解析失败: ${errMsg}`)
        res.writeHead(400)
        res.end(JSON.stringify({ code: -1, data: null, msg: `请求解析失败: ${errMsg}` }))
      }
    })
  })

  httpServer.listen(19527, '127.0.0.1', () => {
    logger.info('MCP HTTP 服务已启动: http://127.0.0.1:19527')
  })
}

/**
 * 关闭 MCP HTTP 服务
 */
export function stopMCPServer(): void {
  if (httpServer) {
    httpServer.close()
    logger.info('MCP HTTP 服务已关闭')
  }
}
```

- [ ] **步骤 2：确认 LedgerService/CategoryService 方法签名**

`LedgerService` 使用 `getAllLedgers()`；`CategoryService` 使用 `getAllCategories()` 和 `getCategoriesByType(type)`。以上 dispatch 代码已匹配。

- [ ] **步骤 3：验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

预期：无 TypeScript 错误。

- [ ] **步骤 4：Commit**

```bash
git add src/main/mcp/mcp-server.ts
git commit -m "feat: 新增 MCP HTTP Server — localhost:19527 内嵌服务 + dispatchTool 分发"
```

---

### 任务 3：集成到应用启动流程

**文件：**
- 修改：`src/main/index.ts`

- [ ] **步骤 1：在 index.ts 中导入并启动 MCP Server**

在 `src/main/index.ts` 顶部添加导入：

```typescript
import { startMCPServer, stopMCPServer } from './mcp/mcp-server'
```

- [ ] **步骤 2：在 app.whenReady() 中，IPC 控制器注册完成后启动**

在 `registerAIController()` 之后、`createSplashWindow()` 之前插入：

```typescript
// ⑤ 启动 MCP HTTP 服务（外部 AI 通过 mcp-agent.cjs → localhost:19527 访问）
startMCPServer()
```

原代码中的序号注释顺延调整（原 ⑤ 创建启动动画 → ⑥，原 ⑥ 创建主窗口 → ⑦）。

- [ ] **步骤 3：在 before-quit 中优雅关闭**

在 `app.on('before-quit', ...)` 回调中添加：

```typescript
app.on('before-quit', () => {
  stopMCPServer()
  logger.info('应用即将退出')
})
```

- [ ] **步骤 4：验证 TypeScript 编译**

```bash
npx tsc --noEmit 2>&1 | Select-String "error"
```

预期：无 TypeScript 错误。

- [ ] **步骤 5：启动应用验证 HTTP 服务**

```bash
npm run dev
```

应用启动后，日志中应出现：

```
MCP HTTP 服务已启动: http://127.0.0.1:19527
```

- [ ] **步骤 6：Commit**

```bash
git add src/main/index.ts
git commit -m "feat: MCP HTTP Server 集成到应用生命周期 — 启动/关闭"
```

---

### 任务 4：创建 mcp-agent.cjs 协议层

**文件：**
- 创建：`resources/mcp-agent.cjs`

- [ ] **步骤 1：创建 resources 目录**

```bash
mkdir -p resources
```

- [ ] **步骤 2：编写 mcp-agent.cjs**

```javascript
// resources/mcp-agent.cjs
// MCP Stdio 协议桥接 — 外部 AI spawn 此脚本，HTTP POST 桥接到 Electron 主进程
// 依赖：Node.js 内置模块（零外部依赖）

'use strict'

const http = require('http')
const ELECTRON_URL = 'http://127.0.0.1:19527/mcp'

const SERVER_INFO = {
  name: 'personal-finance-mcp',
  version: '1.0.0'
}

const MCP_TOOLS = [
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

/**
 * POST JSON 到 Electron HTTP Server
 */
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    }
    const req = http.request(url, options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => { responseData += chunk.toString() })
      res.on('end', () => {
        try { resolve(JSON.parse(responseData)) }
        catch (e) { reject(new Error('响应解析失败')) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('请求超时（30秒）'))
    })
    req.write(data)
    req.end()
  })
}

/**
 * 写入 JSON-RPC 响应到 stdout
 */
function writeResponse(id, result) {
  const msg = { jsonrpc: '2.0', id, result }
  process.stdout.write(JSON.stringify(msg) + '\n')
}

function writeError(id, code, message) {
  const msg = { jsonrpc: '2.0', id, error: { code, message } }
  process.stdout.write(JSON.stringify(msg) + '\n')
}

/**
 * 处理 tools/call — HTTP 桥接到 Electron
 */
async function handleToolsCall(msg) {
  try {
    const resp = await postJson(ELECTRON_URL, {
      tool: msg.params.name,
      args: msg.params.arguments || {}
    })
    const content = resp.code === 0
      ? [{ type: 'text', text: JSON.stringify(resp.data, null, 2) }]
      : [{ type: 'text', text: '操作失败: ' + resp.msg }]
    writeResponse(msg.id, { content })
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      writeResponse(msg.id, {
        content: [{ type: 'text', text: '错误: 请先启动"个人记账"应用' }]
      })
    } else if (e.message === '请求超时（30秒）') {
      writeResponse(msg.id, {
        content: [{ type: 'text', text: '错误: 操作超时，请重试' }]
      })
    } else {
      writeError(msg.id, -32000, e.message || '未知错误')
    }
  }
}

/**
 * 主入口：stdin 读取 JSON-RPC，按 method 分发
 */
let buffer = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', (chunk) => {
  buffer += chunk
  // MCP 消息以换行分隔
  while (buffer.includes('\n')) {
    const idx = buffer.indexOf('\n')
    const line = buffer.slice(0, idx).trim()
    buffer = buffer.slice(idx + 1)

    if (!line) continue

    let msg
    try { msg = JSON.parse(line) }
    catch (e) { continue }

    if (!msg.method) continue

    switch (msg.method) {
      case 'initialize':
        writeResponse(msg.id, {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO
        })
        break

      case 'notifications/initialized':
        // MCP 规范：无需响应
        break

      case 'tools/list':
        writeResponse(msg.id, { tools: MCP_TOOLS })
        break

      case 'tools/call':
        handleToolsCall(msg)
        break

      default:
        writeError(msg.id, -32601, '未知方法: ' + msg.method)
    }
  }
})

// 优雅退出处理（可选）
process.on('SIGTERM', () => process.exit(0))
```

- [ ] **步骤 3：手动测试 mcp-agent.cjs**

启动 Electron 应用（`npm run dev`），然后在另一个终端：

```bash
echo '{"jsonrpc":"2.0","id":"1","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node resources/mcp-agent.cjs
```

预期 stdout 输出包含 `"serverInfo":{"name":"personal-finance-mcp"}`。

- [ ] **步骤 4：测试 tools/call**

```bash
echo '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"list_ledgers","arguments":{}}}' | node resources/mcp-agent.cjs
```

预期返回账本列表 JSON。

- [ ] **步骤 5：Commit**

```bash
git add resources/mcp-agent.cjs
git commit -m "feat: 新增 mcp-agent.cjs — MCP Stdio 协议桥接，HTTP POST 到 Electron"
```

---

### 任务 5：配置打包

**文件：**
- 修改：`electron-builder.yml`

- [ ] **步骤 1：读取当前 electron-builder.yml**

```bash
cat electron-builder.yml
```

- [ ] **步骤 2：在 extraResources 中追加 mcp-agent.cjs**

现有 `electron-builder.yml` 已有：

```yaml
extraResources:
  - from: build/icon.ico
    to: icon.ico
  - from: src/renderer/splash.html
    to: splash.html
```

追加一行：

```yaml
extraResources:
  - from: build/icon.ico
    to: icon.ico
  - from: src/renderer/splash.html
    to: splash.html
  - from: resources/mcp-agent.cjs
    to: resources/mcp-agent.cjs
```

- [ ] **步骤 3：验证打包配置语法**

```bash
npx electron-builder --help
```

预期：无 YAML 解析错误。

- [ ] **步骤 4：Commit**

```bash
git add electron-builder.yml
git commit -m "chore: extraResources 追加 mcp-agent.cjs 打包配置"
```

---

### 任务 6：创建 TraeWork 插件包

**文件：**
- 创建：`plugin/.trae-plugin/plugin.json`
- 创建：`plugin/.mcp.json`
- 创建：`plugin/assets/icon.svg`

- [ ] **步骤 1：创建插件目录结构**

```bash
mkdir -p plugin/.trae-plugin plugin/assets
```

- [ ] **步骤 2：编写 plugin.json**

```json
{
  "name": "personal-finance-mcp",
  "version": "1.0.0",
  "description": "通过 MCP 协议查询和管理个人记账应用的账单数据",
  "i18n": {
    "display_name": {
      "zh-cn": "个人记账",
      "en": "Personal Finance"
    },
    "description": {
      "zh-cn": "连接本地个人记账应用，支持通过 AI 助手查询账本、分类和交易记录，以及新增、编辑、删除账单。",
      "en": "Connect to local Personal Finance app to query ledgers, categories, and transactions, as well as create, edit, and delete records via AI assistant."
    }
  },
  "author": {
    "name": "个人记账"
  },
  "license": "MIT",
  "keywords": ["finance", "accounting", "ledger", "transactions"],
  "mcp": ".mcp.json",
  "interface": {
    "displayName": "个人记账",
    "shortDescription": "查询和新增个人账单记录",
    "longDescription": "连接本地个人记账应用，支持通过 AI 助手查询账本、分类和交易记录，以及新增、编辑、删除账单。",
    "developerName": "个人记账",
    "category": "Productivity",
    "capabilities": ["Read", "Write"],
    "defaultPrompt": [
      "帮我看一下这个月的支出情况",
      "记一笔餐饮支出 35 元",
      "列出我的所有账本"
    ],
    "brandColor": "#E07800",
    "logo": "./assets/icon.svg"
  }
}
```

- [ ] **步骤 3：编写 .mcp.json**

```json
{
  "mcpServers": {
    "personal-finance": {
      "type": "stdio",
      "command": "node",
      "args": ["%LOCALAPPDATA%/personal-finance/resources/mcp-agent.cjs"]
    }
  }
}
```

- [ ] **步骤 4：创建 SVG 图标**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="6" fill="#E07800"/>
  <path d="M8 10h16M8 16h16M8 22h12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
</svg>
```

写入 `plugin/assets/icon.svg`。

- [ ] **步骤 5：Commit**

```bash
git add plugin/
git commit -m "feat: 新增 TraeWork 插件包 — MCP 集成一键安装"
```

---

### 任务 7：全链路验证

**前置：** Electron 应用正在运行（`npm run dev`）

- [ ] **步骤 1：用 curl 测试 HTTP 端点**

```bash
curl -X POST http://127.0.0.1:19527/mcp -H "Content-Type: application/json" -d "{\"tool\":\"list_ledgers\",\"args\":{}}"
```

预期返回：

```json
{"code":0,"data":[{"id":1,"name":"默认账本","description":"系统默认账本",...}],"msg":"查询成功"}
```

- [ ] **步骤 2：测试新增交易**

```bash
curl -X POST http://127.0.0.1:19527/mcp -H "Content-Type: application/json" -d "{\"tool\":\"create_transaction\",\"args\":{\"type\":\"expense\",\"amount\":35,\"categoryId\":1,\"ledgerId\":1,\"transDate\":\"2026-07-27\",\"description\":\"午餐测试\"}}"
```

预期返回 `{"code":0,"msg":"新增成功"}`。

- [ ] **步骤 3：测试校验（缺少必填字段）**

```bash
curl -X POST http://127.0.0.1:19527/mcp -H "Content-Type: application/json" -d "{\"tool\":\"create_transaction\",\"args\":{\"type\":\"income\"}}"
```

预期返回 `{"code":-1,"msg":"金额必须大于0"}`。

- [ ] **步骤 4：测试 mcp-agent 全链路**

```bash
echo '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}' | node resources/mcp-agent.cjs
```

预期输出包含 7 个 tool 定义的 JSON-RPC 响应。

- [ ] **步骤 5：测试 Electron 未启动时的错误处理**

关掉 Electron 应用，然后：

```bash
echo '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"list_ledgers","arguments":{}}}' | node resources/mcp-agent.cjs
```

预期输出包含 `"错误: 请先启动"个人记账"应用"`。

- [ ] **步骤 6：验证全部 commit 历史**

```bash
git log --oneline -7
```

预期 7 个清晰的 commit，涵盖上述所有任务。
