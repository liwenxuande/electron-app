# AI 智能分析功能设计文档

> 基于 DeepSeek V4 API 的个人记账 AI 分析助手

## 1. 概述

为个人记账系统接入 DeepSeek AI，实现三项核心能力：

- **月度财务报告**：基于当月数据生成可读的消费分析报告
- **智能问答**：自由提问，AI 按需查数据库后回答
- **预测建议**：基于历史数据预测下月支出、给出节省建议

## 2. DeepSeek V4 模型选型

当前 DeepSeek API 提供两个模型（旧模型 `deepseek-chat` / `deepseek-reasoner` 已于 2026-07-24 下线）：

| 维度 | V4 Flash | V4 Pro |
|------|----------|--------|
| 模型名 | `deepseek-v4-flash` | `deepseek-v4-pro` |
| 上下文 | 1M tokens | 1M tokens |
| 输入价格 | 免费 | $1.74/M tokens |
| 输出价格 | 免费 | $7.14/M tokens |
| Function Calling | ✅ 支持 | ✅ 支持 |
| Streaming | ✅ 支持 | ✅ 支持 |
| 适用场景 | 常规分析、高并发、个人项目 | 复杂推理、深度报告 |

**推荐**：默认使用 **V4 Flash**（免费），用户在设置页可选择切换到 Pro。

## 3. 技术架构

```
渲染进程 (Vue3)                    主进程 (Node.js)                    外部
┌─────────────────┐   IPC    ┌──────────────────────────┐   HTTPS    ┌──────────────┐
│ 设置弹窗         │────────►│ ai:config:save            │           │              │
│ (齿轮图标)       │         │ ai:config:get             │           │  DeepSeek    │
│                 │         │ ai:config:test             │           │  API         │
│ AI 助手面板      │────────►│ ai:chat (streaming)       │──────────►│ /v1/chat/    │
│ (Dashboard右侧)  │         │                           │           │ completions  │
│                 │         │                           │           │              │
│ 月度报告卡片     │────────►│ ai:report:monthly         │◄──────────│              │
│                 │         │                           │           │              │
│ AI 解读按钮      │────────►│ ai:report:stats           │           │              │
│ (StatisticsView)│         │                           │           │              │
└─────────────────┘         └──────────────────────────┘           └──────────────┘
```

**原则**：
- API Key **只在主进程**，绝不暴露到渲染进程
- 所有 HTTP 请求在主进程通过 Node.js 内置 `https` 模块发起
- 通过 preload `contextBridge` 暴露有限的 IPC 通道

## 4. 数据流设计

### 4.1 月度报告（JSON Mode）

采用 `response_format: { type: "json_object" }` 而非 Function Calling：

```
1. 主进程从 DB 查询统计摘要 → 拼成 JSON
2. JSON 作为 user message 发给 DeepSeek
3. DeepSeek 返回结构化 JSON { summary, analysis, suggestions }
4. 前端渲染：Markdown 文字 + ECharts 图表数据
```

### 4.2 自由问答（Function Calling + Tools）

AI 自主决定需要什么数据：

```
用户: "餐饮怎么超了这么多？"
  → AI 调用 get_category_breakdown() 拿分类数据
  → AI 调用 get_daily_trend() 看日趋势
  → AI 综合分析后回复
```

### 4.3 预测建议（Function Calling）

```
用户 / 按钮触发: "预测下月支出"
  → AI 调用 get_monthly_summary() × 上月
  → AI 调用 get_daily_trend() × 近30天
  → AI 基于历史数据预测 + 给出建议
```

## 5. Tools 体系

定义 6 个 Tool，AI 按需调用：

| Tool 名称 | 功能 | 参数 | 返回数据 |
|-----------|------|------|----------|
| `get_monthly_summary` | 月度收支汇总 | `yearMonth` | `{ totalIncome, totalExpense, count }` |
| `get_category_breakdown` | 分类排行 | `yearMonth`, `type` | `[{ name, amount, percentage, count }]` |
| `get_daily_trend` | 每日趋势 | `startDate`, `endDate` | `[{ date, income, expense }]` |
| `get_top_entries` | 大额交易 | `yearMonth`, `type`, `limit` | `[{ date, category, amount, desc }]` |
| `compare_months` | 月度对比 | `currentYM`, `prevYM` | `{ incomeChange, expenseChange, ... }` |
| `get_budget_status` | 预算执行 | `yearMonth` | `{ budgeted, spent, remaining, rate }` |

## 6. 主进程文件

```
src/main/
├── service/ai/
│   ├── deepseekClient.ts      # HTTP 封装（https 模块，streaming 支持）
│   ├── aiConfigService.ts     # safeStorage 加密存取 API Key
│   ├── aiToolService.ts       # Tool 注册 + SQL 执行器
│   └── aiAnalysisService.ts   # 编排：prompt + tools + API 调用循环
├── controller/
│   └── aiController.ts        # IPC 通道注册
```

## 7. 核心代码实现

