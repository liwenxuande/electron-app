import { describe, it, expect } from 'vitest'
import { aiNarrativeSchema } from './report'

const valid = {
  overview: '10月总收入 18,500 元，总支出 9,216.5 元，整体财务状况健康。',
  changeFromLastMonth: '支出较上月下降 8.3%，主要来自购物回落。',
  insights: ['餐饮 62 笔，笔均 42.2 元。', '储蓄率连续两月高于 45%。'],
  suggestions: [
    { text: '双十一尾款建议提前规划预算。', prio: 'high' },
    { text: '每周自炊 2~3 次可再省 300 元。', prio: 'mid' },
  ],
  scoreDims: [
    { name: '储蓄能力', value: 92, prev: 85 },
    { name: '支出控制', value: 78, prev: 72 },
    { name: '消费结构', value: 70, prev: 63 },
    { name: '消费稳定', value: 68, prev: 60 },
    { name: '记账习惯', value: 74, prev: 69 },
  ],
  score: 82,
}

describe('aiNarrativeSchema', () => {
  it('接受合法结构', () => {
    expect(aiNarrativeSchema.safeParse(valid).success).toBe(true)
  })

  it('拒绝缺少 insights 的对象', () => {
    const bad = { ...valid, insights: undefined }
    expect(aiNarrativeSchema.safeParse(bad).success).toBe(false)
  })

  it('拒绝优先级不在 high/mid 的建议', () => {
    const bad = { ...valid, suggestions: [{ text: '随便花花', prio: 'low' }] }
    expect(aiNarrativeSchema.safeParse(bad).success).toBe(false)
  })

  it('拒绝维度数量不是 5 的评分', () => {
    const bad = { ...valid, scoreDims: valid.scoreDims.slice(0, 4) }
    expect(aiNarrativeSchema.safeParse(bad).success).toBe(false)
  })
})
