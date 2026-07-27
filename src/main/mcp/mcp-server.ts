import http from 'http'
import { logger } from '../utils/logger'
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