### 7.1 deepseekClient.ts — HTTP 请求 + Streaming 封装

```typescript
// src/main/service/ai/deepseekClient.ts
import https from 'https'
import { logger } from '../../utils/logger'

const BASE_URL = 'api.deepseek.com'
const TIMEOUT_MS = 30_000

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string; enum?: string[] }>
      required: string[]
    }
  }
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

function postJSON(path: string, body: object, apiKey: string, signal?: AbortSignal): Promise<any> {
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
      signal,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}`))
          } else {
            resolve(json)
          }
        } catch {
          reject(new Error(`解析响应失败: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(payload)
    req.end()
  })
}

async function postStream(
  path: string,
  body: object,
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
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
      signal,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errData = ''
        res.on('data', (chunk: Buffer) => { errData += chunk.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(errData)
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}`))
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${errData.slice(0, 200)}`))
          }
        })
        return
      }

      let fullText = ''
      let buffer = ''
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullText += content
              onChunk(content)
            }
          } catch { /* 跳过非 JSON 行 */ }
        }
      })
      res.on('end', () => resolve(fullText))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(payload)
    req.end()
  })
}

export class DeepSeekClient {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'deepseek-v4-flash') {
    this.apiKey = apiKey
    this.model = model
  }

  /**
   * 非流式对话
   */
  async chat(messages: ChatMessage[], temperature = 0.3): Promise<string> {
    const res = await postJSON('/v1/chat/completions', {
      model: this.model,
      messages,
      temperature,
    }, this.apiKey)
    return res.choices?.[0]?.message?.content || ''
  }

  /**
   * 流式对话 — 逐 chunk 回调
   */
  chatStream(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    temperature = 0.3,
    signal?: AbortSignal,
  ): Promise<string> {
    return postStream('/v1/chat/completions', {
      model: this.model,
      messages,
      temperature,
      stream: true,
    }, this.apiKey, onChunk, signal)
  }

  /**
   * 带 Tools 的对话 — 返回 finish_reason + tool_calls 或 text
   */
  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDef[],
    temperature = 0.3,
  ): Promise<{
    finishReason: string
    content: string | null
    toolCalls: ToolCall[]
  }> {
    const res = await postJSON('/v1/chat/completions', {
      model: this.model,
      messages,
      tools,
      temperature,
    }, this.apiKey)
    const msg = res.choices?.[0]?.message || {}
    return {
      finishReason: res.choices?.[0]?.finish_reason || 'stop',
      content: msg.content || null,
      toolCalls: msg.tool_calls || [],
    }
  }

  /**
   * 验证 API Key 是否有效
   */
  async validate(): Promise<boolean> {
    try {
      await this.chat([{ role: 'user', content: 'ping' }])
      return true
    } catch {
      return false
    }
  }
}
```

### 7.2 aiConfigService.ts — API Key 安全存储 + 聊天历史

```typescript
// src/main/service/ai/aiConfigService.ts
import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import { DeepSeekClient } from './deepseekClient'
import { logger } from '../../utils/logger'

export interface AIConfig {
  encryptedKey: string          // safeStorage.encryptString() 后的 base64
  model: string                 // deepseek-v4-flash | deepseek-v4-pro
}

export interface ChatRecord {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ChatHistory {
  sessionId: string
  records: ChatRecord[]
  ledgerId: number | null
  createdAt: number
  updatedAt: number
}

const CONFIG_DIR = path.join(app.getPath('userData'), 'ai')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const HISTORY_FILE = path.join(CONFIG_DIR, 'chat-history.json')
const MAX_HISTORY_RECORDS = 500
const MAX_HISTORY_FILES = 20

class AIConfigService {
  private _cachedKey: string | null = null
  private _cachedModel: string = 'deepseek-v4-flash'

  /**
   * 保存 API Key（加密存储）
   */
  saveApiKey(plainKey: string): void {
    const encrypted = safeStorage.encryptString(plainKey)
    const config: AIConfig = {
      encryptedKey: encrypted.toString('base64'),
      model: this._cachedModel,
    }
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config))
    this._cachedKey = plainKey
    logger.info('API Key 已保存')
  }

  /**
   * 获取解密后的 API Key
   */
  getApiKey(): string | null {
    if (this._cachedKey) return this._cachedKey
    try {
      if (!fs.existsSync(CONFIG_FILE)) return null
      const config: AIConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      const decrypted = safeStorage.decryptString(Buffer.from(config.encryptedKey, 'base64'))
      this._cachedKey = decrypted
      this._cachedModel = config.model || 'deepseek-v4-flash'
      return decrypted
    } catch (err) {
      logger.error('解密 API Key 失败')
      return null
    }
  }

  /**
   * 保存模型选择
   */
  saveModel(model: string): void {
    this._cachedModel = model
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const config: AIConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
        config.model = model
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config))
      }
    } catch { /* ignore */ }
  }

  /**
   * 获取模型名
   */
  getModel(): string {
    if (this._cachedKey === null) this.getApiKey()
    return this._cachedModel
  }

  /**
   * 是否有已配置的 Key
   */
  hasKey(): boolean {
    return this.getApiKey() !== null
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    const key = this.getApiKey()
    if (!key) return false
    const client = new DeepSeekClient(key, this._cachedModel)
    return client.validate()
  }

  /**
   * 创建 DeepSeekClient 实例
   */
  createClient(): DeepSeekClient | null {
    const key = this.getApiKey()
    if (!key) return null
    return new DeepSeekClient(key, this._cachedModel)
  }

  // ========== 聊天历史持久化 ==========

  private _currentSession: ChatHistory | null = null

  /**
   * 加载最近一次聊天历史（跨会话保持）
   */
  loadHistory(): ChatHistory | null {
    try {
      if (!fs.existsSync(HISTORY_FILE)) return null
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8')
      const allSessions: ChatHistory[] = JSON.parse(data)
      if (allSessions.length > 0) {
        this._currentSession = allSessions[0]
        return allSessions[0]
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * 创建新会话
   */
  createSession(ledgerId: number | null): ChatHistory {
    const session: ChatHistory = {
      sessionId: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      records: [],
      ledgerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this._currentSession = session
    return session
  }

  /**
   * 添加一条聊天记录
   */
  appendRecord(role: 'user' | 'assistant', content: string): void {
    if (!this._currentSession) return
    const record: ChatRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      timestamp: Date.now(),
    }
    this._currentSession.records.push(record)
    this._currentSession.updatedAt = Date.now()

    // 限制单次会话记录数
    if (this._currentSession.records.length > MAX_HISTORY_RECORDS) {
      this._currentSession.records = this._currentSession.records.slice(-MAX_HISTORY_RECORDS)
    }
  }

  /**
   * 持久化聊天历史到文件
   */
  persistHistory(): void {
    if (!this._currentSession) return
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
      let allSessions: ChatHistory[] = []
      if (fs.existsSync(HISTORY_FILE)) {
        allSessions = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
      }
      // 找到并更新当前会话，或插入到最前面
      const idx = allSessions.findIndex(s => s.sessionId === this._currentSession!.sessionId)
      if (idx >= 0) {
        allSessions[idx] = this._currentSession
      } else {
        allSessions.unshift(this._currentSession)
      }
      // 限制保留最近 N 个会话
      allSessions = allSessions.slice(0, MAX_HISTORY_FILES)
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(allSessions))
    } catch (err) {
      logger.error('持久化聊天历史失败')
    }
  }

  /**
   * 获取当前会话记录
   */
  getCurrentRecords(): ChatRecord[] {
    return this._currentSession?.records || []
  }

  /**
   * 清空当前会话
   */
  clearSession(): void {
    this._currentSession = null
  }
}

export const aiConfigService = new AIConfigService()
```

### 7.3 aiToolService.ts — Tool 定义 + SQL 执行

```typescript
// src/main/service/ai/aiToolService.ts
import DbManager from '../../db/database'
import type { ToolDef } from './deepseekClient'

interface ToolResult {
  tool_call_id: string
  role: 'tool'
  content: string
}

export class AIToolService {
  private db: DbManager
  private ledgerId: number

  constructor(ledgerId: number) {
    this.db = DbManager.getInstance()
    this.ledgerId = ledgerId
  }

  /**
   * 所有可用工具的 JSON Schema 定义
   */
  getToolDefs(): ToolDef[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_monthly_summary',
          description: '获取指定月份的收支汇总数据',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM，如 2026-07' },
            },
            required: ['yearMonth'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_category_breakdown',
          description: '获取指定月份的分类消费/收入排行',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM' },
              type: { type: 'string', enum: ['expense', 'income'], description: '交易类型' },
            },
            required: ['yearMonth', 'type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_daily_trend',
          description: '获取指定时间段内的每日收支走势',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: '开始日期，格式 YYYY-MM-DD' },
              endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
            },
            required: ['startDate', 'endDate'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_top_entries',
          description: '获取指定月份金额最大的N条交易记录',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM' },
              type: { type: 'string', enum: ['expense', 'income'], description: '交易类型' },
              limit: { type: 'integer', description: '返回条数，默认10' },
            },
            required: ['yearMonth', 'type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'compare_months',
          description: '对比两个月份的收支数据，输出变化率',
          parameters: {
            type: 'object',
            properties: {
              currentYM: { type: 'string', description: '当前月份 YYYY-MM' },
              prevYM: { type: 'string', description: '对比月份 YYYY-MM' },
            },
            required: ['currentYM', 'prevYM'],
          },
        },
      },
    ]
  }

  /**
   * 执行 Tool 调用
   */
  executeTool(name: string, args: Record<string, any>): string {
    switch (name) {
      case 'get_monthly_summary':   return JSON.stringify(this.monthlySummary(args.yearMonth))
      case 'get_category_breakdown': return JSON.stringify(this.categoryBreakdown(args.yearMonth, args.type))
      case 'get_daily_trend':        return JSON.stringify(this.dailyTrend(args.startDate, args.endDate))
      case 'get_top_entries':        return JSON.stringify(this.topEntries(args.yearMonth, args.type, args.limit || 10))
      case 'compare_months':         return JSON.stringify(this.compareMonths(args.currentYM, args.prevYM))
      default: return JSON.stringify({ error: `未知工具: ${name}` })
    }
  }

  /** 处理一个 tool_call 列表，返回要追加到 messages 的 tool 消息数组 */
  handleToolCalls(toolCalls: { id: string; function: { name: string; arguments: string } }[]): ToolResult[] {
    return toolCalls.map(tc => {
      const args = JSON.parse(tc.function.arguments)
      const result = this.executeTool(tc.function.name, args)
      return {
        tool_call_id: tc.id,
        role: 'tool' as const,
        content: result,
      }
    })
  }

  // ===== 内部查询方法 =====

  private baseCondition(extra = ''): string {
    return `WHERE t.ledger_id = ${this.ledgerId}${extra}`
  }

  private monthlySummary(yearMonth: string) {
    const row = this.db.get<{ income: number; expense: number; count: number }>(
      `SELECT
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense,
        COUNT(*) as count
      FROM transactions t
      ${this.baseCondition(" AND t.trans_date LIKE ?")}`,
      [`${yearMonth}%`]
    )
    return {
      totalIncome: +(row?.income ?? 0).toFixed(2),
      totalExpense: +(row?.expense ?? 0).toFixed(2),
      count: row?.count ?? 0,
      balance: +((row?.income ?? 0) - (row?.expense ?? 0)).toFixed(2),
    }
  }

  private categoryBreakdown(yearMonth: string, type: string) {
    const rows = this.db.all<{ name: string; amount: number; count: number }>(
      `SELECT c.name, SUM(t.amount) as amount, COUNT(*) as count
      FROM transactions t
      LEFT JOIN category c ON t.category_id = c.id
      ${this.baseCondition(" AND t.trans_date LIKE ? AND t.type = ?")}
      GROUP BY c.name ORDER BY amount DESC`,
      [`${yearMonth}%`, type]
    )
    const total = rows.reduce((s, r) => s + r.amount, 0)
    return rows.map(r => ({
      name: r.name,
      amount: +r.amount.toFixed(2),
      percentage: total > 0 ? +((r.amount / total) * 100).toFixed(1) : 0,
      count: r.count,
    }))
  }

  private dailyTrend(startDate: string, endDate: string) {
    return this.db.all<{ date: string; income: number; expense: number }>(
      `SELECT t.trans_date as date,
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense
      FROM transactions t
      ${this.baseCondition(" AND t.trans_date >= ? AND t.trans_date <= ?")}
      GROUP BY t.trans_date ORDER BY t.trans_date ASC`,
      [startDate, endDate]
    )
  }

  private topEntries(yearMonth: string, type: string, limit: number) {
    return this.db.all<{ date: string; category: string; amount: number; desc: string }>(
      `SELECT t.trans_date as date, c.name as category, t.amount, t.description as desc
      FROM transactions t
      LEFT JOIN category c ON t.category_id = c.id
      ${this.baseCondition(" AND t.trans_date LIKE ? AND t.type = ?")}
      ORDER BY t.amount DESC LIMIT ?`,
      [`${yearMonth}%`, type, limit]
    )
  }

  private compareMonths(currentYM: string, prevYM: string) {
    const curr = this.monthlySummary(currentYM)
    const prev = this.monthlySummary(prevYM)
    const calcChange = (cur: number, pre: number) =>
      pre === 0 ? null : +(((cur - pre) / pre) * 100).toFixed(1)
    return {
      current: curr,
      previous: prev,
      incomeChange: calcChange(curr.totalIncome, prev.totalIncome),
      expenseChange: calcChange(curr.totalExpense, prev.totalExpense),
      countChange: calcChange(curr.count, prev.count),
    }
  }
}
```

### 7.4 aiAnalysisService.ts — 编排层（月度报告 + 自由问答 + Tool 循环）

```typescript
// src/main/service/ai/aiAnalysisService.ts
import { aiConfigService } from './aiConfigService'
import { AIToolService } from './aiToolService'
import type { ChatMessage, ToolDef } from './deepseekClient'

const SYSTEM_PROMPT = `你是个人财务助手，帮用户分析记账数据。
回复风格：简洁、友好、数据驱动。
- 使用具体数字和百分比，不说"花了不少"
- 发现异常消费时指出并给出建议
- 语气积极鼓励，不批评用户的消费习惯
- 全部用中文回复`

const MAX_TOOL_ROUNDS = 5

export class AIAnalysisService {
  private ledgerId: number

  constructor(ledgerId: number) {
    this.ledgerId = ledgerId
  }

  private client() { return aiConfigService.createClient() }

  /**
   * 生成月度财务报告（JSON Mode，不走 Tool）
   */
  async generateMonthlyReport(yearMonth: string, onChunk: (text: string) => void): Promise<string> {
    const c = this.client()
    if (!c) throw new Error('未配置 API Key')

    const toolService = new AIToolService(this.ledgerId)
    const summary = toolService.executeTool('get_monthly_summary', { yearMonth })
    const breakdown = toolService.executeTool('get_category_breakdown', { yearMonth, type: 'expense' })
    const topItems = toolService.executeTool('get_top_entries', { yearMonth, type: 'expense', limit: 10 })
    const prevYM = this.prevMonth(yearMonth)
    const compare = toolService.executeTool('compare_months', { currentYM: yearMonth, prevYM: prevYM })

    const userPrompt = `请根据以下数据，生成一份 ${yearMonth} 月度消费分析报告（JSON 格式）。

=== 收支总览 ===
${summary}

=== 消费分类排行 ===
${breakdown}

=== 大额支出 TOP 10 ===
${topItems}

=== 与上月对比 (${prevYM}) ===
${compare}

请返回如下 JSON：
{
  "overview": "150字以内的月度收支概述",
  "leadingCategory": {"name": "最大支出分类名", "percentage": 百分比数字},
  "changeFromLastMonth": "与上月对比的一句话，含具体变化百分比",
  "insights": ["发现1", "发现2", "发现3"],
  "suggestions": ["建议1", "建议2"],
  "score": "分数1-100"
}
只返回JSON，不要其他文字。`

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]
    return c.chatStream(messages, onChunk, 0.3)
  }

  /**
   * 自由问答（带 Tools 的对话循环）
   */
  async chat(
    history: ChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const c = this.client()
    if (!c) throw new Error('未配置 API Key')

    const toolService = new AIToolService(this.ledgerId)
    const tools = toolService.getToolDefs()

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
    ]

    let round = 0
    while (round < MAX_TOOL_ROUNDS) {
      round++
      const res = await c.chatWithTools(messages, tools, 0.3)

      // 如果 AI 不需要调 Tool，直接流式输出
      if (res.finishReason !== 'tool_calls' || res.toolCalls.length === 0) {
        if (res.content) {
          onChunk(res.content)
          aiConfigService.appendRecord('assistant', res.content)
          return res.content
        }
        // content 为空但也不是 tool_call，用流式再请求一次拿到完整回复
        const streamMessages = messages.slice()
        return c.chatStream(streamMessages, onChunk, 0.3, signal)
      }

      // 处理 Tool Calls
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: res.toolCalls,
      })
      const toolResults = toolService.handleToolCalls(res.toolCalls)
      messages.push(...toolResults)
    }

    // 超过最大轮次，流式获取最终回复
    return c.chatStream(messages, onChunk, 0.3, signal)
  }

  /**
   * 解读统计数据（StatisticsView 入口）
   */
  async analyzeStats(statsData: object, onChunk: (text: string) => void): Promise<string> {
    const c = this.client()
    if (!c) throw new Error('未配置 API Key')
    const userPrompt = `请分析以下统计数据并给出解读：\n${JSON.stringify(statsData, null, 2)}\n\n请指出：1) 主要消费趋势 2) 异常数据点 3) 优化建议`
    return c.chatStream([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ], onChunk, 0.3)
  }

  private prevMonth(ym: string): string {
    const [y, m] = ym.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }
}
```

