import { CategoryRepository } from '../repository/categoryRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'
import { ApiResponse } from '../types'

export class CategoryService {
  private repository: CategoryRepository
  private dbManager: DbManager

  constructor(repository: CategoryRepository, dbManager: DbManager) {
    this.repository = repository
    this.dbManager = dbManager
  }

  private success<T>(data: T, msg: string = '操作成功'): ApiResponse<T> {
    return { code: 0, data, msg }
  }

  private fail(msg: string): ApiResponse<null> {
    return { code: -1, data: null, msg }
  }

  getAllCategories(): ApiResponse {
    try {
      const list = this.repository.selectAll()
      return this.success(list, '查询成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`查询分类列表失败: ${errMsg}`)
      return this.fail(`查询失败: ${errMsg}`)
    }
  }

  getCategoriesByType(type: 'income' | 'expense'): ApiResponse {
    try {
      const list = this.repository.selectByType(type)
      return this.success(list, '查询成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`查询分类列表失败: ${errMsg}`)
      return this.fail(`查询失败: ${errMsg}`)
    }
  }

  async createCategory(name: string, type: string, icon: string = '', sortOrder: number = 0): Promise<ApiResponse> {
    try {
      if (!name || name.trim() === '') {
        return this.fail('分类名称不能为空')
      }
      if (type !== 'income' && type !== 'expense') {
        return this.fail('分类类型无效')
      }
      const existing = this.repository.findByName(name.trim(), type)
      if (existing) {
        return this.fail('该分类已存在')
      }
      await this.dbManager.transaction(() => {
        this.repository.insert(name.trim(), type, icon, sortOrder)
      })
      logger.info(`新增分类成功: ${name}`)
      return this.success(null, '新增成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`新增分类失败: ${errMsg}`)
      return this.fail(`新增失败: ${errMsg}`)
    }
  }

  async updateCategory(id: number, name: string, icon: string, sortOrder: number): Promise<ApiResponse> {
    try {
      if (!name || name.trim() === '') {
        return this.fail('分类名称不能为空')
      }
      const existing = this.repository.selectById(id)
      if (!existing) {
        return this.fail('该分类不存在')
      }
      await this.dbManager.transaction(() => {
        this.repository.update(id, name.trim(), icon, sortOrder)
      })
      logger.info(`编辑分类成功: id=${id}`)
      return this.success(null, '编辑成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`编辑分类失败: ${errMsg}`)
      return this.fail(`编辑失败: ${errMsg}`)
    }
  }

  async deleteCategory(id: number): Promise<ApiResponse> {
    try {
      const existing = this.repository.selectById(id)
      if (!existing) {
        return this.fail('该分类不存在')
      }
      await this.dbManager.transaction(() => {
        this.repository.deleteById(id)
      })
      logger.info(`删除分类成功: id=${id}`)
      return this.success(null, '删除成功')
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      if (errMsg.includes('FOREIGN KEY constraint failed')) {
        return this.fail('该分类下有交易记录，无法删除，请先删除相关交易')
      }
      logger.error(`删除分类失败: ${errMsg}`)
      return this.fail(`删除失败: ${errMsg}`)
    }
  }
}
