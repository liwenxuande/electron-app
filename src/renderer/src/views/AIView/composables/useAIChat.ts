/**
 * AIView 的聊天状态机与 IPC 通信逻辑。
 * 从 AIView/index.vue 中抽离，原组件里 handleSend/handleRetry 高度重复、
 * IPC 监听器也没有在卸载时清理，这里一并处理：
 * - 发送/重试合并为同一条内部实现 sendChat()
 * - 监听器改为 onMounted 注册 + onUnmounted 清理，不再依赖那个不生效的"单例守卫"变量
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { useLedgerStore } from '@/stores/ledgerStore'
import { useAISessionStore } from '@/stores/aiSessionStore'
import type { ChatChunkPayload, ChatDonePayload, ChatErrorPayload, ToolStatusPayload } from '../types'

export function useAIChat(scrollToBottom: () => void) {
  const ledgerStore = useLedgerStore()
  const store = useAISessionStore()

  const isStreaming = ref(false)
  const streamingText = ref('')
  const isThinking = ref(false)
  const errorMsg = ref('')
  const sending = ref(false)

  function resetTransientState() {
    isStreaming.value = false
    streamingText.value = ''
    isThinking.value = false
    errorMsg.value = ''
  }

  /** 发送/重试共用的核心逻辑 */
  async function sendChat(content: string, sessionId: string | undefined) {
    sending.value = true
    isStreaming.value = false
    streamingText.value = ''
    isThinking.value = true
    errorMsg.value = ''
    scrollToBottom()

    try {
      await window.aiAPI.chat({
        messages: [{ role: 'user', content }],
        ledgerId: ledgerStore.currentId,
        sessionId,
      })
    } catch (e: unknown) {
      errorMsg.value = e instanceof Error ? e.message : '请求失败'
      isThinking.value = false
      isStreaming.value = false
      sending.value = false
    }
  }

  async function handleSend(text: string) {
    if (!text || sending.value) return

    let sid = store.currentSessionId
    if (!sid) {
      sid = await store.createSession(ledgerStore.currentId)
      if (!sid) return
    }

    store.addUserMessage(text)
    await sendChat(text, sid)
  }

  async function handleRetry() {
    if (store.messages.length === 0) return
    const lastUserMsg = [...store.messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return

    await sendChat(lastUserMsg.content, store.currentSessionId || undefined)
  }

  async function handleStop() {
    const sid = store.currentSessionId
    if (!sid) return
    await window.aiAPI.cancelChat(sid)
  }

  async function handleNewSession() {
    // 如果已有空对话，直接切过去
    const emptySession = store.sessions.find(s => s.recordCount === 0)
    if (emptySession) {
      await handleSwitch(emptySession.sessionId)
      return
    }
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
    resetTransientState()
    sending.value = false
    await store.switchSession(sessionId)
    scrollToBottom()
  }

  async function handleDelete(sessionId: string) {
    await store.deleteSession(sessionId)
  }

  // ---- IPC 事件监听 ----
  function onChunk(data: ChatChunkPayload) {
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

  function onDone(data: ChatDonePayload) {
    if (data.sessionId !== store.currentSessionId) {
      // 后台会话完成，刷新其缓存
      store.refreshCache(data.sessionId)
      return
    }
    // 当前会话完成：从 DB 刷新缓存，确保消息完整（处理切换回来时 streamingText 已清空的情况）
    resetTransientState()
    sending.value = false
    store.clearToolStatuses()
    store.fetchSessions()
    // 重新从 DB 加载当前会话的完整消息并更新缓存
    store.refreshCache(store.currentSessionId).then(() => {
      scrollToBottom()
    })
  }

  function onError(data: ChatErrorPayload) {
    if (data.sessionId !== store.currentSessionId) return
    errorMsg.value = data.error
    isStreaming.value = false
    streamingText.value = ''
    isThinking.value = false
    sending.value = false
    store.clearToolStatuses()
  }

  function onToolStatus(data: ToolStatusPayload) {
    if (data.sessionId !== store.currentSessionId) return
    if (data.phase === 'start') {
      isThinking.value = true
      store.addToolStatus(data.toolName)
    } else {
      store.markToolDone(data.toolName)
    }
  }

  onMounted(() => {
    window.aiAPI.onChatChunk(onChunk)
    window.aiAPI.onChatDone(onDone)
    window.aiAPI.onChatError(onError)
    window.aiAPI.onToolStatus(onToolStatus)
  })

  onUnmounted(() => {
    // 组件卸载时清理监听器，避免残留回调引用已销毁的状态
    window.aiAPI.removeAllListeners()
  })

  return {
    ledgerStore,
    store,
    isStreaming,
    streamingText,
    isThinking,
    errorMsg,
    sending,
    handleSend,
    handleRetry,
    handleStop,
    handleNewSession,
    handleSwitch,
    handleDelete,
  }
}
