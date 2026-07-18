import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SessionItem {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  recordCount: number
}

export const useAISessionStore = defineStore('aiSession', () => {
  const sessions = ref<SessionItem[]>([])
  const currentSessionId = ref<string | null>(null)
  const loading = ref(false)

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
        return sessions.value[0]?.sessionId || null
      }
    } catch { /* ignore */ }
    return null
  }

  async function switchSession(sessionId: string) {
    currentSessionId.value = sessionId
    loading.value = true
  }

  async function deleteSession(sessionId: string) {
    try {
      await window.aiAPI.deleteSession(sessionId)
      sessions.value = sessions.value.filter(s => s.sessionId !== sessionId)
      if (currentSessionId.value === sessionId) {
        currentSessionId.value = null
      }
    } catch { /* ignore */ }
  }

  async function init(ledgerId: number) {
    await fetchSessions()
    if (sessions.value.length > 0) {
      currentSessionId.value = sessions.value[0].sessionId
    } else {
      const id = await createSession(ledgerId)
      currentSessionId.value = id
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
    fetchSessions,
    createSession,
    switchSession,
    deleteSession,
    init,
    formatTime,
  }
})
