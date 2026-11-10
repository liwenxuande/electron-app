import { describe, it, expect, vi } from 'vitest'

// 打桩 electron：aiLogger / logger / configStore 在模块顶层依赖 electron(-main)，
// 而 vitest 跑在 ELECTRON_RUN_AS_NODE 的普通 Node 环境下无法解析 'electron/main'
vi.mock('electron/main', () => ({
  app: { getPath: vi.fn(() => ''), isPackaged: false },
}))
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => ''), isPackaged: false },
  safeStorage: { isEncryptionAvailable: vi.fn(() => false), decryptString: vi.fn(() => '') },
}))

// 打桩 logger，避免重试/降级路径的 warn 污染测试输出
vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  initFileTransport: vi.fn(),
}))

import { ReportAiService, extractJson } from './reportAiService'
import type { ReportBase } from '../../../shared/types/report'

const base = {
  yearMonth: '2026-10',
  ledgerName: '日常账本',
  period: '2026-10-01 ~ 2026-10-31',
  generatedAt: '2026-11-09 21:30',
  summary: { income: 18500, expense: 9216.5, balance: 9283.5, count: 147, savingsRate: 50.2 },
  prevSummary: { income: 17800, expense: 10049.4, balance: 7750.6, count: 150, savingsRate: 43.5 },
  monthly6: [{ ym: '10月', income: 18500, expense: 9216.5, savingsRate: 50.2 }],
  ytd: { income: 100000, expense: 70000, savingsRate: 30 },
  categories: [{ name: '餐饮', amount: 2617.5, percent: 28.4, count: 62, prev: 2452 }],
  incomeStructure: [{ name: '工资', amount: 18500, percent: 100, count: 1, prev: 0 }],
  budgets: [],
  topEntries: [{ date: '10-18', title: '双十一预售', category: '购物', amount: 899 }],
  daily: [],
  bookStats: { activeDays: 25, avgPerDay: 5.9, maxDayExpense: 1650, maxDayDate: '2026-10-01', streak: 4 },
} satisfies ReportBase

const validJson = JSON.stringify({
  overview: '10月总收入 18,500 元，总支出 9,216.5 元，整体财务状况健康。',
  changeFromLastMonth: '支出较上月下降 8.3%。',
  insights: ['餐饮 62 笔，笔均 42.2 元。', '储蓄率连续两个月高于 45%。'],
  suggestions: [{ text: '提前规划 11 月尾款预算。', prio: 'high' }],
  scoreDims: [
    { name: '储蓄能力', value: 92, prev: 85 },
    { name: '支出控制', value: 78, prev: 72 },
    { name: '消费结构', value: 70, prev: 63 },
    { name: '消费稳定', value: 68, prev: 60 },
    { name: '记账习惯', value: 74, prev: 69 },
  ],
  score: 82,
})

describe('extractJson', () => {
  it('剥离 ```json 围栏', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('截取首个 { 到最后一个 }', () => {
    expect(extractJson('好的，结果如下：{"a":1} 完毕')).toBe('{"a":1}')
  })
})

describe('ReportAiService.buildNarrative', () => {
  it('首次返回非法 JSON 时重试一次并成功', async () => {
    const callModel = vi.fn().mockResolvedValueOnce('不是 JSON').mockResolvedValueOnce(validJson)
    const svc = new ReportAiService(callModel)
    const result = await svc.buildNarrative(base)
    expect(callModel).toHaveBeenCalledTimes(2)
    expect(result.failed).toBe(false)
    expect(result.score).toBe(82)
    expect(result.scoreDims).toHaveLength(5)
  })

  it('两次都失败时降级且不抛错', async () => {
    const callModel = vi.fn().mockResolvedValue('还是不是 JSON')
    const svc = new ReportAiService(callModel)
    const result = await svc.buildNarrative(base)
    expect(callModel).toHaveBeenCalledTimes(2)
    expect(result.failed).toBe(true)
    expect(result.overview).toContain('分析生成失败')
    expect(result.scoreDims).toEqual([])
  })

  it('prompt 中带上关键统计数字', async () => {
    const callModel = vi.fn().mockResolvedValue(validJson)
    const svc = new ReportAiService(callModel)
    await svc.buildNarrative(base)
    const prompt = callModel.mock.calls[0][0][1].content as string
    expect(prompt).toContain('18500')
    expect(prompt).toContain('储蓄能力')
    expect(prompt).toContain('147')
  })
})
