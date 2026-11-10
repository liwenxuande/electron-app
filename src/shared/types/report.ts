import { z } from 'zod'

export interface ReportSummary {
  income: number
  expense: number
  balance: number
  count: number
  /** 储蓄率，百分比，保留 1 位小数；收入为 0 时取 0 */
  savingsRate: number
}

export interface ReportCategory {
  name: string
  amount: number
  /** 占本月支出百分比，保留 1 位小数 */
  percent: number
  count: number
  /** 上月同分类金额，用于环比 */
  prev: number
}

export interface ReportBudget {
  name: string
  amount: number
  budget: number
}

export interface ReportTopEntry {
  /** 形如 10-18 */
  date: string
  title: string
  category: string
  amount: number
}

export interface ReportMonthlyPoint {
  /** 形如 10月 */
  ym: string
  income: number
  expense: number
  savingsRate: number
}

export interface ReportDailyPoint {
  day: number
  expense: number
  weekend: boolean
  /** 当日是否有任何交易（含收入） */
  hasRecord: boolean
}

export interface ReportScoreDim {
  name: string
  value: number
  prev: number
}

export interface ReportSuggestion {
  text: string
  prio: 'high' | 'mid'
}

export interface ReportBookStats {
  activeDays: number
  /** 有记账的天数内，日均交易笔数 */
  avgPerDay: number
  maxDayExpense: number
  maxDayDate: string
  /** 从月末向前连续记账的天数 */
  streak: number
}

export interface ReportAiNarrative {
  overview: string
  changeFromLastMonth: string
  insights: string[]
  suggestions: ReportSuggestion[]
  scoreDims: ReportScoreDim[]
  score: number
  /** true 表示 AI 生成失败，渲染层隐藏洞察与雷达图 */
  failed: boolean
}

export interface ReportData {
  yearMonth: string
  ledgerName: string
  /** 形如 2026-10-01 ~ 2026-10-31 */
  period: string
  generatedAt: string
  summary: ReportSummary
  prevSummary: ReportSummary
  monthly6: ReportMonthlyPoint[]
  ytd: { income: number; expense: number; savingsRate: number }
  categories: ReportCategory[]
  /** 收入分类结构（金额降序，percent 为占收入比） */
  incomeStructure: ReportCategory[]
  budgets: ReportBudget[]
  topEntries: ReportTopEntry[]
  daily: ReportDailyPoint[]
  bookStats: ReportBookStats
  ai: ReportAiNarrative
}

/** AI 文案生成前的基础数据（不含 ai 字段） */
export type ReportBase = Omit<ReportData, 'ai'>

/**
 * AI 返回的 JSON 契约。
 * 五个评分维度固定为：储蓄能力 / 支出控制 / 消费结构 / 消费稳定 / 记账习惯。
 * 注：预算功能尚未实现，原模板中的「预算执行」维度改为可由记账行为数据支撑的「记账习惯」。
 */
export const aiNarrativeSchema = z.object({
  overview: z.string().min(10).max(400),
  changeFromLastMonth: z.string().min(4).max(200),
  insights: z.array(z.string().min(4).max(120)).min(2).max(6),
  suggestions: z
    .array(z.object({ text: z.string().min(4).max(120), prio: z.enum(['high', 'mid']) }))
    .min(1)
    .max(5),
  scoreDims: z
    .array(
      z.object({
        name: z.string().min(1).max(10),
        value: z.number().int().min(0).max(100),
        prev: z.number().int().min(0).max(100),
      }),
    )
    .length(5),
  score: z.number().int().min(0).max(100),
})

export type AiNarrativePayload = z.infer<typeof aiNarrativeSchema>
