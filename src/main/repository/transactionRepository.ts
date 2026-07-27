import Database from 'better-sqlite3'
import DbManager from '../db/database'

export interface TransactionRow {
  id: number
  type: 'income' | 'expense'
  amount: number
  category_id: number
  category_name?: string
  ledger_id: number
  ledger_name?: string
  trans_date: string
  description: string
  payment_method: string
  create_time: string
  update_time: string
}

export interface TransactionFilter {
  type?: 'income' | 'expense'
  categoryId?: number
  ledgerId?: number
  startDate?: string
  endDate?: string
  keyword?: string
}

export interface PaginatedTransactions {
  list: TransactionRow[]
  total: number
}

export interface MonthlyStats {
  totalIncome: number
  totalExpense: number
}

export interface DailyStat {
  date: string
  income: number
  expense: number
}

export interface CategoryStat {
  category_id: number
  category_name: string
  type: string
  total: number
  count: number
}

export interface StatsFilter {
  startDate: string
  endDate: string
  categoryId?: number
  ledgerId?: number
  keyword?: string
}

export class TransactionRepository {
  private dbManager: DbManager

  constructor(dbManager: DbManager) {
    this.dbManager = dbManager
  }

  selectList(filter: TransactionFilter, page: number, pageSize: number): PaginatedTransactions {
    const conditions: string[] = []
    const params: any[] = []

    if (filter.type) {
      conditions.push('t.type = ?')
      params.push(filter.type)
    }
    if (filter.categoryId) {
      conditions.push('t.category_id = ?')
      params.push(filter.categoryId)
    }
    if (filter.ledgerId) {
      conditions.push('t.ledger_id = ?')
      params.push(filter.ledgerId)
    }
    if (filter.startDate) {
      conditions.push('t.trans_date >= ?')
      params.push(filter.startDate)
    }
    if (filter.endDate) {
      conditions.push('t.trans_date <= ?')
      params.push(filter.endDate)
    }
    if (filter.keyword) {
      conditions.push('t.description LIKE ?')
      params.push(`%${filter.keyword}%`)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const offset = (page - 1) * pageSize

    const countRow = this.dbManager.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions t ${whereClause}`,
      params
    )
    const total = countRow ? countRow.count : 0

    const list = this.dbManager.all<TransactionRow>(
      `SELECT t.*, c.name as category_name, l.name as ledger_name
       FROM transactions t
       LEFT JOIN category c ON t.category_id = c.id
       LEFT JOIN ledger l ON t.ledger_id = l.id
       ${whereClause}
       ORDER BY t.trans_date DESC, t.id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    return { list, total }
  }

  selectById(id: number): TransactionRow | undefined {
    return this.dbManager.get<TransactionRow>(
      `SELECT t.*, c.name as category_name, l.name as ledger_name
       FROM transactions t
       LEFT JOIN category c ON t.category_id = c.id
       LEFT JOIN ledger l ON t.ledger_id = l.id
       WHERE t.id = ?`,
      [id]
    )
  }

  insert(
    type: string, amount: number, categoryId: number, ledgerId: number, transDate: string,
    description: string, paymentMethod: string, createTime: string
  ): Database.RunResult {
    return this.dbManager.getDb().prepare(`
      INSERT INTO transactions (type, amount, category_id, ledger_id, trans_date, description, payment_method, create_time, update_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(type, amount, categoryId, ledgerId, transDate, description, paymentMethod, createTime, createTime)
  }

  update(
    id: number, type: string, amount: number, categoryId: number, ledgerId: number,
    transDate: string, description: string, paymentMethod: string, updateTime: string
  ): Database.RunResult {
    return this.dbManager.getDb().prepare(`
      UPDATE transactions
      SET type = ?, amount = ?, category_id = ?, ledger_id = ?, trans_date = ?, description = ?, payment_method = ?, update_time = ?
      WHERE id = ?
    `).run(type, amount, categoryId, ledgerId, transDate, description, paymentMethod, updateTime, id)
  }

  deleteById(id: number): Database.RunResult {
    return this.dbManager.getDb().prepare('DELETE FROM transactions WHERE id = ?').run(id)
  }

  getMonthlyStats(yearMonth: string): MonthlyStats {
    const incomeRow = this.dbManager.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE type = 'income' AND strftime('%Y-%m', trans_date) = ?`,
      [yearMonth]
    )
    const expenseRow = this.dbManager.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE type = 'expense' AND strftime('%Y-%m', trans_date) = ?`,
      [yearMonth]
    )
    return {
      totalIncome: incomeRow ? incomeRow.total : 0,
      totalExpense: expenseRow ? expenseRow.total : 0
    }
  }

  getDailyStats(filter: StatsFilter): DailyStat[] {
    const conditions: string[] = ['trans_date >= ?', 'trans_date <= ?']
    const params: any[] = [filter.startDate, filter.endDate]

    if (filter.categoryId) {
      conditions.push('category_id = ?')
      params.push(filter.categoryId)
    }
    if (filter.ledgerId) {
      conditions.push('ledger_id = ?')
      params.push(filter.ledgerId)
    }
    if (filter.keyword) {
      conditions.push('description LIKE ?')
      params.push(`%${filter.keyword}%`)
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ')

    return this.dbManager.all<DailyStat>(
      `SELECT trans_date as date,
              COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
              COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
       FROM transactions
       ${whereClause}
       GROUP BY trans_date
       ORDER BY trans_date ASC`,
      params
    )
  }

  getCategoryStats(filter: StatsFilter, type: string): CategoryStat[] {
    const conditions: string[] = ['t.trans_date >= ?', 't.trans_date <= ?', 't.type = ?']
    const params: any[] = [filter.startDate, filter.endDate, type]

    if (filter.categoryId) {
      conditions.push('t.category_id = ?')
      params.push(filter.categoryId)
    }
    if (filter.ledgerId) {
      conditions.push('t.ledger_id = ?')
      params.push(filter.ledgerId)
    }
    if (filter.keyword) {
      conditions.push('t.description LIKE ?')
      params.push(`%${filter.keyword}%`)
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ')

    return this.dbManager.all<CategoryStat>(
      `SELECT t.category_id, c.name as category_name, t.type,
              SUM(t.amount) as total,
              COUNT(*) as count
       FROM transactions t
       LEFT JOIN category c ON t.category_id = c.id
       ${whereClause}
       GROUP BY t.category_id
       ORDER BY total DESC`,
      params
    )
  }

  getTransactionCount(filter: StatsFilter): number {
    const conditions: string[] = ['trans_date >= ?', 'trans_date <= ?']
    const params: any[] = [filter.startDate, filter.endDate]

    if (filter.categoryId) {
      conditions.push('category_id = ?')
      params.push(filter.categoryId)
    }
    if (filter.ledgerId) {
      conditions.push('ledger_id = ?')
      params.push(filter.ledgerId)
    }
    if (filter.keyword) {
      conditions.push('description LIKE ?')
      params.push(`%${filter.keyword}%`)
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ')
    const row = this.dbManager.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
      params
    )
    return row ? row.count : 0
  }

  getTopTransactions(filter: StatsFilter, type: 'income' | 'expense', limit: number = 10): TransactionRow[] {
    const conditions: string[] = ['t.trans_date >= ?', 't.trans_date <= ?', 't.type = ?']
    const params: any[] = [filter.startDate, filter.endDate, type]

    if (filter.ledgerId) {
      conditions.push('t.ledger_id = ?')
      params.push(filter.ledgerId)
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ')

    return this.dbManager.all<TransactionRow>(
      `SELECT t.*, c.name as category_name, l.name as ledger_name
       FROM transactions t
       LEFT JOIN category c ON t.category_id = c.id
       LEFT JOIN ledger l ON t.ledger_id = l.id
       ${whereClause}
       ORDER BY t.amount DESC
       LIMIT ?`,
      [...params, limit]
    )
  }
}
