import Database from 'better-sqlite3'
import PQueue from 'p-queue'
import { logger } from '../utils/logger'

/**
 * ① DB底层封装层 —— 全局单例
 * 职责：SQLite连接管理、WAL模式开启、建表初始化、通用增删改查封装、串行写队列
 */
interface PragmaColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

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

    // 创建 category 分类表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS category (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL,
        type       TEXT    NOT NULL CHECK(type IN ('income','expense')),
        icon       TEXT    DEFAULT '',
        sort_order INTEGER DEFAULT 0
      )
    `)

    // 创建 ledger 账本表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ledger (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        description TEXT    DEFAULT '',
        create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
      )
    `)

    // 预置默认账本（始终确保存在，INSERT OR IGNORE 已存在则跳过）
    this.db.prepare(
      "INSERT OR IGNORE INTO ledger (id, name, description) VALUES (1, ?, ?)"
    ).run('默认账本', '系统默认账本')

    // 数据库迁移：将旧表名 "transaction"（SQL保留字）迁移到 transactions
    const oldTableExists = this.db.prepare(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='transaction'"
    ).get() as { count: number }
    if (oldTableExists.count > 0) {
      this.db.exec('ALTER TABLE "transaction" RENAME TO transactions')
      logger.info('数据库迁移：旧表 "transaction" 已重命名为 transactions')
    }

    // 创建 transactions 记账记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        type            TEXT    NOT NULL CHECK(type IN ('income','expense')),
        amount          REAL    NOT NULL,
        category_id     INTEGER NOT NULL,
        ledger_id       INTEGER NOT NULL DEFAULT 1,
        trans_date      TEXT    NOT NULL,
        description     TEXT    DEFAULT '',
        payment_method  TEXT    DEFAULT '',
        create_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        update_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (category_id) REFERENCES category(id),
        FOREIGN KEY (ledger_id) REFERENCES ledger(id)
      )
    `)

    // 数据库迁移：为旧 transactions 表添加 ledger_id 字段
    const hasLedgerId = this.db.prepare("PRAGMA table_info('transactions')").all() as PragmaColumnInfo[]
    const ledgerIdExists = hasLedgerId.some((col) => col.name === 'ledger_id')
    if (!ledgerIdExists) {
      this.db.exec("ALTER TABLE transactions ADD COLUMN ledger_id INTEGER NOT NULL DEFAULT 1")
      logger.info('数据库迁移：transactions 表已添加 ledger_id 字段')
    }

    // 预置初始分类数据（如果分类表为空）
    const categoryCount = this.db.prepare('SELECT COUNT(*) as count FROM category').get() as { count: number }
    if (categoryCount.count === 0) {
      this.db.exec(`
        INSERT INTO category (name, type, icon, sort_order) VALUES
        ('餐饮', 'expense', 'food', 1),
        ('交通', 'expense', 'transport', 2),
        ('购物', 'expense', 'shopping', 3),
        ('住房', 'expense', 'house', 4),
        ('娱乐', 'expense', 'entertainment', 5),
        ('医疗', 'expense', 'medical', 6),
        ('教育', 'expense', 'education', 7),
        ('通讯', 'expense', 'communication', 8),
        ('日用', 'expense', 'daily', 9),
        ('其他支出', 'expense', 'other-expense', 10),
        ('工资', 'income', 'salary', 1),
        ('奖金', 'income', 'bonus', 2),
        ('兼职', 'income', 'parttime', 3),
        ('理财', 'income', 'investment', 4),
        ('红包', 'income', 'redpacket', 5),
        ('其他收入', 'income', 'other-income', 6)
      `)
      logger.info('预置分类数据已插入')
    }

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
