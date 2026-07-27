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

// 优雅退出处理
process.on('SIGTERM', () => process.exit(0))
