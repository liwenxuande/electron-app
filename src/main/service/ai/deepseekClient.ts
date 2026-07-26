import https from 'https'
import { logger } from '../../utils/logger'
import { aiLog, newRequestId, type AILogContext } from '../../utils/aiLogger'

const BASE_URL = 'api.deepseek.com'
const TIMEOUT_MS = 60_000

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, { type: string; description: string; enum?: string[] }>
      required: string[]
    }
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** 工具调用参数原本是 JSON 字符串，日志里尽量解析成对象，解析失败就原样记录，不让日志因格式问题丢信息 */
function parseArgsForLog(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function postJSON(
  path: string,
  body: Record<string, unknown>,
  apiKey: string,
  signal?: AbortSignal,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = https.request({
      hostname: BASE_URL,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 400) {
            const err = json as { error?: { message?: string } }
            reject(new Error(err.error?.message || `HTTP ${res.statusCode}`))
          } else {
            resolve(json)
          }
        } catch {
          reject(new Error(`解析响应失败: ${data.slice(0, 200)}`))
        }
      })
    })
    signal?.addEventListener('abort', () => req.destroy())
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(payload)
    req.end()
  })
}

export function postStream(
  path: string,
  body: Record<string, unknown>,
  apiKey: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = https.request({
      hostname: BASE_URL,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errData = ''
        res.on('data', (chunk: Buffer) => { errData += chunk.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(errData) as { error?: { message?: string } }
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}`))
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${errData.slice(0, 200)}`))
          }
        })
        return
      }

      let fullText = ''
      let buffer = ''
      res.on('data', (chunk: Buffer) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const dataStr = trimmed.slice(6)
          if (dataStr === '[DONE]') continue
          try {
            const parsed = JSON.parse(dataStr) as {
              choices?: Array<{ delta?: { content?: string } }>
            }
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              fullText += content
              onChunk(content)
            }
          } catch { /* 跳过非 JSON 行 */ }
        }
      })
      res.on('end', () => resolve(fullText))
    })
    signal?.addEventListener('abort', () => req.destroy())
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(payload)
    req.end()
  })
}

export class DeepSeekClient {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model: string = 'deepseek-v4-flash') {
    this.apiKey = apiKey
    this.model = model
  }

  async chat(
    messages: ChatMessage[],
    temperature = 0.3,
    ctx: AILogContext = { requestId: newRequestId() },
    signal?: AbortSignal,
  ): Promise<string> {
    const t0 = Date.now()
    const userMsg = messages[messages.length - 1]
    logger.info(`[AI] 请求开始 | model=${this.model} | 消息数=${messages.length} | 最后消息=${String(userMsg?.content).slice(0, 80)}`)
    aiLog.requestStart(ctx, { phase: 'chat', model: this.model, temperature, messages })
    try {
      const res = await postJSON('/v1/chat/completions', {
        model: this.model,
        messages,
        temperature,
      }, this.apiKey, signal) as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }>; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }
      const usage = res.usage
      const content = res.choices?.[0]?.message?.content || ''
      logger.info(`[AI] 请求完成 | model=${this.model} | 耗时=${Date.now() - t0}ms | tokens=${usage ? `输入${usage.prompt_tokens}+输出${usage.completion_tokens}=${usage.total_tokens}` : '未知'} | 回复长度=${content.length}字`)
      aiLog.requestEnd(ctx, { phase: 'chat', durationMs: Date.now() - t0, finishReason: res.choices?.[0]?.finish_reason, content, usage })
      return content
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      aiLog.error(ctx, { phase: 'chat', message: msg, stack: e instanceof Error ? e.stack : undefined })
      throw e
    }
  }

  chatStream(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    temperature = 0.3,
    ctx: AILogContext = { requestId: newRequestId() },
    signal?: AbortSignal,
  ): Promise<string> {
    const t0 = Date.now()
    const userMsg = messages[messages.length - 1]
    logger.info(`[AI] 流式请求开始 | model=${this.model} | 消息数=${messages.length} | 最后消息=${String(userMsg?.content).slice(0, 80)}`)
    aiLog.requestStart(ctx, { phase: 'stream', model: this.model, temperature, messages })
    return postStream('/v1/chat/completions', {
      model: this.model,
      messages,
      temperature,
      stream: true,
    }, this.apiKey, onChunk, signal).then((fullText) => {
      logger.info(`[AI] 流式请求完成 | model=${this.model} | 耗时=${Date.now() - t0}ms | 总字符数=${fullText.length}`)
      aiLog.requestEnd(ctx, { phase: 'stream', durationMs: Date.now() - t0, content: fullText })
      return fullText
    }).catch((err) => {
      logger.error(`[AI] 流式请求失败 | model=${this.model} | 耗时=${Date.now() - t0}ms | 错误=${err.message}`)
      aiLog.error(ctx, { phase: 'stream', message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined })
      throw err
    })
  }

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDef[],
    temperature = 0.3,
    ctx: AILogContext = { requestId: newRequestId() },
    signal?: AbortSignal,
  ): Promise<{
    finishReason: string
    content: string | null
    toolCalls: ToolCall[]
  }> {
    const t0 = Date.now()
    const userMsg = messages[messages.length - 1]
    logger.info(`[AI] Tools请求开始 | model=${this.model} | 消息数=${messages.length} | tools数=${tools.length} | 最后消息=${String(userMsg?.content).slice(0, 80)}`)
    aiLog.requestStart(ctx, { phase: 'tools', model: this.model, temperature, messages, tools: tools.map(t => t.function.name) })
    try {
      const res = await postJSON('/v1/chat/completions', {
        model: this.model,
        messages,
        tools,
        temperature,
      }, this.apiKey, signal) as {
        choices?: Array<{
          finish_reason?: string
          message?: { content?: string; tool_calls?: ToolCall[] }
        }>
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
      }
      const choice = res.choices?.[0]
      const toolCalls = choice?.message?.tool_calls || []
      const usage = res.usage
      const detail = toolCalls.length > 0
        ? `调用工具=${toolCalls.map(tc => `${tc.function.name}(${tc.function.arguments.slice(0, 200)})`).join(', ')}`
        : `纯文本回复=${(choice?.message?.content || '').length}字`
      logger.info(`[AI] Tools请求完成 | model=${this.model} | 耗时=${Date.now() - t0}ms | finish_reason=${choice?.finish_reason} | tokens=${usage ? `输入${usage.prompt_tokens}+输出${usage.completion_tokens}=${usage.total_tokens}` : '未知'} | ${detail}`)
      aiLog.requestEnd(ctx, {
        phase: 'tools',
        durationMs: Date.now() - t0,
        finishReason: choice?.finish_reason,
        content: choice?.message?.content ?? null,
        toolCalls: toolCalls.map(tc => ({ id: tc.id, name: tc.function.name, arguments: parseArgsForLog(tc.function.arguments) })),
        usage,
      })
      return {
        finishReason: choice?.finish_reason || 'stop',
        content: choice?.message?.content || null,
        toolCalls,
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      aiLog.error(ctx, { phase: 'tools', message: msg, stack: e instanceof Error ? e.stack : undefined })
      throw e
    }
  }

  async validate(): Promise<boolean> {
    logger.info(`[AI] 验证API连接 | model=${this.model}`)
    try {
      await this.chat([{ role: 'user', content: 'hi' }])
      logger.info(`[AI] 验证成功 | model=${this.model}`)
      return true
    } catch (e: unknown) {
      logger.error(`[AI] 验证失败 | model=${this.model} | 错误=${e instanceof Error ? e.message : String(e)}`)
      return false
    }
  }
}
