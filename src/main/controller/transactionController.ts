import * as electron from 'electron/main'
const { ipcMain } = electron
import { TransactionService, TransactionInput, ListParams } from '../service/transactionService'
import { TransactionRepository } from '../repository/transactionRepository'
import { CategoryRepository } from '../repository/categoryRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'

export function registerTransactionController(): void {
  const dbManager = DbManager.getInstance()
  const repository = new TransactionRepository(dbManager)
  const categoryRepository = new CategoryRepository(dbManager)
  const service = new TransactionService(repository, categoryRepository, dbManager)

  ipcMain.handle('transaction:list', async (_event, params: ListParams) => {
    try {
      logger.info(`[IPC] transaction:list 收到请求: ${JSON.stringify(params)}`)
      return service.getList(params)
    } catch (error: any) {
      logger.error(`[IPC] transaction:list 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:getById', async (_event, id: number) => {
    try {
      logger.info(`[IPC] transaction:getById 收到请求: id=${id}`)
      return service.getById(id)
    } catch (error: any) {
      logger.error(`[IPC] transaction:getById 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:create', async (_event, data: TransactionInput) => {
    try {
      logger.info(`[IPC] transaction:create 收到请求: ${JSON.stringify(data)}`)
      return await service.create(data)
    } catch (error: any) {
      logger.error(`[IPC] transaction:create 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:update', async (_event, id: number, data: TransactionInput) => {
    try {
      logger.info(`[IPC] transaction:update 收到请求: id=${id}`)
      return await service.update(id, data)
    } catch (error: any) {
      logger.error(`[IPC] transaction:update 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:delete', async (_event, id: number) => {
    try {
      logger.info(`[IPC] transaction:delete 收到请求: id=${id}`)
      return await service.delete(id)
    } catch (error: any) {
      logger.error(`[IPC] transaction:delete 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:monthlyStats', async (_event, yearMonth: string) => {
    try {
      logger.info(`[IPC] transaction:monthlyStats 收到请求: yearMonth=${yearMonth}`)
      return service.getMonthlyStats(yearMonth)
    } catch (error: any) {
      logger.error(`[IPC] transaction:monthlyStats 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:stats', async (_event, startDate: string, endDate: string, categoryId?: number, ledgerId?: number, keyword?: string) => {
    try {
      logger.info(`[IPC] transaction:stats 收到请求: ${startDate} ~ ${endDate}, ledgerId=${ledgerId}, keyword=${keyword}`)
      return service.getStats(startDate, endDate, categoryId, ledgerId, keyword)
    } catch (error: any) {
      logger.error(`[IPC] transaction:stats 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:importCsv', async (_event, csvText: string, ledgerId?: number) => {
    try {
      logger.info(`[IPC] transaction:importCsv 收到请求, 数据长度=${csvText.length}, ledgerId=${ledgerId}`)
      return await service.importCsv(csvText, ledgerId || 1)
    } catch (error: any) {
      logger.error(`[IPC] transaction:importCsv 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('transaction:topTransactions', async (_event, startDate: string, endDate: string, ledgerId?: number) => {
    try {
      logger.info(`[IPC] transaction:topTransactions 收到请求: ${startDate} ~ ${endDate}, ledgerId=${ledgerId}`)
      return service.getTopTransactions(startDate, endDate, ledgerId)
    } catch (error: any) {
      logger.error(`[IPC] transaction:topTransactions 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  logger.info('Transaction IPC控制器注册完成')
}
