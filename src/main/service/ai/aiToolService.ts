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
          name: 'get_monthly_summary',
          description: '获取指定月份的收支汇总数据',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM，如 2026-07' },
            },
            required: ['yearMonth'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_category_breakdown',
          description: '获取指定月份的分类消费/收入排行',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM' },
              type: { type: 'string', enum: ['expense', 'income'], description: '交易类型' },
            },
            required: ['yearMonth', 'type'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_daily_trend',
          description: '获取指定时间段内的每日收支走势',
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
          description: '获取指定月份金额最大的N条交易记录',
          parameters: {
            type: 'object',
            properties: {
              yearMonth: { type: 'string', description: '月份，格式 YYYY-MM' },
              type: { type: 'string', enum: ['expense', 'income'], description: '交易类型' },
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
          description: '对比两个月份的收支数据，输出变化率',
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
