import winston from 'winston'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import * as electron from 'electron/main'
import { logger } from './logger'
const { app } = electron

/**
 * AI 会话调试日志模块
 *
 * 独立于 utils/logger.ts 的通用应用日志，专门记录每一次 DeepSeek 调用的：
 *   - 完整请求参数（model / temperature / messages / tools）
 *   - 完整原始响应（finish_reason / content / tool_calls / usage）
 *   - 每个工具调用的入参与返回结果
 *
 * 输出到独立文件 ai-chat.log，JSON Lines 格式（每行一条完整 JSON），
 * 不做内容截断，便于用 jq / 脚本按 requestId、sessionId、event 检索排查问题。
 *
 * 注意：文件传输在 app.whenReady() 后由 initAILogTransport() 延迟初始化，
 * 初始化之前调用 aiLog.* 不会报错，但日志会丢失（与 utils/logger.ts 行为一致）。
 *
 * 重要：这个 logger 自身的写入失败（文件被占用、句柄失效等）不会抛出异常，
 * 只会通过下面的 error 监听转发到通用 logger（app.log），避免像早期版本那样
 * 静默丢日志、查起来还以为是 AI 没触发调用。
 */

const aiLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [],
})

// aiLogger 自身没有 Console transport，一旦底层文件流报错，必须显式转发，
// 否则 EventEmitter 的 'error' 事件在无监听时会直接抛出未捕获异常（甚至可能拖垮主进程），
// 或者被某些中间层静默吞掉——两种情况用户都看不到任何线索。
aiLogger.on('error', (err: Error) => {
  logger.error(`[AI-LOG] 写入 ai-chat.log 失败: ${err.message}`)
})

let logFilePath = ''
let currentTransport: winston.transports.FileTransportInstance | null = null

function attachFileTransport(): void {
  const fileTransport = new winston.transports.File({
    filename: logFilePath,
    // 完整 messages/响应体积较通用日志大，单文件放宽到 20MB
    maxsize: 20 * 1024 * 1024,
    maxFiles: 10,
    tailable: true,
  })
  // File transport 自身也会 emit 'error'（比如文件句柄被占用），同样转发出去
  fileTransport.on('error', (err: Error) => {
    logger.error(`[AI-LOG] ai-chat.log 文件传输出错: ${err.message}`)
  })
  aiLogger.add(fileTransport)
  currentTransport = fileTransport
}

/** 延迟初始化 AI 日志文件传输（需在 app.whenReady 之后调用） */
export function initAILogTransport(): void {
  const logsDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logsDir, { recursive: true })
  logFilePath = path.join(logsDir, 'ai-chat.log')
  attachFileTransport()
  logger.info(`[AI-LOG] ai-chat.log 已初始化 | 路径=${logFilePath}`)
}

/**
 * 写入流一旦打开就一直绑定着当时那个文件描述符——如果日志文件被外部手动删除/清空
 * （哪怕原地新建了一个同名空文件），这根流并不会自动感知并重新打开，会一直往那个
 * 已经从目录里消失的旧文件写（进程退出前这部分数据基本等于丢了），新文件永远收不到写入。
 * 这里每次写入前做一次轻量检查，发现目标文件“不见了”就关掉旧流、重新开一个新流。
 */
function ensureFileExists(): void {
  if (!logFilePath) return // 还没 initAILogTransport()，跳过
  if (fs.existsSync(logFilePath)) return
  logger.warn('[AI-LOG] 检测到 ai-chat.log 被外部删除或替换，重新创建写入流')
  const stale = currentTransport
  if (stale) aiLogger.remove(stale)
  attachFileTransport()
  stale?.close?.()
}

/** 一次用户请求（可能触发多轮 tool-calling）的关联上下文，用于串联同一次对话的所有日志行 */
export interface AILogContext {
  /** 一次 AIAnalysisService 方法调用（用户发一条消息 / 生成一份报告）对应一个 requestId */
  requestId: string
  /** 对话会话 ID，便于按会话过滤 */
  sessionId?: string
  ledgerId?: number
  /** tool-calling 循环中的轮次，从 1 开始 */
  round?: number
}

/** 生成一个新的请求关联 ID */
export function newRequestId(): string {
  return crypto.randomUUID()
}

function write(event: string, ctx: AILogContext, extra?: Record<string, unknown>): void {
  try {
    ensureFileExists()
    aiLogger.info(event, { event, ...ctx, ...extra })
  } catch (e: unknown) {
    // messages/result 里理论上不该有循环引用，但防止个别异常数据把整条日志写丢还不知情
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`[AI-LOG] 记录事件 ${event} 失败: ${msg}`)
  }
}

export const aiLog = {
  /** 一次 DeepSeek HTTP 请求发出前，记录完整请求参数 */
  requestStart(
    ctx: AILogContext,
    data: {
      phase: 'chat' | 'stream' | 'tools'
      model: string
      temperature: number
      messages: unknown
      tools?: string[]
    }
  ): void {
    write('request_start', ctx, data)
  },

  /** 收到 DeepSeek 完整响应后（或流式结束后），记录结果 */
  requestEnd(
    ctx: AILogContext,
    data: {
      phase: 'chat' | 'stream' | 'tools'
      durationMs: number
      finishReason?: string
      content?: string | null
      toolCalls?: unknown
      usage?: unknown
    }
  ): void {
    write('request_end', ctx, data)
  },

  /** 模型决定调用某个工具时，记录工具名与解析后的入参 */
  toolCall(ctx: AILogContext, data: { toolCallId: string; name: string; arguments: unknown }): void {
    write('tool_call', ctx, data)
  },

  /** 工具执行完毕，记录耗时与返回结果 */
  toolResult(
    ctx: AILogContext,
    data: { toolCallId: string; name: string; durationMs: number; result: unknown }
  ): void {
    write('tool_result', ctx, data)
  },

  /** 调用过程中出现异常 */
  error(ctx: AILogContext, data: { phase: string; message: string; stack?: string }): void {
    try {
      ensureFileExists()
      aiLogger.error('error', { event: 'error', ...ctx, ...data })
    } catch (e: unknown) {
      logger.error(`[AI-LOG] 记录 error 事件失败: ${e instanceof Error ? e.message : String(e)}`)
    }
  },
}
