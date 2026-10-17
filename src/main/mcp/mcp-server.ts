import http from 'http'
import { logger } from '../utils/logger'
import { TransactionService, TransactionInput, ListParams } from '../service/transactionService'
import { TransactionRepository } from '../repository/transactionRepository'
import { CategoryRepository } from '../repository/categoryRepository'
import { CategoryService } from '../service/categoryService'
import { LedgerService } from '../service/ledgerService'
import { LedgerRepository } from '../repository/ledgerRepository'
import DbManager from '../db/database'
import { ApiResponse } from '../types'

let httpServer: http.Server | null = null
let currentPort: number | null = null
let lastError: string | null = null

function dispatchTool(
  tool: string,
  args: Record<string, unknown>,
  txService: TransactionService,
  ledgerService: LedgerService,
  categoryService: CategoryService
): Promise<ApiResponse<unknown>> | ApiResponse<unknown> {
  switch (tool) {
    case 'list_transactions':
      return txService.getList(args as unknown as ListParams)
    case 'get_transaction':
      return txService.getById(args.id as number)
    case 'create_transaction':
      return txService.create(args as unknown as TransactionInput)
    case 'update_transaction':
      return txService.update(args.id as number, args as unknown as TransactionInput)
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

function createServer(): http.Server {
  const dbManager = DbManager.getInstance()
  const txService = new TransactionService(
    new TransactionRepository(dbManager),
    new CategoryRepository(dbManager),
    dbManager
  )
  const ledgerService = new LedgerService(new LedgerRepository(dbManager), dbManager)
  const categoryService = new CategoryService(new CategoryRepository(dbManager), dbManager)

  return http.createServer((req, res) => {
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
}

function listen(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = createServer()

    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener('listening', onListening)
      lastError = err.code === 'EADDRINUSE'
        ? `端口 ${port} 已被占用`
        : err.message
      reject(new Error(lastError))
    }

    const onListening = () => {
      server.removeListener('error', onError)
      server.on('error', (err: Error) => {
        lastError = err.message
        logger.error(`[MCP] 服务运行异常: ${err.message}`)
      })
      resolve(server)
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, '127.0.0.1')
  })
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve())
    server.closeAllConnections?.()
  })
}

/**
 * 启动 MCP HTTP 服务。
 * 端口变化时先在新端口启动，成功后再关闭旧实例；失败时旧实例保持运行。
 */
export async function startMCPServer(port: number): Promise<void> {
  if (httpServer && currentPort === port) {
    lastError = null
    return
  }

  const server = await listen(port)
  const previous = httpServer
  const previousPort = currentPort

  httpServer = server
  currentPort = port
  lastError = null
  logger.info(`MCP HTTP 服务已启动: http://127.0.0.1:${port}`)

  if (previous && previousPort !== null) {
    await closeServer(previous)
    logger.info(`MCP 旧服务已停止: http://127.0.0.1:${previousPort}`)
  }
}

/**
 * 关闭 MCP HTTP 服务。
 */
export async function stopMCPServer(): Promise<void> {
  const server = httpServer
  httpServer = null
  currentPort = null
  if (!server) return
  await closeServer(server)
  logger.info('MCP HTTP 服务已关闭')
}

export function getMCPStatus(): { running: boolean; port: number | null; error: string | null } {
  return {
    running: !!httpServer?.listening,
    port: currentPort,
    error: lastError,
  }
}
