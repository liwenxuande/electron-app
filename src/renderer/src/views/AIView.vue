<template>
  <div class="ai-layout">
    <aside class="ai-sidebar">
      <div class="ai-sidebar-top">
        <button class="ai-new-btn" @click="handleNewSession">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>新对话</span>
        </button>
      </div>

      <div class="ai-session-list">
        <div
          v-for="s in sessions"
          :key="s.sessionId"
          :class="['ai-session-item', { active: currentSessionId === s.sessionId }]"
          @click="handleSwitch(s.sessionId)"
        >
          <div class="ai-session-title">{{ s.title }}</div>
          <div class="ai-session-meta">
            <span class="ai-session-time">{{ formatTime(s.updatedAt) }}</span>
          </div>
          <button class="ai-session-del" title="删除" @click.stop="handleDelete(s.sessionId)">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
        <div v-if="sessions.length === 0" class="ai-no-sessions">暂无对话记录</div>
      </div>
    </aside>

    <div class="ai-main">
      <div class="ai-main-body" ref="bodyRef">
        <div v-if="!currentCache || (currentCache.messages.length === 0 && !currentCache.streaming)" class="ai-welcome">
          <div class="ai-welcome-logo">🤖</div>
          <p class="ai-welcome-text">有什么可以帮你的？</p>
          <p class="ai-welcome-hint">你可以问我收支情况、消费分析、省钱建议</p>
          <div class="ai-suggestions">
            <button v-for="q in suggestions" :key="q" class="ai-suggestion-btn" @click="handleSuggest(q)">{{ q }}</button>
          </div>
        </div>

        <template v-for="(msg, idx) in currentCache?.messages || []" :key="msg.id">
          <div v-if="showTimestamp(idx, currentCache!.messages)" class="ai-time-divider">
            <span>{{ formatDateTime(msg.timestamp) }}</span>
          </div>
          <div :class="['ai-msg', msg.role === 'user' ? 'ai-msg--user' : 'ai-msg--assistant']">
            <div class="ai-msg-avatar">
              <svg v-if="msg.role === 'user'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
              </svg>
            </div>
            <div class="ai-msg-content" v-html="renderContent(msg.content)"></div>
          </div>
        </template>

        <div v-if="currentCache?.streaming" class="ai-msg ai-msg--assistant">
          <div class="ai-msg-avatar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div class="ai-msg-content" v-html="renderContent(currentCache.streamingText || '思考中...')"></div>
        </div>

        <div v-if="currentCache?.errorMsg" class="ai-error">{{ currentCache.errorMsg }}</div>
      </div>

      <div class="ai-main-footer">
        <input
          v-model="inputText"
          class="ai-input"
          placeholder="输入你的问题..."
          maxlength="500"
          @keyup.enter="handleSend"
        />
        <button class="ai-send-btn" :disabled="!inputText.trim()" @click="handleSend">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { useLedgerStore } from '../stores/ledgerStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface SessionItem {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  recordCount: number
}

interface SessionCache {
  messages: ChatMessage[]
  streaming: boolean
  streamingText: string
  errorMsg: string
  loaded: boolean
  sending: boolean
}

const ledgerStore = useLedgerStore()
const bodyRef = ref<HTMLElement>()
const inputText = ref('')

const sessions = ref<SessionItem[]>([])
const currentSessionId = ref<string | null>(null)
const sessionCacheMap = new Map<string, SessionCache>()

const currentCache = computed(() => {
  const sid = currentSessionId.value
  if (!sid) return null
  const cache = getOrCreateCache(sid)
  return cache
})

const suggestions = [
  '这个月花最多的是哪个分类？',
  '帮我分析一下本月消费趋势',
  '有什么省钱建议？',
  '上月和这月支出对比有什么变化？',
]