### 7.5 aiController.ts — IPC 通道

```typescript
// src/main/controller/aiController.ts
import { ipcMain, BrowserWindow } from 'electron'
import { aiConfigService } from '../service/ai/aiConfigService'
import { AIAnalysisService } from '../service/ai/aiAnalysisService'
import { logger } from '../utils/logger'
import type { ChatMessage } from '../service/ai/deepseekClient'

export function registerAIController(): void {
  // ===== 配置管理 =====

  ipcMain.handle('ai:config:save', async (_event, { key, model }: { key: string; model: string }) => {
    try {
      aiConfigService.saveApiKey(key)
      aiConfigService.saveModel(model)
      return { code: 0, data: null, msg: '保存成功' }
    } catch (e: any) {
      return { code: -1, data: null, msg: e.message }
    }
  })

  ipcMain.handle('ai:config:get', async () => {
    return {
      code: 0,
      data: { hasKey: aiConfigService.hasKey(), model: aiConfigService.getModel() },
      msg: 'ok',
    }
  })

  ipcMain.handle('ai:config:test', async () => {
    try {
      const ok = await aiConfigService.testConnection()
      return { code: ok ? 0 : -1, data: null, msg: ok ? '连接成功' : '连接失败，请检查 API Key' }
    } catch (e: any) {
      return { code: -1, data: null, msg: e.message }
    }
  })

  // ===== 聊天（streaming） =====

  ipcMain.handle('ai:chat', async (event, { messages, ledgerId }: { messages: ChatMessage[]; ledgerId: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { code: -1, data: null, msg: '窗口未找到' }
    try {
      // 加载历史记录（若当前没有会话则创建新会话）
      aiConfigService.loadHistory()
      if (aiConfigService.getCurrentRecords().length === 0) {
        aiConfigService.createSession(ledgerId)
      }

      // 把用户消息追加到历史
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'user') {
        aiConfigService.appendRecord('user', lastMsg.content || '')
      }

      const service = new AIAnalysisService(ledgerId)
      const history = messages.slice(0, -1)
      const result = await service.chat(history, (chunk: string) => {
        win.webContents.send('ai:chat:chunk', chunk)
      })
      aiConfigService.persistHistory()
      win.webContents.send('ai:chat:done', result)
      return { code: 0, data: null, msg: 'ok' }
    } catch (e: any) {
      logger.error(`AI 对话失败: ${e.message}`)
      win.webContents.send('ai:chat:error', e.message)
      return { code: -1, data: null, msg: e.message }
    }
  })

  // ===== 月度报告 =====

  ipcMain.handle('ai:report:monthly', async (event, { yearMonth, ledgerId }: { yearMonth: string; ledgerId: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { code: -1, data: null, msg: '窗口未找到' }
    try {
      const service = new AIAnalysisService(ledgerId)
      const result = await service.generateMonthlyReport(yearMonth, (chunk: string) => {
        win.webContents.send('ai:report:chunk', chunk)
      })
      win.webContents.send('ai:report:done', result)
      return { code: 0, data: null, msg: 'ok' }
    } catch (e: any) {
      logger.error(`AI 报告生成失败: ${e.message}`)
      win.webContents.send('ai:report:error', e.message)
      return { code: -1, data: null, msg: e.message }
    }
  })

  // ===== 统计解读 =====

  ipcMain.handle('ai:report:stats', async (event, { statsData, ledgerId }: { statsData: object; ledgerId: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { code: -1, data: null, msg: '窗口未找到' }
    try {
      const service = new AIAnalysisService(ledgerId)
      const result = await service.analyzeStats(statsData, (chunk: string) => {
        win.webContents.send('ai:report:chunk', chunk)
      })
      win.webContents.send('ai:report:done', result)
      return { code: 0, data: null, msg: 'ok' }
    } catch (e: any) {
      logger.error(`AI 统计解读失败: ${e.message}`)
      win.webContents.send('ai:report:error', e.message)
      return { code: -1, data: null, msg: e.message }
    }
  })

  // ===== 退出时持久化 =====

  ipcMain.handle('ai:chat:persist', async () => {
    aiConfigService.persistHistory()
    return { code: 0, data: null, msg: 'ok' }
  })

  // ===== 清空历史 =====

  ipcMain.handle('ai:chat:clear', async () => {
    aiConfigService.clearSession()
    return { code: 0, data: null, msg: '聊天历史已清空' }
  })
}
```

