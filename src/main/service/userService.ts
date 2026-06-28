import dayjs from 'dayjs'
import { UserRepository } from '../repository/userRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'

/**
 * ③ Service业务层 —— User模块
 * 职责：参数校验、事务处理、数据格式化、统一返回 {code, data, msg}
 */

/** 统一返回格式 */
export interface ApiResponse<T = any> {
  code: number    // 0 成功, -1 失败
  data: T
  msg: string
}

/** 用户输入数据结构 */
export interface UserInput {
  name: string
  phone: string
  address: string
}

/** 列表查询参数 */
export interface ListParams {
  searchName?: string
  page?: number
  pageSize?: number
}

export class UserService {
  private repository: UserRepository
  private dbManager: DbManager

  constructor(repository: UserRepository, dbManager: DbManager) {
    this.repository = repository
    this.dbManager = dbManager
  }

  /**
   * 参数校验
   * @returns 校验通过返回 null，失败返回错误消息字符串
   */
  validateUserInput(data: UserInput): string | null {
    const { name, phone, address } = data

    if (!name || name.trim() === '') {
      return '姓名不能为空'
    }
    if (name.length > 50) {
      return '姓名长度不能超过50个字符'
    }
    if (!phone || phone.trim() === '') {
      return '手机号不能为空'
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return '手机号格式不正确（11位，1开头）'
    }
    if (!address || address.trim() === '') {
      return '地址不能为空'
    }
    if (address.length > 200) {
      return '地址长度不能超过200个字符'
    }

    return null // 校验通过
  }

  /** 成功的返回 */
  private success<T>(data: T, msg: string = '操作成功'): ApiResponse<T> {
    return { code: 0, data, msg }
  }

  /** 失败的返回 */
  private fail(msg: string): ApiResponse<null> {
    return { code: -1, data: null, msg }
  }

  /**
   * 新增用户（事务包裹）
   */
  async createUser(input: UserInput): Promise<ApiResponse> {
    // ① 参数校验
    const validateError = this.validateUserInput(input)
    if (validateError) {
      return this.fail(validateError)
    }

    try {
      const createTime = dayjs().format('YYYY-MM-DD HH:mm:ss')

      // ② 串行写队列 + 事务：保证原子性写入
      await this.dbManager.transaction(() => {
        this.repository.insert(input.name.trim(), input.phone.trim(), input.address.trim(), createTime)
      })

      logger.info(`新增用户成功: ${input.name}`)
      return this.success(null, '新增成功')
    } catch (error: any) {
      logger.error(`新增用户失败: ${error.message}`)
      return this.fail(`新增失败: ${error.message}`)
    }
  }

  /**
   * 编辑用户（事务包裹）
   */
  async updateUser(id: number, input: UserInput): Promise<ApiResponse> {
    // ① 参数校验
    const validateError = this.validateUserInput(input)
    if (validateError) {
      return this.fail(validateError)
    }

    try {
      // ② 检查记录是否存在
      const existing = this.repository.selectById(id)
      if (!existing) {
        return this.fail('该用户不存在')
      }

      // ③ 事务更新
      await this.dbManager.transaction(() => {
        this.repository.update(id, input.name.trim(), input.phone.trim(), input.address.trim())
      })

      logger.info(`编辑用户成功: id=${id}`)
      return this.success(null, '编辑成功')
    } catch (error: any) {
      logger.error(`编辑用户失败: ${error.message}`)
      return this.fail(`编辑失败: ${error.message}`)
    }
  }

  /**
   * 删除用户（单条语句，不需事务）
   */
  async deleteUser(id: number): Promise<ApiResponse> {
    try {
      const existing = this.repository.selectById(id)
      if (!existing) {
        return this.fail('该用户不存在')
      }

      // 删除走写队列
      await this.dbManager.run('DELETE FROM user WHERE id = ?', [id])

      logger.info(`删除用户成功: id=${id}`)
      return this.success(null, '删除成功')
    } catch (error: any) {
      logger.error(`删除用户失败: ${error.message}`)
      return this.fail(`删除失败: ${error.message}`)
    }
  }

  /**
   * 分页查询用户列表（含模糊搜索）
   */
  getUserList(params: ListParams): ApiResponse {
    try {
      const searchName = params.searchName || ''
      const page = params.page || 1
      const pageSize = params.pageSize || 10

      const result = this.repository.selectList(searchName, page, pageSize)

      return this.success(result, '查询成功')
    } catch (error: any) {
      logger.error(`查询用户列表失败: ${error.message}`)
      return this.fail(`查询失败: ${error.message}`)
    }
  }

  /**
   * 根据ID查询单条用户
   */
  getUserById(id: number): ApiResponse {
    try {
      const user = this.repository.selectById(id)
      if (!user) {
        return this.fail('用户不存在')
      }
      return this.success(user, '查询成功')
    } catch (error: any) {
      logger.error(`查询用户详情失败: ${error.message}`)
      return this.fail(`查询失败: ${error.message}`)
    }
  }
}
