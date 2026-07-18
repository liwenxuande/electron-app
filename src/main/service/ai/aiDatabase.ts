import DbManager from '../../db/database'
import { logger } from '../../utils/logger'

const MAX_CONTEXT_MESSAGES = 30

export interface AISessionRow {
  session_id: string
  ledger_id: number
  title: string
  created_at: number
  updated_at: number
}

export interface AIMessageRow {
  id: number
  session_id: string
  role: string
  content: string
  timestamp: number
}

export interface AISessionSummary {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  recordCount: number
}

const dbm = DbManager.getInstance()

function genSessionId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createSession(ledgerId: number, title?: string): AISessionRow {
  const id = genSessionId()
  const now = Math.floor(Date.now() / 1000)
  dbm.getDb().prepare(
    'INSERT INTO ai_sessions (session_id, ledger_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, ledgerId, title || '新对话', now, now)
  return { session_id: id, ledger_id: ledgerId, title: title || '新对话', created_at: now, updated_at: now }
}

export function sessionExists(sessionId: string): boolean {
  const row = dbm.get<{ cnt: number }>(
    'SELECT 1 as cnt FROM ai_sessions WHERE session_id = ? LIMIT 1',
    [sessionId]
  )
  return !!row
}

export function appendMessage(sessionId: string, role: string, content: string): void {
  dbm.getDb().prepare(
    'INSERT INTO ai_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, unixepoch())'
  ).run(sessionId, role, content)
  dbm.getDb().prepare(
    'UPDATE ai_sessions SET updated_at = unixepoch() WHERE session_id = ?'
  ).run(sessionId)
}

export function updateSessionTitle(sessionId: string, title: string): void {
  dbm.getDb().prepare(
    'UPDATE ai_sessions SET title = ?, updated_at = unixepoch() WHERE session_id = ?'
  ).run(title, sessionId)
}

export function getMessages(sessionId: string): AIMessageRow[] {
  return dbm.all<AIMessageRow>(
    'SELECT id, session_id, role, content, timestamp FROM ai_messages WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId]
  )
}

export function getRecentMessages(sessionId: string, limit?: number): AIMessageRow[] {
  const l = limit ?? MAX_CONTEXT_MESSAGES
  return dbm.all<AIMessageRow>(
    `SELECT role, content FROM (
       SELECT role, content, timestamp FROM ai_messages
       WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?
     ) ORDER BY timestamp ASC`,
    [sessionId, l]
  )
}

export function getMessageCount(sessionId: string): number {
  const row = dbm.get<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM ai_messages WHERE session_id = ?',
    [sessionId]
  )
  return row?.cnt ?? 0
}

export function listSessions(): AISessionSummary[] {
  const rows = dbm.all<AISessionRow & { cnt: number }>(
    `SELECT s.*, (SELECT COUNT(*) FROM ai_messages m WHERE m.session_id = s.session_id) as cnt
     FROM ai_sessions s ORDER BY s.updated_at DESC`
  )
  return rows.map((r) => ({
    sessionId: r.session_id,
    title: r.title || '新对话',
    createdAt: r.created_at * 1000,
    updatedAt: r.updated_at * 1000,
    recordCount: r.cnt ?? 0,
  }))
}

export function deleteSession(sessionId: string): boolean {
  try {
    dbm.getDb().prepare('DELETE FROM ai_messages WHERE session_id = ?').run(sessionId)
    dbm.getDb().prepare('DELETE FROM ai_sessions WHERE session_id = ?').run(sessionId)
    return true
  } catch {
    logger.error(`删除会话失败: ${sessionId}`)
    return false
  }
}

export function clearSession(sessionId: string): void {
  dbm.getDb().prepare('DELETE FROM ai_messages WHERE session_id = ?').run(sessionId)
  dbm.getDb().prepare(
    'UPDATE ai_sessions SET updated_at = unixepoch() WHERE session_id = ?'
  ).run(sessionId)
}