### 7.6 Preload 桥接

```typescript
// src/preload/index.ts (新增部分)

contextBridge.exposeInMainWorld('aiAPI', {
  saveConfig: (config: { key: string; model: string }) =>
    ipcRenderer.invoke('ai:config:save', config),
  getConfig: () =>
    ipcRenderer.invoke('ai:config:get'),
  testConnection: () =>
    ipcRenderer.invoke('ai:config:test'),

  chat: (params: { messages: ChatMessage[]; ledgerId: number }) =>
    ipcRenderer.invoke('ai:chat', params),
  reportMonthly: (params: { yearMonth: string; ledgerId: number }) =>
    ipcRenderer.invoke('ai:report:monthly', params),
  reportStats: (params: { statsData: object; ledgerId: number }) =>
    ipcRenderer.invoke('ai:report:stats', params),
  persistHistory: () =>
    ipcRenderer.invoke('ai:chat:persist'),
  clearHistory: () =>
    ipcRenderer.invoke('ai:chat:clear'),

  // Streaming 事件监听
  onChatChunk: (cb: (chunk: string) => void) => {
    ipcRenderer.on('ai:chat:chunk', (_e, chunk) => cb(chunk))
  },
  onChatDone: (cb: (result: string) => void) => {
    ipcRenderer.on('ai:chat:done', (_e, result) => cb(result))
  },
  onChatError: (cb: (err: string) => void) => {
    ipcRenderer.on('ai:chat:error', (_e, err) => cb(err))
  },
  onReportChunk: (cb: (chunk: string) => void) => {
    ipcRenderer.on('ai:report:chunk', (_e, chunk) => cb(chunk))
  },
  onReportDone: (cb: (result: string) => void) => {
    ipcRenderer.on('ai:report:done', (_e, result) => cb(result))
  },
  onReportError: (cb: (err: string) => void) => {
    ipcRenderer.on('ai:report:error', (_e, err) => cb(err))
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:chat:chunk')
    ipcRenderer.removeAllListeners('ai:chat:done')
    ipcRenderer.removeAllListeners('ai:chat:error')
    ipcRenderer.removeAllListeners('ai:report:chunk')
    ipcRenderer.removeAllListeners('ai:report:done')
    ipcRenderer.removeAllListeners('ai:report:error')
  },
})

// 类型声明 (src/preload/index.d.ts 新增)
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface AIAPI {
  saveConfig(config: { key: string; model: string }): Promise<ApiResponse<null>>
  getConfig(): Promise<ApiResponse<{ hasKey: boolean; model: string }>>
  testConnection(): Promise<ApiResponse<null>>
  chat(params: { messages: ChatMessage[]; ledgerId: number }): Promise<ApiResponse<null>>
  reportMonthly(params: { yearMonth: string; ledgerId: number }): Promise<ApiResponse<null>>
  reportStats(params: { statsData: object; ledgerId: number }): Promise<ApiResponse<null>>
  persistHistory(): Promise<ApiResponse<null>>
  clearHistory(): Promise<ApiResponse<null>>
  onChatChunk(cb: (chunk: string) => void): void
  onChatDone(cb: (result: string) => void): void
  onChatError(cb: (err: string) => void): void
  onReportChunk(cb: (chunk: string) => void): void
  onReportDone(cb: (result: string) => void): void
  onReportError(cb: (err: string) => void): void
  removeAllListeners(): void
}
```

