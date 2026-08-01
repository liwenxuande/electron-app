<template>
  <div class="ai-layout">
    <SessionSidebar
      :sessions="chat.store.sessions"
      :current-session-id="chat.store.currentSessionId"
      :format-time="chat.store.formatTime"
      @new="chat.handleNewSession"
      @switch="chat.handleSwitch"
      @delete="chat.handleDelete"
    />

    <div class="ai-main">
      <div class="ai-main-body" ref="bodyRef">
        <div v-if="chat.store.messages.length === 0 && !chat.isStreaming.value && !chat.isThinking.value" class="ai-welcome">
          <div class="ai-welcome-logo">🤖</div>
          <p class="ai-welcome-text">有什么可以帮你的？</p>
          <p class="ai-welcome-hint">你可以问我收支情况、消费分析、省钱建议</p>
          <div class="ai-suggestions">
            <button v-for="q in suggestions" :key="q" class="ai-suggestion-btn" @click="handleSuggest(q)">{{ q }}</button>
          </div>
        </div>

        <template v-for="(msg, idx) in chat.store.messages" :key="msg.id">
          <div v-if="showTimestamp(idx)" class="ai-time-divider">
            <span>{{ formatDateTime(msg.timestamp) }}</span>
          </div>

          <ToolStatusBar
            v-if="msg.role === 'tool-status'"
            :tool-name="msg.toolName || ''"
            :tool-done="!!msg.toolDone"
          />

          <MessageBubble v-else :role="msg.role === 'user' ? 'user' : 'assistant'">
            <MarkdownRenderer :markdown="msg.content" enable-breaks :enable-gfm="true" :enable-shiki="false" :enable-latex="false" :enable-animate="false" />
          </MessageBubble>
        </template>

        <!-- 流式输出 -->
        <MessageBubble v-if="chat.isStreaming.value" role="assistant">
          <MarkdownRenderer :markdown="chat.streamingText.value || ''" enable-breaks :enable-gfm="true" :enable-shiki="false" :enable-latex="false" :enable-animate="false" />
        </MessageBubble>

        <!-- 思考中状态 -->
        <MessageBubble v-if="chat.isThinking.value && !chat.isStreaming.value" role="assistant" thinking>
          <span class="ai-thinking">
            <span class="ai-thinking-dot"></span>
            <span>AI 正在思考...</span>
          </span>
        </MessageBubble>

        <!-- 错误 + 重试 -->
        <div v-if="chat.errorMsg.value" class="ai-error">
          <span>&#10060; {{ chat.errorMsg.value }}</span>
          <button class="ai-retry-btn" @click="chat.handleRetry">
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
          :disabled="chat.sending.value"
          @keyup.enter="handleSend"
        />
        <button
          v-if="chat.isStreaming.value || chat.isThinking.value"
          class="ai-stop-btn"
          title="停止生成"
          @click="chat.handleStop"
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
import { MarkdownRenderer } from 'x-markdown-vue'
import 'x-markdown-vue/style'
import SessionSidebar from './components/SessionSidebar.vue'
import MessageBubble from './components/MessageBubble.vue'
import ToolStatusBar from './components/ToolStatusBar.vue'
import { useAIChat } from './composables/useAIChat'

const suggestions = [
  '这个月花最多的是哪个分类？',
  '帮我分析一下本月消费趋势',
  '有什么省钱建议？',
  '上月和这月支出对比有什么变化？',
]

const bodyRef = ref<HTMLElement>()
const inputText = ref('')

function scrollToBottom() {
  nextTick(() => {
    const el = bodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const chat = useAIChat(scrollToBottom)

function showTimestamp(idx: number): boolean {
  if (idx === 0) return true
  const msgs = chat.store.messages
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

async function handleSend() {
  const text = inputText.value.trim()
  if (!text || chat.sending.value) return
  inputText.value = ''
  await chat.handleSend(text)
}

async function handleSuggest(text: string) {
  inputText.value = text
  await handleSend()
}

onMounted(async () => {
  await chat.store.init(chat.ledgerStore.currentId)
  scrollToBottom()
})
</script>

<style lang="scss" scoped>
.ai-layout { flex: 1; display: flex; overflow: hidden; background: transparent; }

.ai-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: $color-bg-white; }
.ai-main-body { flex: 1; overflow-y: auto; padding: 20px 0; display: flex; flex-direction: column; gap: 14px; align-items: center; }

.ai-welcome { text-align: center; padding-top: 100px; }
.ai-welcome-logo { font-size: $font-5xl; margin-bottom: 12px; }
.ai-welcome-text { font-size: $font-2xl; font-weight: $font-semibold; color: $color-text-primary; margin-bottom: 6px; }
.ai-welcome-hint { font-size: $font-base; color: $color-text-muted; margin-bottom: 24px; }
.ai-suggestions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 520px; }
.ai-suggestion-btn {
  padding: 8px 18px; border-radius: $radius-full; font-size: $font-base; font-weight: $font-medium;
  cursor: pointer; font-family: inherit; border: 1px solid $color-border; background: $color-bg-white;
  color: $color-text-secondary; transition: $transition-base; white-space: nowrap;
}
.ai-suggestion-btn:hover { border-color: $color-primary; color: $color-primary; background: rgba($color-primary,0.04); }

.ai-time-divider {
  width: 100%; max-width: 720px; text-align: center; padding: 4px 0; margin: 8px 0;
}
.ai-time-divider span {
  font-size: $font-xs; color: $color-text-muted; background: $color-bg-white; padding: 2px 12px;
  border-radius: $radius-full; border: 1px solid #F0F2F5;
}

.ai-error { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: $radius-lg; background: rgba($color-danger,0.08); color: $color-danger; font-size: $font-base; max-width: 720px; width: 100%; margin: 0 auto; }

.ai-main-footer { padding: 14px 32px; border-top: 1px solid $color-bg-page; display: flex; gap: 10px; align-items: center; }
.ai-input {
  flex: 1; padding: 11px 16px; border-radius: $radius-xl; border: 1px solid $color-border;
  font-size: $font-md; color: $color-text-primary; outline: none; font-family: inherit; background: $color-bg-card;
}
.ai-input:focus { border-color: $color-primary; background: $color-bg-white; }
.ai-input::placeholder { color: $color-text-muted; }
.ai-input:disabled { opacity: 0.6; }
.ai-send-btn {
  width: 42px; height: 42px; border-radius: $radius-xl; border: none;
  background: $color-primary; color: #fff; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: background-color 0.15s;
  flex-shrink: 0;
}
.ai-send-btn:hover { background: $color-primary-hover; }
.ai-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* 思考动画（内容由本文件通过 slot 传给 MessageBubble，样式作用域也归属本文件） */
.ai-thinking { display: flex; align-items: center; gap: 6px; }

.ai-thinking-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; background: $color-primary;
  animation: ai-pulse 1.2s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50%      { transform: scale(1.5); opacity: 1; }
}

/* 停止按钮 */
.ai-stop-btn {
  width: 42px; height: 42px; border-radius: $radius-xl; border: none;
  background: $color-danger; color: #fff; cursor: pointer; display: flex;
  align-items: center; justify-content: center; transition: background-color 0.15s;
  flex-shrink: 0;
}
.ai-stop-btn:hover { background: #DC2626; }

/* 重试按钮 */
.ai-retry-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 12px; border-radius: $radius-md; border: 1px solid #EF4444;
  background: transparent; color: $color-danger; font-size: $font-sm;
  cursor: pointer; font-family: inherit; transition: $transition-base;
  white-space: nowrap;
}
.ai-retry-btn:hover { background: rgba($color-danger,0.08); }
</style>
