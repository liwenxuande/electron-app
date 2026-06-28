import * as electron from 'electron/main'
const { ipcMain } = electron
import { UserService, UserInput, ListParams } from '../service/userService'
import { UserRepository } from '../repository/userRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'

/**
 * ④ Controller控制器层
 * 职责：注册 ipcMain.handle 通信接口，连接渲染进程与业务层，统一异常捕获
 */

/**
 * 注册所有 User 相关的 IPC 通信接口
 * 使用 ipcMain.handle / ipcRenderer.invoke 实现渲染进程 → 主进程通信
 */
export function registerUserController(): void {
  const dbManager = DbManager.getInstance()
  const repository = new UserRepository(dbManager)
  const service = new UserService(repository, dbManager)

  /** 查询用户列表（分页+模糊搜索） */
  ipcMain.handle('user:list', async (_event, params: ListParams) => {
    try {
      logger.info(`[IPC] user:list 收到请求: ${JSON.stringify(params)}`)
      return service.getUserList(params)
    } catch (error: any) {
      logger.error(`[IPC] user:list 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  /** 根据ID查询单条用户 */
  ipcMain.handle('user:getById', async (_event, id: number) => {
    try {
      logger.info(`[IPC] user:getById 收到请求: id=${id}`)
      return service.getUserById(id)
    } catch (error: any) {
      logger.error(`[IPC] user:getById 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  /** 新增用户 */
  ipcMain.handle('user:create', async (_event, data: UserInput) => {
    try {
      logger.info(`[IPC] user:create 收到请求: ${JSON.stringify(data)}`)
      return await service.createUser(data)
    } catch (error: any) {
      logger.error(`[IPC] user:create 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  /** 编辑用户 */
  ipcMain.handle('user:update', async (_event, id: number, data: UserInput) => {
    try {
      logger.info(`[IPC] user:update 收到请求: id=${id}, data=${JSON.stringify(data)}`)
      return await service.updateUser(id, data)
    } catch (error: any) {
      logger.error(`[IPC] user:update 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  /** 删除用户 */
  ipcMain.handle('user:delete', async (_event, id: number) => {
    try {
      logger.info(`[IPC] user:delete 收到请求: id=${id}`)
      return await service.deleteUser(id)
    } catch (error: any) {
      logger.error(`[IPC] user:delete 异常: ${error.message}`)
      return { code: -1, data: null, msg: `系统异常: ${error.message}` }
    }
  })

  logger.info('User IPC控制器注册完成')
}