## 8. IPC 通道汇总

| 通道 | 方向 | 参数 | 返回 |
|------|------|------|------|
| `ai:config:save` | renderer → main | `{ key, model }` | `{ code, msg }` |
| `ai:config:get` | renderer → main | — | `{ code, data: { hasKey, model } }` |
| `ai:config:test` | renderer → main | — | `{ code, msg }` |
| `ai:chat` | renderer → main | `{ messages, ledgerId }` | streaming via events |
| `ai:report:monthly` | renderer → main | `{ yearMonth, ledgerId }` | streaming via events |
| `ai:report:stats` | renderer → main | `{ statsData, ledgerId }` | streaming via events |
| `ai:chat:persist` | renderer → main | — | `{ code, msg }` |
| `ai:chat:clear` | renderer → main | — | `{ code, msg }` |

## 9. 前端页面设计

### 9.1 设置弹窗（点击侧边栏齿轮图标）

```
┌─────────────────────────────────┐
│  设置                        ✕  │
├─────────────────────────────────┤
│  AI 助手                        │
│                                 │
│  API Key                        │
│  ┌─────────────────────────┐   │
│  │ sk-xxxxxxxxxxxxxxxxxxx   │   │
│  └─────────────────────────┘   │
│                                 │
│  模型选择                       │
│  ○ deepseek-v4-flash (免费)    │
│  ○ deepseek-v4-pro (更强)      │
│                                 │
│  [测试连接]                    │
│  ✓ 连接成功                     │
│                                 │
│  [取消]  [保存]                │
└─────────────────────────────────┘
```

