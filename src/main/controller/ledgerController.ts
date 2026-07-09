import * as electron from 'electron/main'
const { ipcMain } = electron
import { LedgerService } from '../service/ledgerService'
import { LedgerRepository } from '../repository/ledgerRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'

export function registerLedgerController(): void {
  const dbManager = DbManager.getInstance()
  const repository = new LedgerRepository(dbManager)
  const service = new LedgerService(repository, dbManager)

  ipcMain.handle('ledger:list', async () => {
    try {
      logger.info('[IPC] ledger:list 收到请求')
      return service.getAllLedgers()
    } catch (error: any) {
      logger.error(`[IPC] ledger:list 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('ledger:create', async (_event, name: string, description?: string) => {
    try {
      logger.info(`[IPC] ledger:create 收到请求: name=${name}`)
      return await service.createLedger(name, description || '')
    } catch (error: any) {
      logger.error(`[IPC] ledger:create 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('ledger:update', async (_event, id: number, name: string, description: string) => {
    try {
      logger.info(`[IPC] ledger:update 收到请求: id=${id}`)
      return await service.updateLedger(id, name, description)
    } catch (error: any) {
      logger.error(`[IPC] ledger:update 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('ledger:delete', async (_event, id: number) => {
    try {
      logger.info(`[IPC] ledger:delete 收到请求: id=${id}`)
      return await service.deleteLedger(id)
    } catch (error: any) {
      logger.error(`[IPC] ledger:delete 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  logger.info('Ledger IPC控制器注册完成')
}
