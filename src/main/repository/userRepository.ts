import DbManager from '../db/database'

/**
 * ② Repository仓储层 —— User表
 * 职责：仅编写原生SQL语句，不做任何业务逻辑处理
 * 依赖注入：通过构造函数接收 DbManager 实例
 */

/** 用户数据行接口 */
export interface UserRow {
  id: number
  name: string
  phone: string
  address: string
  create_time: string
}

/** 分页查询结果 */
export interface PaginatedResult {
  list: UserRow[]
  total: number
}

export class UserRepository {
  private dbManager: DbManager

  constructor(dbManager: DbManager) {
    this.dbManager = dbManager
  }

  /**
   * 新增用户
   * @returns 插入结果（含 lastInsertRowid）
   */
  insert(name: string, phone: string, address: string, createTime: string) {
    return this.dbManager.getDb().prepare(`
      INSERT INTO user (name, phone, address, create_time)
      VALUES (?, ?, ?, ?)
    `).run(name, phone, address, createTime)
  }

  /** 根据ID查询单条用户 */
  selectById(id: number): UserRow | undefined {
    return this.dbManager.get<UserRow>(
      'SELECT * FROM user WHERE id = ?',
      [id]
    )
  }

  /**
   * 分页查询 + 模糊搜索姓名
   * @param searchName 搜索关键字（空字符串表示不筛选）
   * @param page       当前页码（从1开始）
   * @param pageSize   每页条数
   */
  selectList(searchName: string, page: number, pageSize: number): PaginatedResult {
    const offset = (page - 1) * pageSize
    const likePattern = `%${searchName}%`

    const totalRow = this.dbManager.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM user WHERE name LIKE ?`,
      [likePattern]
    )
    const total = totalRow ? totalRow.count : 0

    const list = this.dbManager.all<UserRow>(
      `SELECT * FROM user WHERE name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [likePattern, pageSize, offset]
    )

    return { list, total }
  }

  /**
   * 更新用户
   * @returns 更新结果
   */
  update(id: number, name: string, phone: string, address: string) {
    return this.dbManager.getDb().prepare(`
      UPDATE user SET name = ?, phone = ?, address = ? WHERE id = ?
    `).run(name, phone, address, id)
  }

  /** 根据ID删除用户 */
  deleteById(id: number) {
    return this.dbManager.getDb().prepare('DELETE FROM user WHERE id = ?').run(id)
  }
}