### 9.2 AI 助手面板（Dashboard 右侧或浮动按钮）

- 聊天窗口，支持 Markdown 渲染
- 输入框 + 发送按钮
- Streaming 逐字输出
- 历史记录持久化到 `userData/ai/chat-history.json`，下次打开应用自动恢复
- 每个回复下方有推荐问题快捷按钮
- 「清空对话」按钮 → 调用 `ai:chat:clear`

### 9.3 月度报告卡片（Dashboard 顶部）

- 「生成 X 月报告」按钮
- 生成中显示 skeleton loading
- 生成后展示：收入/支出总结 + 分类健康度评分 + AI 评语 + 建议列表

### 9.4 AI 解读入口（StatisticsView 右上角）

- 「AI 解读图表」按钮
- 点击后自动将当前筛选条件的统计数据发给 AI
- AI 返回对当前图表的文字解读

## 10. System Prompt 设计

```text
你是个人财务管理助手，帮用户分析记账数据。
回复风格：简洁、友好、数据驱动。
- 使用具体的数字和百分比，不要说"花了很多"
- 发现异常消费时指出并给出建议
- 语气积极鼓励，不要批评用户的消费习惯
- 全部用中文回复
```

## 11. 频率限制

本地限制（防止用户端异常调用）：

- 每分钟最多 10 次请求（滑动时间窗口）
- 相同参数请求 30s 内不重复发起
- 超限时返回友好提示，显示剩余等待时间

