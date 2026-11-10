import { describe, it, expect } from 'vitest'
import {
  toSummary,
  buildCategories,
  buildDaily,
  buildBookStats,
  buildMonthlySeries,
  buildYtd,
} from './reportAggregate'

describe('toSummary', () => {
  it('计算结余与储蓄率', () => {
    expect(toSummary({ income: 18500, expense: 9216.5, count: 147 })).toEqual({
      income: 18500,
      expense: 9216.5,
      balance: 9283.5,
      count: 147,
      savingsRate: 50.2,
    })
  })

  it('空月储蓄率为 0 且金额为 0', () => {
    expect(toSummary({ income: 0, expense: 0, count: 0 })).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      count: 0,
      savingsRate: 0,
    })
  })
})

describe('buildCategories', () => {
  it('计算占比、上月金额并按金额降序', () => {
    const rows = buildCategories(
      [
        { name: '餐饮', amount: 2617.5, count: 62 },
        { name: '购物', amount: 1906, count: 18 },
      ],
      [{ name: '餐饮', amount: 2452, count: 60 }],
    )
    expect(rows[0]).toEqual({ name: '餐饮', amount: 2617.5, percent: 57.9, count: 62, prev: 2452 })
    expect(rows[1]).toEqual({ name: '购物', amount: 1906, percent: 42.1, count: 18, prev: 0 })
  })

  it('总支出为 0 时占比为 0', () => {
    expect(buildCategories([{ name: '其他', amount: 0, count: 0 }], [])).toEqual([
      { name: '其他', amount: 0, percent: 0, count: 0, prev: 0 },
    ])
  })
})

describe('buildDaily', () => {
  it('补齐整月天数并标记周末', () => {
    const daily = buildDaily(
      [
        { date: '2026-10-01', income: 0, expense: 100 },
        { date: '2026-10-03', income: 0, expense: 50 },
      ],
      '2026-10',
    )
    expect(daily).toHaveLength(31)
    expect(daily[0]).toEqual({ day: 1, expense: 100, weekend: false, hasRecord: true })
    expect(daily[2]).toEqual({ day: 3, expense: 50, weekend: true, hasRecord: true })
    expect(daily[4]).toEqual({ day: 5, expense: 0, weekend: false, hasRecord: false })
  })

  it('按不同月份补齐 28/29/30 天', () => {
    expect(buildDaily([], '2026-02')).toHaveLength(28)
    expect(buildDaily([], '2024-02')).toHaveLength(29)
    expect(buildDaily([], '2026-04')).toHaveLength(30)
  })
})

describe('buildBookStats', () => {
  it('统计活跃天数、日均笔数、最大单日与连续记账', () => {
    const daily = buildDaily(
      [
        { date: '2026-10-28', income: 0, expense: 20 },
        { date: '2026-10-29', income: 0, expense: 30 },
        { date: '2026-10-30', income: 0, expense: 900 },
        { date: '2026-10-31', income: 0, expense: 10 },
      ],
      '2026-10',
    )
    expect(buildBookStats(daily, 12, '2026-10')).toEqual({
      activeDays: 4,
      avgPerDay: 3,
      maxDayExpense: 900,
      maxDayDate: '2026-10-30',
      streak: 4,
    })
  })

  it('空月不抛错', () => {
    expect(buildBookStats(buildDaily([], '2026-02'), 0, '2026-02')).toEqual({
      activeDays: 0,
      avgPerDay: 0,
      maxDayExpense: 0,
      maxDayDate: '',
      streak: 0,
    })
  })
})

describe('buildMonthlySeries / buildYtd', () => {
  const rows = [
    { ym: '2025-12', income: 10000, expense: 8000, count: 10 },
    { ym: '2026-01', income: 12000, expense: 6000, count: 12 },
  ]

  it('月份标签转为中文月', () => {
    expect(buildMonthlySeries(rows)).toEqual([
      { ym: '12月', income: 10000, expense: 8000, savingsRate: 20 },
      { ym: '1月', income: 12000, expense: 6000, savingsRate: 50 },
    ])
  })

  it('YTD 汇总收入、支出与储蓄率', () => {
    expect(buildYtd(rows)).toEqual({ income: 22000, expense: 14000, savingsRate: 36.4 })
  })

  it('YTD 空数组返回 0', () => {
    expect(buildYtd([])).toEqual({ income: 0, expense: 0, savingsRate: 0 })
  })
})
