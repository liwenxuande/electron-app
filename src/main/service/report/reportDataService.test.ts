import { describe, it, expect, beforeAll, vi } from 'vitest'

// logger.ts 依赖 Electron 运行时才存在的 'electron/main'，测试环境需打桩
vi.mock('electron/main', () => ({ app: { getPath: () => '' } }))

import DbManager from '../../db/database'
import { ReportDataService } from './reportDataService'

function seed(): void {
  const db = DbManager.getInstance().getDb()
  db.prepare("INSERT OR IGNORE INTO ledger (id, name) VALUES (2, '测试账本')").run()
  db.prepare("INSERT OR IGNORE INTO category (id, name, type) VALUES (900, '餐饮', 'expense')").run()
  db.prepare("INSERT OR IGNORE INTO category (id, name, type) VALUES (901, '工资', 'income')").run()
  const insert = db.prepare(
    'INSERT INTO transactions (type, amount, category_id, ledger_id, trans_date, description) VALUES (?, ?, ?, ?, ?, ?)',
  )
  insert.run('expense', 100, 900, 2, '2025-12-05', '午餐')
  insert.run('expense', 200, 900, 2, '2026-01-06', '聚餐')
  insert.run('income', 5000, 901, 2, '2026-01-10', '工资')
  insert.run('expense', 300, 900, 2, '2026-02-07', '外卖')
  insert.run('expense', 999, 900, 1, '2026-02-08', '其他账本不应计入')
}

beforeAll(() => {
  DbManager.getInstance().init(':memory:')
  seed()
})

describe('getMonthlySummaries', () => {
  it('返回指定月份数并按时间升序，跨年连续', () => {
    const svc = new ReportDataService(2)
    const { series } = svc.getMonthlySummaries('2026-02', 3)
    expect(series.map((s) => s.ym)).toEqual(['12月', '1月', '2月'])
    expect(series[1]).toEqual({ ym: '1月', income: 5000, expense: 200, savingsRate: 96 })
    expect(series[2]).toEqual({ ym: '2月', income: 0, expense: 300, savingsRate: 0 })
  })

  it('YTD 只累计当年 1 月到结束月', () => {
    const svc = new ReportDataService(2)
    expect(svc.getMonthlySummaries('2026-02', 3).ytd).toEqual({
      income: 5000,
      expense: 500,
      savingsRate: 90,
    })
  })
})

describe('getCategoryComparison', () => {
  it('返回分类环比并在上月无该分类时 prev=0', () => {
    const svc = new ReportDataService(2)
    const rows = svc.getCategoryComparison('2026-01', '2025-12')
    expect(rows).toEqual([{ name: '餐饮', amount: 200, percent: 100, count: 1, prev: 100 }])
  })
})

describe('buildBase', () => {
  it('组装 7 页所需基础数据', () => {
    const svc = new ReportDataService(2)
    const base = svc.buildBase('2026-01')
    expect(base.ledgerName).toBe('测试账本')
    expect(base.period).toBe('2026-01-01 ~ 2026-01-31')
    expect(base.summary).toEqual({ income: 5000, expense: 200, balance: 4800, count: 2, savingsRate: 96 })
    expect(base.prevSummary).toEqual({ income: 0, expense: 100, balance: -100, count: 1, savingsRate: 0 })
    expect(base.categories).toHaveLength(1)
    expect(base.daily).toHaveLength(31)
    expect(base.monthly6).toHaveLength(6)
    expect(base.bookStats.activeDays).toBe(2)
    expect(base.incomeStructure[0]).toEqual({ name: '工资', amount: 5000, percent: 100, count: 1, prev: 0 })
    expect(base.topEntries[0]).toEqual({ date: '01-06', title: '聚餐', category: '餐饮', amount: 200 })
  })

  it('空月不抛错且金额全为 0', () => {
    const svc = new ReportDataService(2)
    const base = svc.buildBase('2026-05')
    expect(base.summary.count).toBe(0)
    expect(base.categories).toEqual([])
    expect(base.topEntries).toEqual([])
  })
})