## 12. 隐私保护

| 措施 | 说明 |
|------|------|
| 不传交易详情文字 | 只传统计数据（数字 + 分类名），不传「星巴克咖啡」等描述 |
| API Key 加密存储 | `safeStorage.encryptString()` 加密后存 `userData/ai/config.json` |
| 聊天历史本地存储 | 存 `userData/ai/chat-history.json`，不经过任何网络传输 |
| 本地日志脱敏 | 不打印 API Key 明文到日志 |

## 13. 聊天历史存储设计

| 项目 | 说明 |
|------|------|
| 存储位置 | `userData/ai/chat-history.json` |
| 数据格式 | `ChatHistory[]` 数组，每条包含 `sessionId`、`records`、`ledgerId` |
| 最大记录数 | 单次会话 ≤ 500 条 |
| 最大会话数 | 保留最近 20 个会话 |
| 自动加载 | 主进程启动时自动加载最近一次会话 |
| 自动持久化 | 每次对话结束自动写入磁盘 |
| 清空机制 | 用户可手动清空，应用退出自动保留 |

> 聊天历史与 API Key 分开存储：Key 是 `encryptedKey: base64(加密后二进制)`，历史是明文 JSON。

## 14. 实施步骤

| 步骤 | 内容 | 预计工时 |
|------|------|----------|
| 1 | `App.vue` 点击齿轮 → 打开 `SettingsDialog.vue` | 1h |
| 2 | `SettingsDialog.vue` 实现 API Key 输入 + 模型选择 + 测试连接 | 1.5h |
| 3 | `aiConfigService.ts` — API Key 安全存储（见 7.2 代码） | 1h |
| 4 | `deepseekClient.ts` — HTTPS + streaming 封装（见 7.1 代码） | 2h |
| 5 | `aiToolService.ts` — 6 个 Tool 定义 + SQL（见 7.3 代码） | 2h |
| 6 | `aiAnalysisService.ts` — 编排层（见 7.4 代码） | 2h |
| 7 | `aiController.ts` + preload 桥接 + 类型声明（见 7.5/7.6 代码） | 1h |
| 8 | AI 助手面板 `AIChatPanel.vue`（聊天 + streaming + 历史加载） | 3h |
| 9 | 月度报告卡片（Dashboard 顶部） | 2h |
| 10 | StatisticsView AI 入口 | 1h |
| 11 | 测试 + 调优 | 2h |
| **合计** | | **约 2.5 天** |

