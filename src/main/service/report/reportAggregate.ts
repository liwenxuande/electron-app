import type {
  ReportBookStats,
  ReportCategory,
  ReportDailyPoint,
  ReportMonthlyPoint,
  ReportSummary,
} from '../../../shared/types/report'

export interface RawMonthSummary {
  income: number
  expense: number
  count: number
}

export interface RawCategoryRow {
  name: string
  amount: number
  count: number
}

export interface RawDailyRow {
  date: string
  income: number
  expense: number
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function toSummary(raw: RawMonthSummary): ReportSummary {
  const income = round2(raw.income)
  const expense = round2(raw.expense)
  return {
    income,
    expense,
    balance: round2(income - expense),
    count: raw.count,
    savingsRate: income > 0 ? round1(((income - expense) / income) * 100) : 0,
  }
}

export function toMonthlyPoint(ym: string, raw: RawMonthSummary): ReportMonthlyPoint {
  const s = toSummary(raw)
  return { ym: `${Number(ym.slice(5, 7))}月`, income: s.income, expense: s.expense, savingsRate: s.savingsRate }
}

export function buildCategories(current: RawCategoryRow[], prev: RawCategoryRow[]): ReportCategory[] {
  const total = current.reduce((s, r) => s + r.amount, 0)
  const prevMap = new Map(prev.map((r) => [r.name, r.amount]))
  return current
    .map((r) => ({
      name: r.name,
      amount: round2(r.amount),
      percent: total > 0 ? round1((r.amount / total) * 100) : 0,
      count: r.count,
      prev: round2(prevMap.get(r.name) ?? 0),
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function buildMonthlySeries(rows: Array<{ ym: string } & RawMonthSummary>): ReportMonthlyPoint[] {
  return rows.map((r) => toMonthlyPoint(r.ym, r))
}

export function buildYtd(rows: RawMonthSummary[]): { income: number; expense: number; savingsRate: number } {
  const income = round2(rows.reduce((s, r) => s + r.income, 0))
  const expense = round2(rows.reduce((s, r) => s + r.expense, 0))
  return {
    income,
    expense,
    savingsRate: income > 0 ? round1(((income - expense) / income) * 100) : 0,
  }
}

export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function buildDaily(rows: RawDailyRow[], yearMonth: string): ReportDailyPoint[] {
  const [y, m] = yearMonth.split('-').map(Number)
  const map = new Map(rows.map((r) => [Number(r.date.slice(8, 10)), r]))
  const total = daysInMonth(yearMonth)
  const out: ReportDailyPoint[] = []
  for (let day = 1; day <= total; day++) {
    const row = map.get(day)
    const weekday = new Date(y, m - 1, day).getDay()
    out.push({
      day,
      expense: round2(row?.expense ?? 0),
      weekend: weekday === 0 || weekday === 6,
      hasRecord: !!row && (row.income > 0 || row.expense > 0),
    })
  }
  return out
}

export function buildBookStats(daily: ReportDailyPoint[], count: number, yearMonth: string): ReportBookStats {
  const activeDays = daily.filter((d) => d.hasRecord).length
  let maxDayExpense = 0
  let maxDayDate = ''
  for (const d of daily) {
    if (d.expense > maxDayExpense) {
      maxDayExpense = d.expense
      maxDayDate = `${yearMonth}-${String(d.day).padStart(2, '0')}`
    }
  }
  let streak = 0
  for (let i = daily.length - 1; i >= 0; i--) {
    if (!daily[i].hasRecord) break
    streak++
  }
  return {
    activeDays,
    avgPerDay: activeDays > 0 ? round1(count / activeDays) : 0,
    maxDayExpense,
    maxDayDate,
    streak,
  }
}
