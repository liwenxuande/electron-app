import { aiNarrativeSchema, type ReportAiNarrative, type ReportBase } from '../../../shared/types/report'
import { aiConfigService } from '../ai/aiConfigService'
import type { ChatMessage } from '../ai/deepseekClient'
import { logger } from '../../utils/logger'
import { newRequestId, type AILogContext } from '../../utils/aiLogger'

export type ReportModelCaller = (messages: ChatMessage[]) => Promise<string>

const SYSTEM_PROMPT = `你是个人财务分析师，为月度财务报告撰写结论文案。要求：全部中文；只输出 JSON；数字必须来自用户提供的数据，不得编造；语气客观、具体、可执行。`

const DIM_NAMES = ['储蓄能力', '支出控制', '消费结构', '消费稳定', '记账习惯'] as const

/** 从模型输出中截取 JSON 主体（容忍 ```json 围栏与前后解释文字） */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return body.trim()
  return body.slice(start, end + 1).trim()
}

function fallback(): ReportAiNarrative {
  return {
    overview: '本月分析生成失败，仅展示数据报表。',
    changeFromLastMonth: '',
    insights: [],
    suggestions: [],
    scoreDims: [],
    score: 0,
    failed: true,
  }
}

export class ReportAiService {
  private callModel: ReportModelCaller

  constructor(callModel: ReportModelCaller) {
    this.callModel = callModel
  }

  private buildPrompt(base: ReportBase): string {
    const payload = {
      月份: base.yearMonth,
      收支: base.summary,
      上月: base.prevSummary,
      近6月: base.monthly6,
      本年累计: base.ytd,
      支出分类: base.categories.map((c) => ({ 分类: c.name, 金额: c.amount, 占比: c.percent, 笔数: c.count, 上月金额: c.prev })),
      收入结构: base.incomeStructure.map((c) => ({ 分类: c.name, 金额: c.amount, 占比: c.percent })),
      大额支出: base.topEntries,
      记账行为: base.bookStats,
    }
    return `请根据以下 ${base.yearMonth} 统计数据生成报告文案。

${JSON.stringify(payload, null, 2)}

评分要求：scoreDims 必须恰好 5 项，name 依次为 ${DIM_NAMES.join('、')}；value/prev 为 0-100 的整数；score 为总分（0-100）。
- 储蓄能力：储蓄率越高分越高
- 支出控制：支出环比下降、无异常大额则分高
- 消费结构：分类集中度合理、必要支出占比高则分高
- 消费稳定：每日支出波动越小分越高
- 记账习惯：活跃天数、连续记账天数越多分越高

返回 JSON 结构：
{"overview":"150 字以内月度概述","changeFromLastMonth":"与上月对比一句话，含具体百分比","insights":["发现1","发现2"],"suggestions":[{"text":"建议","prio":"high 或 mid"}],"scoreDims":[{"name":"储蓄能力","value":90,"prev":85}],"score":85}
只返回 JSON，不要任何其他文字。`
  }

  /** 生成文案；失败重试 1 次，仍失败返回降级结构 */
  async buildNarrative(base: ReportBase): Promise<ReportAiNarrative> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: this.buildPrompt(base) },
    ]

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const text = await this.callModel(messages)
        const parsed = aiNarrativeSchema.safeParse(JSON.parse(extractJson(text)))
        if (parsed.success) {
          return { ...parsed.data, failed: false }
        }
        logger.warn(`[ReportAI] 第 ${attempt} 次返回结构非法: ${parsed.error.issues[0]?.message ?? '未知'}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        logger.warn(`[ReportAI] 第 ${attempt} 次生成失败: ${msg}`)
      }
    }
    return fallback()
  }
}

/** 生产环境实例：DeepSeek 非流式调用 + 30 秒超时 */
export function createReportAiService(): ReportAiService {
  return new ReportAiService(async (messages) => {
    const client = aiConfigService.createClient()
    if (!client) throw new Error('未配置 API Key')
    const ctx: AILogContext = { requestId: newRequestId() }
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI 文案生成超时')), 30000),
    )
    return Promise.race([client.chat(messages, 0.3, ctx), timeout])
  })
}