## 15. 不做的事情

- ❌ 不实现用户注册/登录（本地单用户）
- ❌ 不接入语音输入
- ❌ 不做多人协作记账分析
- ❌ 不接入其他 AI 模型（先聚焦 DeepSeek）

## 16. AI 调用调试日志框架

`utils/logger.ts` 里原有的 AI 相关日志会截断内容（如 `slice(0, 80)`）、和 SQL/业务日志混在一起，排查 tool-calling、返回异常等问题时信息不够。为此新增独立的调试日志模块 `utils/aiLogger.ts`，专门记录一次对话从请求到工具调用再到最终响应的完整链路。

### 16.1 输出位置与格式

- 文件：`<userData>/logs/ai-chat.log`（与通用 `app.log` 分开），单文件 20MB、滚动保留 10 份
- 格式：JSON Lines，每行一条完整 JSON，不做内容截断，可用 `jq`/脚本按字段过滤
- 初始化：`initAILogTransport()`，在 `main/index.ts` 的 `app.whenReady()` 中与 `initFileTransport()` 一起调用

### 16.2 关联 ID：requestId

用户发一条消息触发的一次 `AIAnalysisService.chat()` 调用（可能包含多轮 tool-calling）对应一个 `requestId`（`crypto.randomUUID()`），在 `AIAnalysisService` 内生成，显式作为 `AILogContext` 参数逐层传递给 `DeepSeekClient` 和 `AIToolService` 的每一次调用：

```ts
interface AILogContext {
  requestId: string   // 一次用户请求的关联 ID
  sessionId?: string  // 对话会话 ID
  ledgerId?: number
  round?: number       // tool-calling 循环轮次，从 1 开始
}
```

按 `requestId` 过滤即可看到一次提问触发的全部请求/工具调用/响应；按 `sessionId` 过滤可以看到一个对话会话里的所有请求。

### 16.3 记录的事件

| event | 记录位置 | 内容 |
|---|---|---|
| `request_start` | `deepseekClient.ts` 的 `chat`/`chatStream`/`chatWithTools` 调用前 | 完整 `model`/`temperature`/`messages` 数组、`tools` 名称列表 |
| `request_end` | 上述方法拿到响应后 | `finishReason`、完整 `content`、完整 `toolCalls`（含解析后的 `arguments`）、`usage`（token 数）、耗时 |
| `tool_call` | `aiToolService.ts` 的 `handleToolCalls` | 工具名、解析后的入参对象 |
| `tool_result` | 同上，工具执行完毕后 | 工具名、耗时、完整返回结果（JSON 解析后的对象） |
| `error` | 各阶段 catch 块 | `phase`、错误信息、堆栈 |

### 16.4 使用方式

调试时打开 `<userData>/logs/ai-chat.log`，搜索出问题那次对话的 `sessionId` 或最近的 `requestId`，即可看到：

1. 发给 DeepSeek 的完整 messages（含 system prompt、历史消息、工具返回塞回去的 tool 消息）与 tools 定义
2. DeepSeek 原始返回的 `finish_reason`/`content`/`tool_calls`/`usage`
3. 每一轮工具调用的入参与返回结果
4. 最终流式输出的完整文本

`app.log` 中保留原有的单行摘要日志（供日常快速扫描），`ai-chat.log` 提供无截断的完整细节（供深入排查）。