function getOrCreateCache(sid: string): SessionCache {
  if (!sessionCacheMap.has(sid)) {
    const cache = reactive({
      messages: [] as ChatMessage[],
      streaming: false,
      streamingText: '',
      errorMsg: '',
      loaded: false,
      sending: false,
    }) as SessionCache
    sessionCacheMap.set(sid, cache)
  }
  return sessionCacheMap.get(sid)!
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function scrollToBottom() {
  nextTick(() => {
    const el = bodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

async function fetchSessions() {
  try {
    const res = await window.aiAPI.listSessions()
    if (res.code === 0 && res.data) {
      sessions.value = res.data
    }
  } catch { /* ignore */ }
}

async function loadSessionHistory(sessionId: string) {
  const cache = getOrCreateCache(sessionId)
  if (cache.loaded) return
  try {
    const res = await window.aiAPI.getHistory({ sessionId })
    if (res.code === 0 && res.data) {
      cache.messages = res.data.map((r: { id: string; role: string; content: string; timestamp: number }) => ({
        ...r,
        role: r.role as 'user' | 'assistant',
      }))
    }
  } catch { /* ignore */ }
  cache.loaded = true
}

async function switchToSession(sessionId: string) {
  currentSessionId.value = sessionId
  const cache = getOrCreateCache(sessionId)
  if (!cache.loaded) {
    await loadSessionHistory(sessionId)
  }
  scrollToBottom()
}

async function handleNewSession() {
  try {
    const res = await window.aiAPI.createSession(ledgerStore.currentId)
    if (res.code === 0) {
      await fetchSessions()
      const sid = res.data?.sessionId || ''
      if (sid) {
        switchToSession(sid)
      }
    }
  } catch { /* ignore */ }
}

async function handleSwitch(sessionId: string) {
  switchToSession(sessionId)
}

async function handleDelete(sessionId: string) {
  await window.aiAPI.deleteSession(sessionId)
  sessionCacheMap.delete(sessionId)
  if (currentSessionId.value === sessionId) {
    currentSessionId.value = null
  }
  await fetchSessions()
}

function handleSuggest(text: string) {
  inputText.value = text
  handleSend()
}

async function handleSend() {
  const text = inputText.value.trim()
  inputText.value = ''
  if (!text) return

  const sid = currentSessionId.value
  const cache = sid ? getOrCreateCache(sid) : null
  if (cache?.sending) return

  const userMsg: ChatMessage = { id: genId(), role: 'user', content: text, timestamp: Date.now() }
  if (!cache) {
    const res = await window.aiAPI.createSession(ledgerStore.currentId)
    const newSid = res.data?.sessionId
    if (!newSid) return
    const newCache = getOrCreateCache(newSid)
    newCache.messages = [userMsg]
    newCache.sending = true
    newCache.streaming = true
    newCache.streamingText = ''
    newCache.errorMsg = ''
    currentSessionId.value = newSid
    await fetchSessions()
    scrollToBottom()
    window.aiAPI.chat({
      messages: [{ role: 'user', content: text }],
      ledgerId: ledgerStore.currentId,
      sessionId: newSid,
    }).catch((e: unknown) => {
      newCache.errorMsg = e instanceof Error ? e.message : '请求失败'
      newCache.streaming = false
      newCache.sending = false
    })
    return
  }

  cache.messages = [...cache.messages, userMsg]
  cache.sending = true
  cache.streaming = true
  cache.streamingText = ''
  cache.errorMsg = ''
  scrollToBottom()

  try {
    await window.aiAPI.chat({
      messages: [{ role: 'user', content: text }],
      ledgerId: ledgerStore.currentId,
      sessionId: sid || undefined,
    })
  } catch (e: unknown) {
    cache.errorMsg = e instanceof Error ? e.message : '请求失败'
    cache.streaming = false
    cache.sending = false
    cache.streamingText = ''
  }
}

function showTimestamp(idx: number, msgs: ChatMessage[]): boolean {
  if (idx === 0) return true
  const gap = msgs[idx].timestamp - msgs[idx - 1].timestamp
  return gap > 5 * 60 * 1000
}

function renderContent(text: string): string {
  const lines = text.split('\n')
  const html: string[] = []
  let inTable = false
  let inList = false
  const rows: string[] = []

  function closeTable() {
    if (!inTable || rows.length === 0) return
    html.push('<div class="ai-table"><table>')
    for (let i = 0; i < rows.length; i++) {
      if (/^[\|\s\-:]+$/.test(rows[i])) continue
      const cells = rows[i].replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
      const tag = i === 0 ? 'th' : 'td'
      html.push(`<tr>${cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join('')}</tr>`)
    }
    html.push('</table></div>')
    rows.length = 0
    inTable = false
  }

  function closeList() {
    if (inList) { html.push('</ul>'); inList = false }
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function inline(s: string) {
    return escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) { closeTable(); closeList(); continue }
    const hm = t.match(/^(#{2,3})\s+(.+)/)
    if (hm) {
      closeTable(); closeList()
      html.push(`<${hm[1].length === 2 ? 'h4' : 'h5'}>${inline(hm[2])}</${hm[1].length === 2 ? 'h4' : 'h5'}>`)
      continue
    }
    if (/^-{3,}$/.test(t)) { closeTable(); closeList(); html.push('<hr />'); continue }
    if (t.startsWith('> ')) { closeTable(); closeList(); html.push(`<blockquote>${inline(t.slice(2))}</blockquote>`); continue }
    if (/^[-*]\s/.test(t)) { closeTable(); if (!inList) { html.push('<ul>'); inList = true }; html.push(`<li>${inline(t.replace(/^[-*]\s/, ''))}</li>`); continue }
    if (t.startsWith('|')) { closeList(); inTable = true; rows.push(t); continue }
    closeTable(); closeList(); html.push(`<p>${inline(t)}</p>`)
  }
  closeTable(); closeList()
  return html.join('')
}

function formatTime(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  const d = new Date(ts)
  return d.toLocaleDateString().replaceAll('/', '-')
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  return `${MM}-${DD} ${hh}:${mm}`
}

let listenersRegistered = false
function ensureListeners() {
  if (listenersRegistered) return
  listenersRegistered = true
  window.aiAPI.onChatChunk(onChunk)
  window.aiAPI.onChatDone(onDone)
  window.aiAPI.onChatError(onError)
}

function onChunk(data: { sessionId: string; chunk: string }) {
  const cache = getOrCreateCache(data.sessionId)
  cache.streamingText += data.chunk
  if (currentSessionId.value === data.sessionId) {
    scrollToBottom()
  }
}

function onDone(data: { sessionId: string; result: string }) {
  const cache = getOrCreateCache(data.sessionId)
  cache.messages = [...cache.messages, { id: genId(), role: 'assistant', content: data.result, timestamp: Date.now() }]
  cache.streamingText = ''
  cache.streaming = false
  cache.sending = false
  if (currentSessionId.value === data.sessionId) {
    scrollToBottom()
  }
  fetchSessions()
}

function onError(data: { sessionId: string; error: string }) {
  const cache = getOrCreateCache(data.sessionId)
  cache.errorMsg = data.error
  cache.streaming = false
  cache.streamingText = ''
  cache.sending = false
}

ensureListeners()

onMounted(async () => {
  await fetchSessions()
  if (sessions.value.length > 0) {
    switchToSession(sessions.value[0].sessionId)
  }
})
</script>

<style scoped>
.ai-layout { flex: 1; display: flex; overflow: hidden; background: transparent; }

.ai-sidebar {
  width: 240px; flex-shrink: 0; display: flex; flex-direction: column;
  background: #F3F4F6; border-right: 1px solid #E5E7EB;
}
.ai-sidebar-top { padding: 14px; }
.ai-new-btn {
  width: 100%; padding: 9px 0; border-radius: 8px; border: 1px dashed #D1D5DB;
  background: transparent; color: #6B7280; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: inherit; transition: all 0.15s;
}
.ai-new-btn:hover { background: #E5E7EB; color: #374151; border-color: #9CA3AF; }

.ai-session-list { flex: 1; overflow-y: auto; padding: 0 10px 10px; }
.ai-session-item {
  padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: all 0.12s;
  position: relative; margin-bottom: 2px;
}
.ai-session-item:hover { background: #E5E7EB; }
.ai-session-item.active { background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

.ai-session-title {
  font-size: 0.8125rem; font-weight: 500; color: #374151;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 20px;
}
.ai-session-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.ai-session-time { font-size: 0.6875rem; color: #9CA3AF; }

.ai-session-del {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border: none; background: transparent; cursor: pointer;
  color: #D1D5DB; border-radius: 4px; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: all 0.15s;
}
.ai-session-item:hover .ai-session-del { opacity: 1; }
.ai-session-del:hover { color: #EF4444; background: rgba(239,68,68,0.08); }
.ai-no-sessions { text-align: center; padding: 20px; font-size: 0.75rem; color: #9CA3AF; }

.ai-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
.ai-main-body { flex: 1; overflow-y: auto; padding: 20px 0; display: flex; flex-direction: column; gap: 14px; align-items: center; }

.ai-welcome { text-align: center; padding-top: 100px; }
.ai-welcome-logo { font-size: 2.5rem; margin-bottom: 12px; }
.ai-welcome-text { font-size: 1.125rem; font-weight: 600; color: #1A1A2E; margin-bottom: 6px; }
.ai-welcome-hint { font-size: 0.8125rem; color: #9CA3AF; margin-bottom: 24px; }
.ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 520px; }
.ai-suggestion-btn {
  padding: 8px 18px; border-radius: 999px; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; font-family: inherit; border: 1px solid #E5E7EB; background: #fff;
  color: #6B7280; transition: all 0.15s; white-space: nowrap;
}
.ai-suggestion-btn:hover { border-color: #FF8C00; color: #FF8C00; background: rgba(255,140,0,0.04); }

.ai-time-divider {
  width: 100%; max-width: 720px; text-align: center; padding: 4px 0; margin: 8px 0;
}
.ai-time-divider span {
  font-size: 0.6875rem; color: #9CA3AF; background: #fff; padding: 2px 12px;
  border-radius: 999px; border: 1px solid #F0F2F5;
}

.ai-msg { display: flex; gap: 12px; width: 100%; max-width: 720px; padding: 0 32px; box-sizing: border-box; }
.ai-msg--user { flex-direction: row-reverse; }
.ai-msg--assistant { flex-direction: row; }

.ai-msg-avatar {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.ai-msg--assistant .ai-msg-avatar { background: rgba(255,140,0,0.1); color: #FF8C00; }
.ai-msg--user .ai-msg-avatar { background: #F0F2F5; color: #6B7280; }

.ai-msg-content {
  padding: 10px 14px; border-radius: 12px; font-size: 0.8125rem; line-height: 1.7;
  color: #1A1A2E; max-width: 85%; min-width: 0;
}
.ai-msg--assistant .ai-msg-content { background: #F9FAFB; border-bottom-left-radius: 4px; }
.ai-msg--user .ai-msg-content { background: #FF8C00; color: #fff; border-bottom-right-radius: 4px; }
.ai-msg--user .ai-msg-content :deep(strong) { color: #fff; }
.ai-msg-content :deep(strong) { font-weight: 600; color: #FF8C00; }
.ai-msg-content :deep(h4) { font-size: 0.875rem; font-weight: 700; color: #1A1A2E; margin: 8px 0 4px; padding-bottom: 3px; border-bottom: 1px solid #F0F2F5; }
.ai-msg-content :deep(h5) { font-size: 0.8125rem; font-weight: 600; color: #374151; margin: 6px 0 3px; }
.ai-msg-content :deep(p) { margin: 0 0 4px; }
.ai-msg-content :deep(hr) { border: none; border-top: 1px solid #E5E7EB; margin: 8px 0; }
.ai-msg-content :deep(blockquote) { margin: 4px 0; padding: 4px 10px; border-left: 3px solid #FF8C00; background: rgba(255,140,0,0.04); border-radius: 0 4px 4px 0; color: #6B7280; font-size: 0.8125rem; }
.ai-msg-content :deep(ul) { margin: 2px 0; padding-left: 16px; }
.ai-msg-content :deep(li) { margin: 1px 0; }
.ai-msg-content :deep(.ai-table) { margin: 6px 0; overflow-x: auto; }
.ai-msg-content :deep(.ai-table table) { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
.ai-msg-content :deep(.ai-table th), .ai-msg-content :deep(.ai-table td) { padding: 5px 8px; border: 1px solid #E5E7EB; text-align: left; }
.ai-msg-content :deep(.ai-table th) { background: rgba(255,140,0,0.06); font-weight: 600; color: #374151; }
.ai-msg-content :deep(code) { padding: 1px 4px; border-radius: 3px; font-size: 0.75rem; background: rgba(255,140,0,0.06); color: #FF8C00; font-family: monospace; }

.ai-error { padding: 10px 14px; border-radius: 8px; background: rgba(239,68,68,0.08); color: #EF4444; font-size: 0.8125rem; max-width: 720px; width: 100%; margin: 0 auto; }

.ai-main-footer { padding: 14px 32px; border-top: 1px solid #F0F2F5; display: flex; gap: 10px; align-items: center; }
.ai-input {
  flex: 1; padding: 11px 16px; border-radius: 12px; border: 1px solid #E5E7EB;
  font-size: 0.875rem; color: #1A1A2E; outline: none; font-family: inherit; background: #F9FAFB;
}
.ai-input:focus { border-color: #FF8C00; background: #fff; }
.ai-input::placeholder { color: #9CA3AF; }
.ai-input:disabled { opacity: 0.6; }
.ai-send-btn {
  width: 42px; height: 42px; border-radius: 12px; border: none;
  background: #FF8C00; color: #fff; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: background-color 0.15s;
  flex-shrink: 0;
}
.ai-send-btn:hover { background: #E07800; }
.ai-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
