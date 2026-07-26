import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SessionItem {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  recordCount: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool-status'
  content: string
  timestamp: number
  // tool-status 专用
  toolName?: string
  toolDone?: boolean
}

export const useAISessionStore = defineStore('aiSession', () => {
  const sessions = ref<SessionItem[]>([])
  const currentSessionId = ref<string | null>(null)
  const loading = ref(false)
  const messages = ref<ChatMessage[]>([])
  // 按 sessionId 缓存消息列表，切换会话时不用每次从数据库加载
  const messageCache = new Map<string, ChatMessage[]>()

  function genId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  }

  function setMessages(msgs: ChatMessage[]) {
    messages.value = msgs
  }

  function addUserMessage(content: string) {
    const msg: ChatMessage = { id: genId(), role: 'user', content, timestamp: Date.now() }
    messages.value = [...messages.value, msg]
    return msg
  }

  function addAssistantMessage(content: string) {
    const msg: ChatMessage = { id: genId(), role: 'assistant', content, timestamp: Date.now() }
    messages.value = [...messages.value, msg]
    return msg
  }

  function addToolStatus(toolName: string) {
    const msg: ChatMessage = {
      id: genId(),
      role: 'tool-status',
      content: '',
      timestamp: Date.now(),
      toolName,
      toolDone: false,
    }
    messages.value = [...messages.value, msg]
    return msg
  }

  function markToolDone(toolName: string) {
    const idx = messages.value.findIndex(m => m.role === 'tool-status' && m.toolName === toolName && !m.toolDone)
    if (idx !== -1) {
      const updated = [...messages.value]
      updated[idx] = { ...updated[idx], toolDone: true }
      messages.value = updated
    }
  }

  function clearToolStatuses() {
    messages.value = messages.value.filter(m => m.role !== 'tool-status')
  }

  function clearMessages() {
    messages.value = []
  }

  async function fetchSessions() {
    try {
      const res = await window.aiAPI.listSessions()
      if (res.code === 0 && res.data) {
        sessions.value = res.data
      }
    } catch { /* ignore */ }
  }

  async function createSession(ledgerId: number): Promise<string | null> {
    try {
      const res = await window.aiAPI.createSession(ledgerId)
      if (res.code === 0) {
        await fetchSessions()
        const sid = res.data?.sessionId || null
        if (sid) {
          currentSessionId.value = sid
          messages.value = []
        }
        return sid
      }
    } catch { /* ignore */ }
    return null
  }

  async function switchSession(sessionId: string) {
    // 切走前，把当前会话的消息存到缓存
    if (currentSessionId.value && messages.value.length > 0) {
      messageCache.set(currentSessionId.value, [...messages.value])
    }
    currentSessionId.value = sessionId
    // 优先从缓存加载
    const cached = messageCache.get(sessionId)
    if (cached) {
      messages.value = cached
      return
    }
    loading.value = true
    try {
      const res = await window.aiAPI.getHistory({ sessionId })
      if (res.code === 0 && res.data) {
        messages.value = res.data.map((r: { id: string; role: string; content: string; timestamp: number }) => ({
          ...r,
          role: r.role as 'user' | 'assistant',
        } as ChatMessage))
        messageCache.set(sessionId, [...messages.value])
      }
    } catch { /* ignore */ }
    loading.value = false
  }

  /** 从数据库刷新指定会话的缓存和当前视图 */
  async function refreshCache(sessionId: string) {
    try {
      const res = await window.aiAPI.getHistory({ sessionId })
      if (res.code === 0 && res.data) {
        const msgs = res.data.map((r: { id: string; role: string; content: string; timestamp: number }) => ({
          ...r,
          role: r.role as 'user' | 'assistant',
        } as ChatMessage))
        messageCache.set(sessionId, msgs)
        // 如果是当前会话，同步更新视图
        if (currentSessionId.value === sessionId) {
          messages.value = msgs
        }
      }
    } catch { /* ignore */ }
  }

  async function deleteSession(sessionId: string) {
    try {
      await window.aiAPI.deleteSession(sessionId)
      sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)
      messageCache.delete(sessionId)
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = null
        messages.value = []
      }
    } catch { /* ignore */ }
  }

  async function init(ledgerId: number) {
    await fetchSessions()
    if (sessions.value.length > 0) {
      await switchSession(sessions.value[0].sessionId)
    } else {
      await createSession(ledgerId)
    }
  }

  function formatTime(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const time = `${hh}:${mm}`
    if (isToday) return time
    if (isYesterday) return `昨天 ${time}`
    const MM = String(d.getMonth() + 1).padStart(2, '0')
    const DD = String(d.getDate()).padStart(2, '0')
    if (d.getFullYear() === now.getFullYear()) return `${MM}-${DD} ${time}`
    return `${d.getFullYear()}-${MM}-${DD} ${time}`
  }

  return {
    sessions,
    currentSessionId,
    loading,
    messages,
    setMessages,
    addUserMessage,
    addAssistantMessage,
    addToolStatus,
    markToolDone,
    clearToolStatuses,
    clearMessages,
    fetchSessions,
    createSession,
    switchSession,
    refreshCache,
    deleteSession,
    init,
    formatTime,
  }
})
