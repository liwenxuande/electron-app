import { LedgerRepository } from '../repository/ledgerRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'
import { ApiResponse } from '../types'

export class LedgerService {
  private repository: LedgerRepository
  private dbManager: DbManager

  constructor(repository: LedgerRepository, dbManager: DbManager) {
    this.repository = repository
    this.dbManager = dbManager
  }

  private success<T>(data: T, msg: string = '操作成功'): ApiResponse<T> {
    return { code: 0, data, msg }
  }

  private fail(msg: string): ApiResponse<null> {
    return { code: -1, data: null, msg }
  }

  getAllLedgers(): ApiResponse {
    try {
      const list = this.repository.selectAll()
      return this.success(list, '查询成功')
    } catch (error: unknown) {
      logger.error(`查询账本列表失败: ${error.message}`)
      return this.fail(`查询失败: ${error.message}`)
    }
  }

  async createLedger(name: string, description: string = ''): Promise<ApiResponse> {
    try {
      if (!name || name.trim() === '') {
        return this.fail('账本名称不能为空')
      }
      await this.dbManager.transaction(() => {
        this.repository.insert(name.trim(), description)
      })
      logger.info(`新增账本成功: ${name}`)
      return this.success(null, '新增成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`新增账本失败: ${errMsg}`)
      return this.fail(`新增失败: ${errMsg}`)
    }
  }

  async updateLedger(id: number, name: string, description: string): Promise<ApiResponse> {
    try {
      if (!name || name.trim() === '') {
        return this.fail('账本名称不能为空')
      }
      const existing = this.repository.selectById(id)
      if (!existing) return this.fail('该账本不存在')

      await this.dbManager.transaction(() => {
        this.repository.update(id, name.trim(), description)
      })
      logger.info(`编辑账本成功: id=${id}`)
      return this.success(null, '编辑成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`编辑账本失败: ${errMsg}`)
      return this.fail(`编辑失败: ${errMsg}`)
    }
  }

  async deleteLedger(id: number): Promise<ApiResponse> {
    try {
      if (id === 1) return this.fail('默认账本不可删除')

      const existing = this.repository.selectById(id)
      if (!existing) return this.fail('该账本不存在')

      await this.dbManager.run('DELETE FROM ledger WHERE id = ?', [id])
      logger.info(`删除账本成功: id=${id}`)
      return this.success(null, '删除成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`删除账本失败: ${errMsg}`)
      return this.fail(`删除失败: ${errMsg}`)
    }
  }
}
