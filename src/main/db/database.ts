import Database from 'better-sqlite3'
import PQueue from 'p-queue'
import { logger } from '../utils/logger'

/**
 * ① DB底层封装层 —— 全局单例
 * 职责：SQLite连接管理、WAL模式开启、建表初始化、通用增删改查封装、串行写队列
 */
class DbManager {
  /** 单例实例 */
  private static instance: DbManager | null = null

  /** SQLite数据库连接 */
  private db: Database.Database | null = null

  /** 串行写队列（concurrency=1），避免 database is locked */
  private writeQueue: PQueue

  private constructor() {
    this.writeQueue = new PQueue({ concurrency: 1 })
  }

  /** 获取全局唯一单例 */
  static getInstance(): DbManager {
    if (!DbManager.instance) {
      DbManager.instance = new DbManager()
    }
    return DbManager.instance
  }

  /**
   * 初始化数据库：创建连接、开启WAL、建表
   * @param dbPath 数据库文件路径（通常为 userData/data.db）
   */
  init(dbPath: string): void {
    this.db = new Database(dbPath)

    // 开启 WAL 模式，优化并发读写性能
    this.db.pragma('journal_mode = WAL')

    // 创建 user 表（如果不存在）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        phone       TEXT    NOT NULL,
        address     TEXT    NOT NULL,
        create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `)

    logger.info('数据库初始化完成，WAL模式已开启')
  }

  /** 获取数据库实例（内部使用，确保已初始化） */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('数据库尚未初始化，请先调用 init()')
    }
    return this.db
  }

  /**
   * 写入操作（INSERT/UPDATE/DELETE）—— 进入串行写队列
   * @param sql     SQL语句，使用 ? 占位符
   * @param params  参数数组
   * @returns       执行结果 { changes, lastInsertRowid }
   */
  async run(sql: string, params: any[] = []): Promise<Database.RunResult> {
    return this.writeQueue.add(() => {
      logger.info(`[SQL] ${sql} | params: ${JSON.stringify(params)}`)
      return this.getDb().prepare(sql).run(...params)
    })
  }

  /**
   * 查询单行数据（只读操作，不走队列）
   * @param sql     SQL语句，使用 ? 占位符
   * @param params  参数数组
   * @returns       查询结果或 undefined
   */
  get<T = Record<string, any>>(sql: string, params: any[] = []): T | undefined {
    logger.info(`[SQL] ${sql} | params: ${JSON.stringify(params)}`)
    return this.getDb().prepare(sql).get(...params) as T | undefined
  }

  /**
   * 查询多行数据（只读操作，不走队列）
   * @param sql     SQL语句，使用 ? 占位符
   * @param params  参数数组
   * @returns       查询结果数组
   */
  all<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
    logger.info(`[SQL] ${sql} | params: ${JSON.stringify(params)}`)
    return this.getDb().prepare(sql).all(...params) as T[]
  }

  /**
   * 事务包装（走串行写队列，保证原子性）
   * @param fn 在事务中执行的函数，接收 db 实例
   * @returns  函数返回值
   */
  async transaction<T>(fn: (db: Database.Database) => T): Promise<T> {
    return this.writeQueue.add(() => {
      const db = this.getDb()
      const txn = db.transaction(() => {
        return fn(db)
      })
      return txn()
    })
  }
}

export default DbManager
