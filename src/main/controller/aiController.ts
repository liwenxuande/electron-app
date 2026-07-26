import { ipcMain, BrowserWindow } from 'electron'
import { aiConfigService } from '../service/ai/aiConfigService'
import { AIAnalysisService } from '../service/ai/aiAnalysisService'
import {
  createSession,
  sessionExists,
  appendMessage,
  updateSessionTitle,
  getMessages,
  getRecentMessages,
  getMessageCount,
  listSessions,
  deleteSession,
  clearSession,
} from '../service/ai/aiDatabase'
import { logger } from '../utils/logger'
import type { ChatMessage } from '../service/ai/deepseekClient'

export function registerAIController(): void {
  const abortControllers = new Map<string, AbortController>()

  ipcMain.handle('ai:config:save', async (_event, { key, model }: { key: string; model: string }) => {
    try {
      // 只有传入真实 Key 时才保存，避免 "(已保存)" 占位符覆盖真实 Key
      if (key) {
        aiConfigService.saveApiKey(key)
      }
      aiConfigService.saveModel(model)
      return { code: 0, data: null, msg: '保存成功' }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { code: -1, data: null, msg }
    }
  })

  ipcMain.handle('ai:config:get', async () => ({
    code: 0,
    data: { hasKey: aiConfigService.hasKey(), model: aiConfigService.getModel() },
    msg: 'ok',
  }))

  ipcMain.handle('ai:config:test', async () => {
    try {
      const ok = await aiConfigService.testConnection()
      return { code: ok ? 0 : -1, data: null, msg: ok ? '连接成功' : '连接失败，请检查 API Key' }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { code: -1, data: null, msg }
    }
  })

  ipcMain.handle('ai:chat:cancel', async (_event, sessionId: string) => {
    const controller = abortControllers.get(sessionId)
    if (controller) {
      controller.abort()
      abortControllers.delete(sessionId)
    }
    return { code: 0, data: null, msg: 'ok' }
  })

  ipcMain.handle('ai:chat', async (event, params: { messages: ChatMessage[]; ledgerId: number; sessionId?: string }) => {
    const { messages, ledgerId, sessionId: inputSid } = params
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { code: -1, data: null, msg: '窗口未找到' }

    let sid = inputSid || ''
    try {
      if (!sid) {
        const s = createSession(ledgerId)
        sid = s.session_id
      } else if (!sessionExists(sid)) {
        return { code: -1, data: null, msg: '会话不存在' }
      }

      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'user' && lastMsg.content) {
        appendMessage(sid, 'user', lastMsg.content)
      }

      if (getMessageCount(sid) <= 2) {
        const title = (lastMsg?.content || '').slice(0, 30) || '新对话'
        updateSessionTitle(sid, title)
      }

      const controller = new AbortController()
      abortControllers.set(sid, controller)

      const service = new AIAnalysisService(ledgerId)
      const recentMsgs = getRecentMessages(sid).map((r) => ({
        role: r.role as 'user' | 'assistant' | 'system',
        content: r.content,
      }))

      const result = await service.chat(
        recentMsgs,
        (chunk: string) => {
          win.webContents.send('ai:chat:chunk', { sessionId: sid, chunk })
        },
        sid,
        controller.signal,
        (toolName, phase) => {
          win.webContents.send('ai:chat:tool-status', { sessionId: sid, toolName, phase })
        },
      )

      abortControllers.delete(sid)

      if (result.stopped) {
        const stoppedContent = result.text + '\n\n---\n⚠️ 用户已手动停止'
        appendMessage(sid, 'assistant', stoppedContent)
        win.webContents.send('ai:chat:done', { sessionId: sid, result: stoppedContent })
        return { code: 0, data: { sessionId: sid }, msg: 'ok' }
      }

      if (result.text) {
        appendMessage(sid, 'assistant', result.text)
      }

      win.webContents.send('ai:chat:done', { sessionId: sid, result: result.text })
      return { code: 0, data: { sessionId: sid }, msg: 'ok' }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`AI 对话失败: ${msg}`)
      abortControllers.delete(sid)
      win.webContents.send('ai:chat:error', { sessionId: sid, error: msg })
      return { code: -1, data: null, msg }
    }
  })

  ipcMain.handle('ai:report:monthly', async (event, { yearMonth, ledgerId }: { yearMonth: string; ledgerId: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { code: -1, data: null, msg: '窗口未找到' }
    try {
      const service = new AIAnalysisService(ledgerId)
      const result = await service.generateMonthlyReport(yearMonth, (chunk: string) => {
        win.webContents.send('ai:report:chunk', chunk)
      })
      win.webContents.send('ai:report:done', result)
      return { code: 0, data: null, msg: 'ok' }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`AI 报告生成失败: ${msg}`)
      win.webContents.send('ai:report:error', msg)
      return { code: -1, data: null, msg }
    }
  })

  ipcMain.handle('ai:report:stats', async (event, { statsData, ledgerId }: { statsData: Record<string, unknown>; ledgerId: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { code: -1, data: null, msg: '窗口未找到' }
    try {
      const service = new AIAnalysisService(ledgerId)
      const result = await service.analyzeStats(statsData, (chunk: string) => {
        win.webContents.send('ai:report:chunk', chunk)
      })
      win.webContents.send('ai:report:done', result)
      return { code: 0, data: null, msg: 'ok' }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`AI 统计解读失败: ${msg}`)
      win.webContents.send('ai:report:error', msg)
      return { code: -1, data: null, msg }
    }
  })

  ipcMain.handle('ai:chat:clear', async () => {
    return { code: 0, data: null, msg: '聊天历史已清空' }
  })

  ipcMain.handle('ai:session:list', async () => {
    const list = listSessions()
    return { code: 0, data: list, msg: 'ok' }
  })

  ipcMain.handle('ai:session:create', async (_event, { ledgerId }: { ledgerId: number }) => {
    const session = createSession(ledgerId)
    return { code: 0, data: { sessionId: session.session_id }, msg: 'ok' }
  })

  ipcMain.handle('ai:session:switch', async (_event, { sessionId }: { sessionId: string }) => {
    if (!sessionExists(sessionId)) {
      return { code: -1, data: null, msg: '会话不存在' }
    }
    return { code: 0, data: { sessionId }, msg: 'ok' }
  })

  ipcMain.handle('ai:session:delete', async (_event, { sessionId }: { sessionId: string }) => {
    const ok = deleteSession(sessionId)
    return { code: ok ? 0 : -1, data: null, msg: ok ? '删除成功' : '删除失败' }
  })

  ipcMain.handle('ai:chat:history', async (_event, { sessionId }: { sessionId?: string }) => {
    if (sessionId) {
      if (!sessionExists(sessionId)) return { code: -1, data: null, msg: '会话不存在' }
      const records = getMessages(sessionId).map((r) => ({
        id: String(r.id),
        role: r.role,
        content: r.content,
        timestamp: r.timestamp * 1000,
      }))
      return { code: 0, data: records, msg: 'ok' }
    }
    return { code: 0, data: [], msg: 'ok' }
  })
}
