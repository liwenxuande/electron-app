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
          v-for="s in store.sessions"
          :key="s.sessionId"
          :class="['ai-session-item', { active: store.currentSessionId === s.sessionId }]"
          @click="handleSwitch(s.sessionId)"
        >
          <div class="ai-session-title">{{ s.title }}</div>
          <div class="ai-session-meta">
            <span class="ai-session-time">{{ store.formatTime(s.updatedAt) }}</span>
          </div>
          <button class="ai-session-del" title="删除" @click.stop="handleDelete(s.sessionId)">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
        <div v-if="store.sessions.length === 0" class="ai-no-sessions">暂无对话记录</div>
      </div>
    </aside>

    <div class="ai-main">
      <div class="ai-main-body" ref="bodyRef">
        <div v-if="store.messages.length === 0 && !isStreaming && !isThinking" class="ai-welcome">
          <div class="ai-welcome-logo">🤖</div>
          <p class="ai-welcome-text">有什么可以帮你的？</p>
          <p class="ai-welcome-hint">你可以问我收支情况、消费分析、省钱建议</p>
          <div class="ai-suggestions">
            <button v-for="q in suggestions" :key="q" class="ai-suggestion-btn" @click="handleSuggest(q)">{{ q }}</button>
          </div>
        </div>

        <template v-for="(msg, idx) in store.messages" :key="msg.id">
          <div v-if="showTimestamp(idx)" class="ai-time-divider">
            <span>{{ formatDateTime(msg.timestamp) }}</span>
          </div>

          <!-- tool-status 消息 -->
          <div v-if="msg.role === 'tool-status'" class="ai-tool-status">
            <span v-if="!msg.toolDone" class="ai-tool-spinner"></span>
            <span v-else class="ai-tool-done">&#10003;</span>
            <span class="ai-tool-label">{{ TOOL_LABELS[msg.toolName || ''] || msg.toolName }}</span>
            <span class="ai-tool-phase">{{ msg.toolDone ? '完成' : '中...' }}</span>
          </div>

          <!-- 用户/AI 消息 -->
          <div v-else :class="['ai-msg', msg.role === 'user' ? 'ai-msg--user' : 'ai-msg--assistant']">
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

        <!-- 流式输出 -->
        <div v-if="isStreaming" class="ai-msg ai-msg--assistant">
          <div class="ai-msg-avatar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div class="ai-msg-content" v-html="renderContent(streamingText || '')"></div>
        </div>

        <!-- 思考中状态 -->
        <div v-if="isThinking && !isStreaming" class="ai-msg ai-msg--assistant">
          <div class="ai-msg-avatar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div class="ai-msg-content ai-thinking-msg">
            <span class="ai-thinking">
              <span class="ai-thinking-dot"></span>
              <span>AI 正在思考...</span>
            </span>
          </div>
        </div>

        <!-- 错误 + 重试 -->
        <div v-if="errorMsg" class="ai-error">
          <span>&#10060; {{ errorMsg }}</span>
          <button class="ai-retry-btn" @click="handleRetry">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            <span>重试</span>
          </button>
        </div>
      </div>

      <div class="ai-main-footer">
        <input
          v-model="inputText"
          class="ai-input"
          placeholder="输入你的问题..."
          maxlength="500"
          :disabled="sending"
          @keyup.enter="handleSend"
        />
        <button
          v-if="isStreaming || isThinking"
          class="ai-stop-btn"
          title="停止生成"
          @click="handleStop"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
        </button>
        <button
          v-else
          class="ai-send-btn"
          :disabled="!inputText.trim()"
          @click="handleSend"
        >
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
import { ref, nextTick, onMounted } from 'vue'
import { useLedgerStore } from '../stores/ledgerStore'
import { useAISessionStore } from '../stores/aiSessionStore'
import { marked } from 'marked'

const TOOL_LABELS: Record<string, string> = {
  get_current_time: '获取当前时间',
  get_monthly_summary: '查询月度收支',
  get_category_breakdown: '分析分类排行',
  get_daily_trend: '查看每日走势',
  get_top_entries: '查看交易明细',
  compare_months: '对比月度数据',
}

const ledgerStore = useLedgerStore()
const store = useAISessionStore()
const bodyRef = ref<HTMLElement>()
const inputText = ref('')
const isStreaming = ref(false)
const streamingText = ref('')
const isThinking = ref(false)
const errorMsg = ref('')
const sending = ref(false)

const suggestions = [
  '这个月花最多的是哪个分类？',
  '帮我分析一下本月消费趋势',
  '有什么省钱建议？',
  '上月和这月支出对比有什么变化？',
]

// marked 配置
const renderer = new marked.Renderer()
renderer.html = () => ''

marked.setOptions({
  renderer,
  breaks: true,
  gfm: true,
})

function renderContent(text: string): string {
  if (!text) return ''
  const html = marked.parse(text) as string
  // marked 输出裸 <table>，用 .ai-table 包装以匹配 CSS
  return html.replace(/<table>/g, '<div class="ai-table"><table>').replace(/<\/table>/g, '</table></div>')
}

