import DbManager from '../../db/database'
import { logger } from '../../utils/logger'
import { aiLog, type AILogContext } from '../../utils/aiLogger'
import type { ToolDef, ChatMessage } from './deepseekClient'

interface ToolResult {
  tool_call_id: string
  role: 'tool'
  content: string
}

/** 工具返回值本身是 JSON.stringify 后的字符串，日志里解析成对象，避免写成双重转义的字符串 */
function parseResultForLog(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

export class AIToolService {
  private db: DbManager
  private ledgerId: number

  constructor(ledgerId: number) {
    this.db = DbManager.getInstance()
    this.ledgerId = ledgerId
  }

  getToolDefs(): ToolDef[] {
    return [
      {
        type: 'function',
        function: {
          name: 'get_current_time',
          description: '获取当前日期和时间，用于确定"今天""本月""上月""今年"等时间概念。在处理任何涉及日期的用户问题前，必须先调用此工具。',
          parameters: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_monthly_summary',
          description: '获取指定月份的总收入、总支出、交易笔数和结余。适用于：查看月度收支总览、分析收入水平、了解支出规模。',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM，如 2026-07。请先用 get_current_time 获取当前时间再确定月份。' },
            },
            required: ['yearMonth'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_category_breakdown',
          description: '获取指定月份的分类排行，包含每个分类的金额、占比和笔数。type=income 查询收入分类排行（如工资、兼职、投资收益），type=expense 查询支出分类排行（如餐饮、交通、购物）。',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM。请先用 get_current_time 获取当前时间再确定月份。' },
              type: { type: 'string', enum: ['expense', 'income'], description: '交易类型：expense=支出，income=收入' },
            },
            required: ['yearMonth', 'type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_daily_trend',
          description: '获取指定时间段内每日的收入和支出走势，返回每天的 income 和 expense 金额。适用于：分析某段时间的收入/支出变化趋势。',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: '开始日期，格式 YYYY-MM-DD' },
              endDate: { type: 'string', description: '结束日期，格式 YYYY-MM-DD' },
            },
            required: ['startDate', 'endDate'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_top_entries',
          description: '获取指定月份金额最大的N条交易记录，包含日期、分类、金额和备注。type=income 查询最大笔收入（如大额工资、奖金），type=expense 查询最大笔支出（如房租、大额购物）。',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM' },
              type: { type: 'string', enum: ['expense', 'income'], description: '交易类型：expense=支出，income=收入' },
              limit: { type: 'integer', description: '返回条数，默认10' },
            },
            required: ['yearMonth', 'type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'compare_months',
          description: '对比两个月份的总收入、总支出、交易笔数，输出变化百分比。适用于：分析收入/支出环比变化。',
          parameters: {
            type: 'object',
            properties: {
              currentYM: { type: 'string', description: '当前月份 YYYY-MM' },
              prevYM: { type: 'string', description: '对比月份 YYYY-MM' },
            },
            required: ['currentYM', 'prevYM'],
          },
        },
      },
    ]
  }

  executeTool(name: string, args: Record<string, unknown>): string {
    switch (name) {
      case 'get_current_time':       return JSON.stringify(this.getCurrentTime())
      case 'get_monthly_summary':   return JSON.stringify(this.monthlySummary(args.yearMonth as string))
      case 'get_category_breakdown': return JSON.stringify(this.categoryBreakdown(args.yearMonth as string, args.type as string))
      case 'get_daily_trend':        return JSON.stringify(this.dailyTrend(args.startDate as string, args.endDate as string))
      case 'get_top_entries':        return JSON.stringify(this.topEntries(args.yearMonth as string, args.type as string, (args.limit as number) || 10))
      case 'compare_months':         return JSON.stringify(this.compareMonths(args.currentYM as string, args.prevYM as string))
      default: return JSON.stringify({ error: `未知工具: ${name}` })
    }
  }

  handleToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
    ctx: AILogContext,
  ): ToolResult[] {
    return toolCalls.map(tc => {
      const args = JSON.parse(tc.function.arguments)
      const t0 = Date.now()
      logger.info(`[AI Tool] 执行 ${tc.function.name}(${JSON.stringify(args)})`)
      aiLog.toolCall(ctx, { toolCallId: tc.id, name: tc.function.name, arguments: args })
      const result = this.executeTool(tc.function.name, args)
      const durationMs = Date.now() - t0
      logger.info(`[AI Tool] ${tc.function.name} 完成 | ${durationMs}ms | 结果=${result.length}字`)
      aiLog.toolResult(ctx, { toolCallId: tc.id, name: tc.function.name, durationMs, result: parseResultForLog(result) })
      return { tool_call_id: tc.id, role: 'tool' as const, content: result }
    })
  }

  private getCurrentTime() {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return {
      currentTime: now.toISOString(),
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      yearMonth: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      weekday: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()],
      lastMonth: now.getMonth() === 0
        ? `${now.getFullYear() - 1}-12`
        : `${now.getFullYear()}-${pad(now.getMonth())}`,
    }
  }

  /**
   * 构建参数化 WHERE 条件：ledger_id = ? + 额外条件
   * @returns { sql, params } — ledgerId 始终作为第一个参数
   */
  private baseCondition(extraSql = '', extraParams: unknown[] = []): { sql: string; params: unknown[] } {
    return {
      sql: `WHERE t.ledger_id = ?${extraSql}`,
      params: [this.ledgerId, ...extraParams],
    }
  }

  private monthlySummary(yearMonth: string) {
    const cond = this.baseCondition(' AND t.trans_date LIKE ?', [`${yearMonth}%`])
    const row = this.db.get<{ income: number; expense: number; count: number }>(
      `SELECT
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense,
        COUNT(*) as count
      FROM transactions t ${cond.sql}`,
      cond.params
    )
    return {
      totalIncome: +(row?.income ?? 0).toFixed(2),
      totalExpense: +(row?.expense ?? 0).toFixed(2),
      count: row?.count ?? 0,
      balance: +((row?.income ?? 0) - (row?.expense ?? 0)).toFixed(2),
    }
  }

  private categoryBreakdown(yearMonth: string, type: string) {
    const cond = this.baseCondition(' AND t.trans_date LIKE ? AND t.type = ?', [`${yearMonth}%`, type])
    const rows = this.db.all<{ name: string; amount: number; count: number }>(
      `SELECT c.name, SUM(t.amount) as amount, COUNT(*) as count
      FROM transactions t
      LEFT JOIN category c ON t.category_id = c.id
      ${cond.sql}
      GROUP BY c.name ORDER BY amount DESC`,
      cond.params
    )
    const total = rows.reduce((s, r) => s + r.amount, 0)
    return rows.map(r => ({
      name: r.name,
      amount: +r.amount.toFixed(2),
      percentage: total > 0 ? +((r.amount / total) * 100).toFixed(1) : 0,
      count: r.count,
    }))
  }

  private dailyTrend(startDate: string, endDate: string) {
    const cond = this.baseCondition(' AND t.trans_date >= ? AND t.trans_date <= ?', [startDate, endDate])
    return this.db.all<{ date: string; income: number; expense: number }>(
      `SELECT t.trans_date as date,
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense
      FROM transactions t
      ${cond.sql}
      GROUP BY t.trans_date ORDER BY t.trans_date ASC`,
      cond.params
    )
  }

  private topEntries(yearMonth: string, type: string, limit: number) {
    const cond = this.baseCondition(' AND t.trans_date LIKE ? AND t.type = ?', [`${yearMonth}%`, type])
    return this.db.all<{ date: string; category: string; amount: number; desc: string }>(
      `SELECT t.trans_date as date, c.name as category, t.amount, t.description as desc
      FROM transactions t LEFT JOIN category c ON t.category_id = c.id
      ${cond.sql}
      ORDER BY t.amount DESC LIMIT ?`,
      [...cond.params, limit]
    )
  }

  private compareMonths(currentYM: string, prevYM: string) {
    const curr = this.monthlySummary(currentYM)
    const prev = this.monthlySummary(prevYM)
    const calcChange = (cur: number, pre: number) =>
      pre === 0 ? null : +(((cur - pre) / pre) * 100).toFixed(1)
    return {
      current: curr,
      previous: prev,
      incomeChange: calcChange(curr.totalIncome, prev.totalIncome),
      expenseChange: calcChange(curr.totalExpense, prev.totalExpense),
      countChange: calcChange(curr.count, prev.count),
    }
  }
}
