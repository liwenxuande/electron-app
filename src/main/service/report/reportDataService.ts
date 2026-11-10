import dayjs from 'dayjs'
import DbManager from '../../db/database'
import type { ReportBase, ReportDailyPoint, ReportTopEntry } from '../../../shared/types/report'
import {
  buildBookStats,
  buildCategories,
  buildDaily,
  buildMonthlySeries,
  buildYtd,
  daysInMonth,
  round2,
  toMonthlyPoint,
  toSummary,
  type RawCategoryRow,
  type RawDailyRow,
  type RawMonthSummary,
} from './reportAggregate'

export class ReportDataService {
  private db = DbManager.getInstance()
  private ledgerId: number

  constructor(ledgerId: number) {
    this.ledgerId = ledgerId
  }

  private monthRaw(yearMonth: string): RawMonthSummary {
    const row = this.db.get<RawMonthSummary>(
      `SELECT
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense,
        COUNT(*) as count
      FROM transactions t
      WHERE t.ledger_id = ? AND t.trans_date LIKE ?`,
      [this.ledgerId, `${yearMonth}%`],
    )
    return { income: row?.income ?? 0, expense: row?.expense ?? 0, count: row?.count ?? 0 }
  }

  private categoryRaw(yearMonth: string, type: 'expense' | 'income'): RawCategoryRow[] {
    return this.db.all<RawCategoryRow>(
      `SELECT c.name as name, SUM(t.amount) as amount, COUNT(*) as count
      FROM transactions t
      LEFT JOIN category c ON t.category_id = c.id
      WHERE t.ledger_id = ? AND t.trans_date LIKE ? AND t.type = ?
      GROUP BY c.name ORDER BY amount DESC`,
      [this.ledgerId, `${yearMonth}%`, type],
    )
  }

  private dailyRaw(yearMonth: string): RawDailyRow[] {
    return this.db.all<RawDailyRow>(
      `SELECT t.trans_date as date,
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense
      FROM transactions t
      WHERE t.ledger_id = ? AND t.trans_date LIKE ?
      GROUP BY t.trans_date ORDER BY t.trans_date ASC`,
      [this.ledgerId, `${yearMonth}%`],
    )
  }

  private topRaw(yearMonth: string, limit: number): ReportTopEntry[] {
    const rows = this.db.all<{ date: string; title: string; category: string; amount: number }>(
      `SELECT t.trans_date as date, COALESCE(t.description, '') as title,
        COALESCE(c.name, '未分类') as category, t.amount as amount
      FROM transactions t LEFT JOIN category c ON t.category_id = c.id
      WHERE t.ledger_id = ? AND t.trans_date LIKE ? AND t.type = 'expense'
      ORDER BY t.amount DESC LIMIT ?`,
      [this.ledgerId, `${yearMonth}%`, limit],
    )
    return rows.map((r) => ({
      date: r.date.slice(5),
      title: r.title || '无备注',
      category: r.category,
      amount: round2(r.amount),
    }))
  }

  private ledgerName(): string {
    const row = this.db.get<{ name: string }>('SELECT name FROM ledger WHERE id = ?', [this.ledgerId])
    return row?.name || '默认账本'
  }

  /** 近 N 月汇总（含结束月），按时间升序；ytd 为结束月所在年 1 月至结束月累计 */
  getMonthlySummaries(
    endYM: string,
    months: number,
  ): {
    series: ReturnType<typeof buildMonthlySeries>
    ytd: ReturnType<typeof buildYtd>
  } {
    const count = Math.max(1, Math.floor(months))
    const rows: Array<{ ym: string } & RawMonthSummary> = []
    for (let i = count - 1; i >= 0; i--) {
      const ym = dayjs(`${endYM}-01`).subtract(i, 'month').format('YYYY-MM')
      rows.push({ ym, ...this.monthRaw(ym) })
    }
    const endYear = endYM.slice(0, 4)
    const ytdRows = rows.filter((r) => r.ym.startsWith(endYear))
    return { series: buildMonthlySeries(rows), ytd: buildYtd(ytdRows) }
  }

  /** 分类级环比：返回当月支出分类，prev 为上月同分类金额 */
  getCategoryComparison(currentYM: string, prevYM: string) {
    return buildCategories(this.categoryRaw(currentYM, 'expense'), this.categoryRaw(prevYM, 'expense'))
  }

  /** 返回该月每日支出（补齐整月） */
  getDaily(yearMonth: string): ReportDailyPoint[] {
    return buildDaily(this.dailyRaw(yearMonth), yearMonth)
  }

  /** 汇总除 AI 文案外的全部报表数据 */
  buildBase(yearMonth: string): ReportBase {
    const prevYM = dayjs(`${yearMonth}-01`).subtract(1, 'month').format('YYYY-MM')
    const raw = this.monthRaw(yearMonth)
    const daily = this.getDaily(yearMonth)
    const { series, ytd } = this.getMonthlySummaries(yearMonth, 6)
    const incomeCats = this.categoryRaw(yearMonth, 'income')
    const incomeTotal = incomeCats.reduce((s, r) => s + r.amount, 0)

    return {
      yearMonth,
      ledgerName: this.ledgerName(),
      period: `${yearMonth}-01 ~ ${yearMonth}-${String(daysInMonth(yearMonth)).padStart(2, '0')}`,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      summary: toSummary(raw),
      prevSummary: toSummary(this.monthRaw(prevYM)),
      monthly6: series,
      ytd,
      categories: this.getCategoryComparison(yearMonth, prevYM),
      incomeStructure: incomeTotal > 0 ? buildCategories(incomeCats, []) : [],
      budgets: [],
      topEntries: this.topRaw(yearMonth, 5),
      daily,
      bookStats: buildBookStats(daily, raw.count, yearMonth),
    }
  }
}