function scrollToBottom() {
  nextTick(() => {
    const el = bodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function showTimestamp(idx: number): boolean {
  if (idx === 0) return true
  const msgs = store.messages
  if (!msgs[idx] || !msgs[idx - 1]) return false
  const gap = msgs[idx].timestamp - msgs[idx - 1].timestamp
  return gap > 5 * 60 * 1000
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const DD = String(d.getDate()).padStart(2, '0')
  return `${MM}-${DD} ${hh}:${mm}`
}

async function handleSuggest(text: string) {
  inputText.value = text
  await handleSend()
}

async function handleNewSession() {
  const sid = await store.createSession(ledgerStore.currentId)
  if (sid) {
    store.clearToolStatuses()
  }
}

async function handleSwitch(sessionId: string) {
  // 切换前保存当前正在流式输出的文本
  if (isStreaming.value && streamingText.value) {
    store.addAssistantMessage(streamingText.value)
  }
  isStreaming.value = false
  streamingText.value = ''
  isThinking.value = false
  errorMsg.value = ''
  sending.value = false
  await store.switchSession(sessionId)
  scrollToBottom()
}

async function handleDelete(sessionId: string) {
  await store.deleteSession(sessionId)
}

async function handleSend() {
  const text = inputText.value.trim()
  inputText.value = ''
  if (!text || sending.value) return

  let sid = store.currentSessionId
  if (!sid) {
    sid = await store.createSession(ledgerStore.currentId)
    if (!sid) return
  }

  store.addUserMessage(text)
  sending.value = true
  isStreaming.value = false
  streamingText.value = ''
  isThinking.value = true
  errorMsg.value = ''
  scrollToBottom()

  try {
    await window.aiAPI.chat({
      messages: [{ role: 'user', content: text }],
      ledgerId: ledgerStore.currentId,
      sessionId: sid,
    })
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '请求失败'
    isThinking.value = false
    isStreaming.value = false
    sending.value = false
  }
}

async function handleStop() {
  const sid = store.currentSessionId
  if (!sid) return
  await window.aiAPI.cancelChat(sid)
}

async function handleRetry() {
  if (store.messages.length === 0) return
  const lastUserMsg = [...store.messages].reverse().find(m => m.role === 'user')
  if (!lastUserMsg) return

  errorMsg.value = ''
  sending.value = true
  isThinking.value = true
  isStreaming.value = false
  streamingText.value = ''

  try {
    await window.aiAPI.chat({
      messages: [{ role: 'user', content: lastUserMsg.content }],
      ledgerId: ledgerStore.currentId,
      sessionId: store.currentSessionId || undefined,
    })
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '请求失败'
    isThinking.value = false
    sending.value = false
  }
}

// IPC 事件监听
function onChunk(data: { sessionId: string; chunk: string }) {
  if (data.sessionId !== store.currentSessionId) return
  isThinking.value = false
  isStreaming.value = true
  streamingText.value += data.chunk
  // 第一个 chunk 时清除 tool status
  if (store.messages.some(m => m.role === 'tool-status')) {
    store.clearToolStatuses()
  }
  scrollToBottom()
}

function onDone(data: { sessionId: string; result: string }) {
  if (data.sessionId !== store.currentSessionId) return
  if (streamingText.value) {
    store.addAssistantMessage(streamingText.value)
  }
  isStreaming.value = false
  streamingText.value = ''
  isThinking.value = false
  sending.value = false
  errorMsg.value = ''
  store.clearToolStatuses()
  store.fetchSessions()
  scrollToBottom()
}

function onError(data: { sessionId: string; error: string }) {
  if (data.sessionId !== store.currentSessionId) return
  errorMsg.value = data.error
  isStreaming.value = false
  streamingText.value = ''
  isThinking.value = false
  sending.value = false
  store.clearToolStatuses()
}

function onToolStatus(data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) {
  if (data.sessionId !== store.currentSessionId) return
  if (data.phase === 'start') {
    isThinking.value = true
    store.addToolStatus(data.toolName)
  } else {
    store.markToolDone(data.toolName)
  }
}

let listenersRegistered = false
function ensureListeners() {
  if (listenersRegistered) return
  listenersRegistered = true
  window.aiAPI.onChatChunk(onChunk)
  window.aiAPI.onChatDone(onDone)
  window.aiAPI.onChatError(onError)
  window.aiAPI.onToolStatus(onToolStatus)
}

ensureListeners()

onMounted(async () => {
  await store.init(ledgerStore.currentId)
  scrollToBottom()
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

.ai-error { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 8px; background: rgba(239,68,68,0.08); color: #EF4444; font-size: 0.8125rem; max-width: 720px; width: 100%; margin: 0 auto; }

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

/* 工具调用状态条 */
.ai-tool-status {
  display: flex; align-items: center; gap: 6px;
  width: 100%; max-width: 720px; padding: 0 32px; box-sizing: border-box;
  font-size: 0.75rem; color: #6B7280;
}

.ai-tool-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid #E5E7EB; border-top-color: #FF8C00; border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
}

@keyframes ai-spin { to { transform: rotate(360deg); } }

.ai-tool-done { color: #10B981; font-size: 0.875rem; }

.ai-tool-label { color: #374151; }

.ai-tool-phase { color: #9CA3AF; }

/* 思考动画 */
.ai-thinking { display: flex; align-items: center; gap: 6px; }

.ai-thinking-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; background: #FF8C00;
  animation: ai-pulse 1.2s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.5); opacity: 1; }
}

.ai-thinking-msg { min-height: 36px; display: flex; align-items: center; }

/* 停止按钮 */
.ai-stop-btn {
  width: 42px; height: 42px; border-radius: 12px; border: none;
  background: #EF4444; color: #fff; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: background-color 0.15s;
  flex-shrink: 0;
}
.ai-stop-btn:hover { background: #DC2626; }

/* 重试按钮 */
.ai-retry-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 12px; border-radius: 6px; border: 1px solid #EF4444;
  background: transparent; color: #EF4444; font-size: 0.75rem;
  cursor: pointer; font-family: inherit; transition: all 0.15s;
  white-space: nowrap;
}
.ai-retry-btn:hover { background: rgba(239,68,68,0.08); }
</style>
