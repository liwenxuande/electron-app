import * as electron from 'electron/main'
const { ipcMain } = electron
import { CategoryService } from '../service/categoryService'
import { CategoryRepository } from '../repository/categoryRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'

export function registerCategoryController(): void {
  const dbManager = DbManager.getInstance()
  const repository = new CategoryRepository(dbManager)
  const service = new CategoryService(repository, dbManager)

  ipcMain.handle('category:list', async (_event, type?: string) => {
    try {
      logger.info(`[IPC] category:list 收到请求, type=${type}`)
      if (type === 'income' || type === 'expense') {
        return service.getCategoriesByType(type)
      }
      return service.getAllCategories()
    } catch (error: any) {
      logger.error(`[IPC] category:list 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('category:create', async (_event, name: string, type: string, icon?: string, sortOrder?: number) => {
    try {
      logger.info(`[IPC] category:create 收到请求: name=${name}, type=${type}`)
      return await service.createCategory(name, type, icon || '', sortOrder || 0)
    } catch (error: any) {
      logger.error(`[IPC] category:create 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('category:update', async (_event, id: number, name: string, icon: string, sortOrder: number) => {
    try {
      logger.info(`[IPC] category:update 收到请求: id=${id}, name=${name}`)
      return await service.updateCategory(id, name, icon, sortOrder)
    } catch (error: any) {
      logger.error(`[IPC] category:update 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  ipcMain.handle('category:delete', async (_event, id: number) => {
    try {
      logger.info(`[IPC] category:delete 收到请求: id=${id}`)
      return await service.deleteCategory(id)
    } catch (error: any) {
      logger.error(`[IPC] category:delete 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  logger.info('Category IPC控制器注册完成')
}
