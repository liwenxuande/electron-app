import { aiConfigService } from './aiConfigService'
import { AIToolService } from './aiToolService'
import { newRequestId, type AILogContext } from '../../utils/aiLogger'
import type { ChatMessage } from './deepseekClient'

export interface ChatResult {
  text: string
  stopped: boolean
}

const SYSTEM_PROMPT = `你是个人财务助手，帮助用户分析记账数据。

## 核心规则（必须严格遵守）
1. **禁止编造数据**：你绝不编造、猜测或虚构任何财务数字。所有回答中的数据必须来自工具调用返回的真实结果。
2. **必须先调用工具**：用户询问任何涉及收入、支出、账单、趋势、对比等数据问题时，你必须先调用对应的工具获取真实数据，再基于数据回答。不得跳过工具调用直接回答。
3. **空数据处理**：如果工具返回空数据（如某月无记录），直接告知用户"该月份暂无记账数据"，不要编造任何数字。
4. **时间确认**：用户提及"今天""本月""上月""今年"等时间词时，必须先调用 get_current_time 获取真实日期，再根据返回的 yearMonth/date 调用数据工具。严禁凭感觉猜测月份。

## 回复风格
- 简洁、友好、数据驱动
- 用具体数字和百分比，不说"花了不少""收入不错"等模糊表述
- 发现异常消费/收入变化时指出并给出建议
- 语气积极鼓励，不批评用户
- 全部用中文回复

## 收入分析指南
- 用户问收入相关问题时，使用 get_monthly_summary 查看总收入，get_category_breakdown(type='income') 查看收入来源分布
- 可结合 compare_months 分析收入环比变化，get_top_entries(type='income') 查看大额收入明细`

const MAX_TOOL_ROUNDS = 5

export class AIAnalysisService {
  private ledgerId: number

  constructor(ledgerId: number) {
    this.ledgerId = ledgerId
  }

  private client() { return aiConfigService.createClient() }

  async generateMonthlyReport(yearMonth: string, onChunk: (text: string) => void): Promise<string> {
    const c = this.client()
    if (!c) throw new Error('未配置 API Key')
    const ctx: AILogContext = { requestId: newRequestId(), ledgerId: this.ledgerId }

    const toolService = new AIToolService(this.ledgerId)
    const summary = toolService.executeTool('get_monthly_summary', { yearMonth })
    const breakdown = toolService.executeTool('get_category_breakdown', { yearMonth, type: 'expense' })
    const topItems = toolService.executeTool('get_top_entries', { yearMonth, type: 'expense', limit: 10 })
    const prevYM = this.prevMonth(yearMonth)
    const compare = toolService.executeTool('compare_months', { currentYM: yearMonth, prevYM })

    const userPrompt = `请根据以下数据,生成一份${yearMonth}月度消费分析报告(JSON格式)。

=== 收支总览 ===
${summary}

=== 消费分类排行 ===
${breakdown}

=== 大额支出 TOP 10 ===
${topItems}

=== 与上月对比 (${prevYM}) ===
${compare}

请返回如下JSON:{"overview":"150字以内的月度收支概述","leadingCategory":{"name":"最大支出分类名","percentage":百分比数字},"changeFromLastMonth":"与上月对比的一句话,含具体变化百分比","insights":["发现1","发现2","发现3"],"suggestions":["建议1","建议2"],"score":分数1到100}只返回JSON,不要其他文字。`

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]
    return c.chatStream(messages, onChunk, 0.3, ctx)
  }

  async chat(
    historyMessages: ChatMessage[],
    onChunk: (text: string) => void,
    sessionId?: string,
    signal?: AbortSignal,
  ): Promise<ChatResult> {
    const c = this.client()
    if (!c) throw new Error('未配置 API Key')
    const requestId = newRequestId()
    const baseCtx: AILogContext = { requestId, sessionId, ledgerId: this.ledgerId }

    const toolService = new AIToolService(this.ledgerId)
    const tools = toolService.getToolDefs()
    const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...historyMessages]

    let round = 0
    while (round < MAX_TOOL_ROUNDS) {
      if (signal?.aborted) {
        // 被中断，用当前 messages 做最后一次流式输出
        const partialResult = await c.chatStream([...messages], onChunk, 0.3, { ...baseCtx, round }, signal)
        return { text: partialResult, stopped: true }
      }
      round++
      const ctx: AILogContext = { ...baseCtx, round }
      const res = await c.chatWithTools(messages, tools, 0.3, ctx, signal)

      if (res.finishReason !== 'tool_calls' || res.toolCalls.length === 0) {
        const finalResult = await c.chatStream([...messages], onChunk, 0.3, ctx, signal)
        return { text: finalResult, stopped: false }
      }

      messages.push({ role: 'assistant', content: null, tool_calls: res.toolCalls })
      const toolResults = toolService.handleToolCalls(res.toolCalls, ctx)
      messages.push(...toolResults)
    }

    const finalResult = await c.chatStream([...messages], onChunk, 0.3, { ...baseCtx, round }, signal)
    return { text: finalResult, stopped: false }
  }

  async analyzeStats(statsData: Record<string, unknown>, onChunk: (text: string) => void): Promise<string> {
    const c = this.client()
    if (!c) throw new Error('未配置 API Key')
    const ctx: AILogContext = { requestId: newRequestId(), ledgerId: this.ledgerId }
    const userPrompt = `请分析以下统计数据并给出解读:\n${JSON.stringify(statsData, null, 2)}\n\n请指出:1)主要消费趋势 2)异常数据点 3)优化建议`
    return c.chatStream([{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }], onChunk, 0.3, ctx)
  }

  private prevMonth(ym: string): string {
    const [y, m] = ym.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }
}
