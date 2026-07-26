# AI 配置页 + 对话页面实现计划

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan task-by-task.

**Goal:** 实现 AI 设置弹窗（API Key 配置 + 模型选择）和 AI 对话面板，样式与现有弹窗/页面统一

**Architecture:** 两个新 Vue 组件 + 修改 App.vue 齿轮入口。设置弹窗复用 `TransactionDialog` 的 modal 模式（Teleport + Transition + modal-panel）。对话面板作为 Dashboard 右侧固定侧边栏，复用磨砂玻璃卡片风格。因后端还未实现，先使用 mock 数据模拟 streaming 效果。

**Tech Stack:** Vue 3 + Composition API + scoped CSS（与项目现有风格一致）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/renderer/src/components/AISettingsDialog.vue` | **新建** | 设置弹窗：API Key 输入 + 模型选择 + 测试连接 |
| `src/renderer/src/components/AIChatPanel.vue` | **新建** | 对话面板：消息列表 + 输入框 + mock streaming |
| `src/renderer/src/composables/useAI.ts` | **新建** | AI 状态管理：dialogVisible、panelVisible、config |
| `src/renderer/src/App.vue` | **修改** | 齿轮图标加 @click → 打开设置弹窗 |

---

### Task 1: 创建 AI 状态管理 composable

**Files:**
- Create: `src/renderer/src/composables/useAI.ts`

- [ ] **Step 1: 编写 useAI composable**

```typescript
// src/renderer/src/composables/useAI.ts
import { ref } from 'vue'

export interface AIConfig {
  apiKey: string
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro'
}

const settingsVisible = ref(false)
const panelVisible = ref(false)

const config = ref<AIConfig>({
  apiKey: '',
  model: 'deepseek-v4-flash',
})

export function useAI() {
  function openSettings() {
    settingsVisible.value = true
  }

  function closeSettings() {
    settingsVisible.value = false
  }

  function openPanel() {
    panelVisible.value = true
  }

  function closePanel() {
    panelVisible.value = false
  }

  function togglePanel() {
    panelVisible.value = !panelVisible.value
  }

  function saveConfig(newConfig: AIConfig) {
    config.value = { ...newConfig }
    settingsVisible.value = false
  }

  return {
    settingsVisible,
    panelVisible,
    config,
    openSettings,
    closeSettings,
    openPanel,
    closePanel,
    togglePanel,
    saveConfig,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/composables/useAI.ts
git commit -m "feat: add AI state management composable"
```

---

### Task 2: 创建 AISettingsDialog.vue

**Files:**
- Create: `src/renderer/src/components/AISettingsDialog.vue`

- [ ] **Step 1: 编写模板**

```vue
<!-- src/renderer/src/components/AISettingsDialog.vue -->
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-backdrop"></div>
        <div class="modal-panel">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">设置</h3>
              <p class="modal-desc">配置 DeepSeek AI 助手</p>
            </div>
            <button class="modal-close" @click="handleClose">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="sdk-row">
              <label class="sdk-label">API Key</label>
              <input
                v-model="localApiKey"
                :type="showKey ? 'text' : 'password'"
                class="sdk-input"
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxx"
                maxlength="64"
              />
              <button class="sdk-toggle-btn" @click="showKey = !showKey" title="显示/隐藏">
                <svg v-if="!showKey" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>

            <div class="sdk-row">
              <label class="sdk-label">模型选择</label>
              <div class="sdk-radio-group">
                <label
                  v-for="m in modelOptions"
                  :key="m.value"
                  :class="['sdk-radio-item', { active: localModel === m.value }]"
                >
                  <input
                    type="radio"
                    :value="m.value"
                    v-model="localModel"
                    class="sdk-radio-input"
                  />
                  <div class="sdk-radio-label">
                    <span class="sdk-radio-name">{{ m.label }}</span>
                    <span class="sdk-radio-desc">{{ m.desc }}</span>
                  </div>
                </label>
              </div>
            </div>

            <div class="sdk-row sdk-row--test">
              <button
                class="sdk-test-btn"
                :disabled="!localApiKey.trim() || testing"
                @click="handleTest"
              >
                {{ testing ? '测试中...' : '测试连接' }}
              </button>
              <Transition name="modal-fade">
                <span v-if="testResult" :class="['sdk-test-msg', testResult.ok ? 'sdk-test-msg--ok' : 'sdk-test-msg--fail']">
                  {{ testResult.msg }}
                </span>
              </Transition>
            </div>
          </div>

          <div class="modal-footer">
            <button class="sdk-btn-cancel" @click="handleClose">取消</button>
            <button class="sdk-btn-submit" :disabled="!localApiKey.trim()" @click="handleSave">保存</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
```

- [ ] **Step 2: 编写 script（含 mock 测试连接）**

```typescript
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AIConfig } from '../composables/useAI'

const props = defineProps<{ visible: boolean; config: AIConfig }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save', config: AIConfig): void
}>()

const modelOptions = [
  { value: 'deepseek-v4-flash' as const, label: 'V4 Flash', desc: '免费，推理快，适合日常分析' },
  { value: 'deepseek-v4-pro' as const, label: 'V4 Pro', desc: '更强推理，适合深度报告' },
]

const localApiKey = ref('')
const localModel = ref<'deepseek-v4-flash' | 'deepseek-v4-pro'>('deepseek-v4-flash')
const showKey = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)

watch(() => props.visible, (val) => {
  if (val) {
    localApiKey.value = props.config.apiKey
    localModel.value = props.config.model
    testResult.value = null
  }
})

function handleTest() {
  if (!localApiKey.value.trim()) return
  testing.value = true
  testResult.value = null
  // Mock 测试连接：模拟 1.5 秒延迟
  setTimeout(() => {
    const key = localApiKey.value.trim()
    if (key.startsWith('sk-') && key.length > 10) {
      testResult.value = { ok: true, msg: '连接成功' }
    } else {
      testResult.value = { ok: false, msg: '连接失败，请检查 API Key 格式' }
    }
    testing.value = false
  }, 1500)
}

function handleSave() {
  emit('save', { apiKey: localApiKey.value.trim(), model: localModel.value })
}

function handleClose() {
  emit('update:visible', false)
}
</script>
```

- [ ] **Step 3: 编写样式（与 TransactionDialog 统一）**

```css
<style scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000; display: flex;
  align-items: center; justify-content: center;
}
.modal-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
}
.modal-panel {
  position: relative; background: #fff; border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden;
  display: flex; flex-direction: column; max-height: 85vh;
  width: 480px; max-width: 90vw;
}

.modal-header {
  padding: 24px 28px 16px; display: flex; align-items: center;
  justify-content: space-between;
}
.modal-title { font-size: 1rem; font-weight: 600; color: #1A1A2E; }
.modal-desc { font-size: 0.8125rem; color: #6B7280; margin-top: 4px; }
.modal-close {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.modal-close:hover { background: #F5F7FA; color: #6B7280; }

.modal-body { padding: 20px 28px; overflow-y: auto; flex: 1; }

.modal-footer {
  padding: 14px 28px 20px; display: flex; justify-content: flex-end;
  gap: 8px; border-top: 1px solid #F0F2F5;
}

.sdk-row { margin-bottom: 18px; position: relative; }
.sdk-row:last-child { margin-bottom: 0; }
.sdk-row--test { display: flex; align-items: center; gap: 12px; margin-top: 0; }

.sdk-label {
  font-size: 0.8125rem; font-weight: 500; color: #6B7280;
  display: block; margin-bottom: 6px;
}

.sdk-input {
  width: 100%; padding: 9px 40px 9px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; outline: none; font-family: monospace;
  box-sizing: border-box; padding-right: 36px;
}
.sdk-input:focus { border-color: #FF8C00; }
.sdk-input::placeholder { color: #9CA3AF; font-family: inherit; }

.sdk-toggle-btn {
  position: absolute; right: 8px; top: 34px; width: 24px; height: 24px;
  border: none; background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
}
.sdk-toggle-btn:hover { color: #6B7280; }

.sdk-radio-group { display: flex; flex-direction: column; gap: 8px; }

.sdk-radio-item {
  display: flex; align-items: center; padding: 12px 14px;
  border: 1px solid rgba(235,238,242,0.7); border-radius: 8px;
  cursor: pointer; transition: all 0.15s; gap: 10px;
}
.sdk-radio-item:hover { border-color: #FFAD42; }
.sdk-radio-item.active {
  border-color: #FF8C00; background: rgba(255,140,0,0.04);
}
.sdk-radio-input { display: none; }

.sdk-radio-label { display: flex; flex-direction: column; gap: 2px; }
.sdk-radio-name { font-size: 0.875rem; font-weight: 600; color: #1A1A2E; }
.sdk-radio-desc { font-size: 0.75rem; color: #9CA3AF; }

.sdk-test-btn {
  padding: 7px 16px; border-radius: 6px; font-size: 0.8125rem;
  font-weight: 500; cursor: pointer; font-family: inherit;
  border: 1px solid rgba(235,238,242,0.7); background: transparent;
  color: #6B7280; transition: all 0.15s; white-space: nowrap;
}
.sdk-test-btn:hover:not(:disabled) { border-color: #FF8C00; color: #FF8C00; }
.sdk-test-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.sdk-test-msg { font-size: 0.8125rem; font-weight: 500; }
.sdk-test-msg--ok { color: #10B981; }
.sdk-test-msg--fail { color: #EF4444; }

.sdk-btn-cancel {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; font-family: inherit; border: 1px solid rgba(235,238,242,0.7);
  background: transparent; color: #6B7280; transition: all 0.15s;
}
.sdk-btn-cancel:hover { border-color: #FFAD42; color: #FF8C00; }

.sdk-btn-submit {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; font-family: inherit; border: none;
  background: #FF8C00; color: #fff; transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(255,140,0,0.25);
}
.sdk-btn-submit:hover { background: #E07800; }
.sdk-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/AISettingsDialog.vue
git commit -m "feat: add AI settings dialog component"
```

---

### Task 3: 创建 AIChatPanel.vue

**Files:**
- Create: `src/renderer/src/components/AIChatPanel.vue`

- [ ] **Step 1: 编写模板**

```vue
<!-- src/renderer/src/components/AIChatPanel.vue -->
<template>
  <Transition name="panel-slide">
    <div v-if="visible" class="ai-panel">
      <div class="ai-panel-header">
        <div class="ai-panel-header-left">
          <div class="ai-panel-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#FF8C00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span class="ai-panel-title">AI 助手</span>
        </div>
        <div class="ai-panel-header-right">
          <button
            v-if="messages.length > 0"
            class="ai-panel-btn"
            title="清空对话"
            @click="handleClear"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
          <button class="ai-panel-btn" title="关闭" @click="handleClose">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="ai-panel-body" ref="bodyRef">
        <div v-if="messages.length === 0" class="ai-empty">
          <div class="ai-empty-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#D1D5DB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          </div>
          <p class="ai-empty-text">有什么可以帮你的？</p>
          <p class="ai-empty-hint">你可以问我收支情况、消费分析、省钱建议</p>
          <div class="ai-suggestions">
            <button
              v-for="q in suggestions"
              :key="q"
              class="ai-suggestion-btn"
              @click="sendMessage(q)"
            >{{ q }}</button>
          </div>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['ai-msg', msg.role === 'user' ? 'ai-msg--user' : 'ai-msg--assistant']"
        >
          <div class="ai-msg-avatar">
            <svg v-if="msg.role === 'user'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div class="ai-msg-content" v-html="renderContent(msg.content)"></div>
        </div>

        <div v-if="streaming" class="ai-msg ai-msg--assistant">
          <div class="ai-msg-avatar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
            </svg>
          </div>
          <div class="ai-msg-content">
            {{ streamingText }}
            <span class="ai-cursor">|</span>
          </div>
        </div>
      </div>

      <div class="ai-panel-footer">
        <input
          v-model="inputText"
          class="ai-input"
          placeholder="输入你的问题..."
          maxlength="500"
          @keyup.enter="sendMessage(inputText.trim())"
          :disabled="streaming"
        />
        <button
          class="ai-send-btn"
          :disabled="!inputText.trim() || streaming"
          @click="sendMessage(inputText.trim())"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>
```

- [ ] **Step 2: 编写 script（含 mock streaming）**

```typescript
<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
}>()

const bodyRef = ref<HTMLElement>()
const inputText = ref('')
const messages = ref<ChatMessage[]>([])
const streaming = ref(false)
const streamingText = ref('')

const suggestions = [
  '这个月花最多的是哪个分类？',
  '帮我分析一下本月消费趋势',
  '有什么省钱建议？',
  '上月和这月支出对比有什么变化？',
]

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }

function scrollToBottom() {
  nextTick(() => {
    const el = bodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

// Mock AI 回复
const mockReplies: Record<string, string> = {
  '这个月花最多的是哪个分类？': '根据本月数据，**餐饮**是你支出最高的分类，总计 ¥1,580.50，占总支出的 **35.2%**。\n\n排在前三的分类是：\n\n1. 🍔 餐饮 — ¥1,580.50（35.2%）\n2. 🚗 交通 — ¥860.00（19.1%）\n3. 🛒 购物 — ¥720.30（16.0%）\n\n餐饮占比略高，建议关注一下是否频繁点外卖，可以考虑每周多做几次饭来节省开支。',
  '帮我分析一下本月消费趋势': '本月消费趋势分析：\n\n📊 **每日走势**\n- 月初（1-7日）支出较低，日均约 ¥80\n- 中旬（8-20日）有两波消费高峰，单日最高达 ¥350\n- 下旬趋于平稳，日均约 ¥100\n\n📈 **趋势总结**\n消费集中在月中，可能与购物和社交活动有关。整体支出较上月**下降 12%**，控制得不错！',
  '有什么省钱建议？': '根据你的消费数据，给你几个建议：\n\n1. 💡 **减少外卖** — 餐饮占 35%，若每周少点 3 次外卖，每月可省约 ¥300\n2. 🚇 **多乘公共交通** — 打车占交通费的 60%，换成地铁每月可省 ¥200+ \n3. 📋 **制定预算** — 建议为每个分类设置月预算上限，超支时会自动提醒\n\n坚持下去，预计下月还能再省 15%～20%！',
  '上月和这月支出对比有什么变化？': '📊 **两月对比**\n\n| 项目 | 上月 | 本月 | 变化 |\n|------|------|------|------|\n| 总支出 | ¥5,230 | ¥4,510 | **↓ 13.8%** |\n| 餐饮 | ¥1,820 | ¥1,580 | ↓ 13.2% |\n| 交通 | ¥1,040 | ¥860 | ↓ 17.3% |\n| 购物 | ¥890 | ¥720 | ↓ 19.1% |\n\n👏 各项支出都有所下降，购物控制得最好！继续保持。',
  'default': '好的，我分析一下你的数据。\n\n根据当前记录，你这个月整体消费水平比较健康。收入：¥8,500，支出：¥4,510，结余率约 **47%**。\n\n主要消费在餐饮和交通方面，建议继续关注这两个分类。有什么具体想了解的吗？',
}

function getMockReply(question: string): string {
  for (const [key, val] of Object.entries(mockReplies)) {
    if (question.includes(key)) return val
  }
  return mockReplies['default']
}

async function sendMessage(text: string) {
  if (!text || streaming.value) return

  const userMsg: ChatMessage = {
    id: genId(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  }
  messages.value.push(userMsg)
  inputText.value = ''
  scrollToBottom()

  // Mock streaming 效果
  streaming.value = true
  streamingText.value = ''

  const reply = getMockReply(text)
  for (let i = 0; i < reply.length; i++) {
    await new Promise(r => setTimeout(r, 15 + Math.random() * 20))
    streamingText.value += reply[i]
    scrollToBottom()
  }

  messages.value.push({
    id: genId(),
    role: 'assistant',
    content: reply,
    timestamp: Date.now(),
  })
  streamingText.value = ''
  streaming.value = false
  scrollToBottom()
}

function renderContent(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function handleClear() {
  messages.value = []
}

function handleClose() {
  emit('update:visible', false)
}

watch(() => props.visible, (val) => {
  if (val) scrollToBottom()
})
</script>
```

- [ ] **Step 3: 编写样式（磨砂玻璃卡片 + 聊天风格）**

```css
<style scoped>
.ai-panel {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 1500;
  width: 420px; max-width: 90vw;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
  border-left: 1px solid rgba(235,238,242,0.7);
  box-shadow: -4px 0 30px rgba(0,0,0,0.06);
  display: flex; flex-direction: column;
}

.ai-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; flex-shrink: 0;
  border-bottom: 1px solid rgba(235,238,242,0.7);
}
.ai-panel-header-left { display: flex; align-items: center; gap: 8px; }
.ai-panel-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(255,140,0,0.1); display: flex;
  align-items: center; justify-content: center;
}
.ai-panel-title { font-size: 0.875rem; font-weight: 600; color: #1A1A2E; }
.ai-panel-header-right { display: flex; gap: 4px; }

.ai-panel-btn {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.ai-panel-btn:hover { background: #F5F7FA; color: #6B7280; }

.ai-panel-body {
  flex: 1; overflow-y: auto; padding: 16px 20px;
  display: flex; flex-direction: column; gap: 16px;
}

.ai-empty { text-align: center; padding-top: 60px; }
.ai-empty-icon { margin-bottom: 12px; }
.ai-empty-text { font-size: 0.9375rem; font-weight: 600; color: #1A1A2E; margin-bottom: 4px; }
.ai-empty-hint { font-size: 0.75rem; color: #9CA3AF; margin-bottom: 20px; }

.ai-suggestions { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.ai-suggestion-btn {
  padding: 6px 14px; border-radius: 999px; font-size: 0.75rem;
  font-weight: 500; cursor: pointer; font-family: inherit;
  border: 1px solid rgba(235,238,242,0.7); background: transparent;
  color: #6B7280; transition: all 0.15s; white-space: nowrap;
}
.ai-suggestion-btn:hover { border-color: #FFAD42; color: #FF8C00; }

.ai-msg { display: flex; gap: 10px; max-width: 100%; }
.ai-msg--user { flex-direction: row-reverse; }
.ai-msg--assistant { flex-direction: row; }

.ai-msg-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.ai-msg--assistant .ai-msg-avatar {
  background: rgba(255,140,0,0.1); color: #FF8C00;
}
.ai-msg--user .ai-msg-avatar {
  background: rgba(107,114,128,0.1); color: #6B7280;
}

.ai-msg-content {
  padding: 12px 16px; border-radius: 12px; font-size: 0.8125rem;
  line-height: 1.65; color: #1A1A2E; max-width: 85%;
}
.ai-msg--assistant .ai-msg-content {
  background: rgba(255,255,255,0.85); border: 1px solid rgba(235,238,242,0.7);
  border-bottom-left-radius: 4px;
}
.ai-msg--user .ai-msg-content {
  background: #FF8C00; color: #fff;
  border-bottom-right-radius: 4px;
}
.ai-msg--user .ai-msg-content :deep(strong) { color: #fff; }

.ai-msg-content :deep(strong) { font-weight: 600; color: #FF8C00; }

.ai-cursor {
  display: inline-block; animation: blink 1s step-end infinite;
  font-weight: 400; color: #FF8C00;
}
@keyframes blink { 50% { opacity: 0; } }

.ai-panel-footer {
  padding: 12px 16px; flex-shrink: 0;
  border-top: 1px solid rgba(235,238,242,0.7);
  display: flex; gap: 8px; align-items: center;
}
.ai-input {
  flex: 1; padding: 9px 14px; border-radius: 8px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; outline: none; font-family: inherit;
}
.ai-input:focus { border-color: #FF8C00; }
.ai-input::placeholder { color: #9CA3AF; }
.ai-input:disabled { opacity: 0.6; }

.ai-send-btn {
  width: 36px; height: 36px; border-radius: 8px; border: none;
  background: #FF8C00; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(255,140,0,0.25);
}
.ai-send-btn:hover { background: #E07800; }
.ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.panel-slide-enter-active { transition: all 0.25s ease-out; }
.panel-slide-leave-active { transition: all 0.2s ease-in; }
.panel-slide-enter-from { transform: translateX(100%); }
.panel-slide-enter-to { transform: translateX(0); }
.panel-slide-leave-from { transform: translateX(0); }
.panel-slide-leave-to { transform: translateX(100%); }
</style>
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/AIChatPanel.vue
git commit -m "feat: add AI chat panel component with mock streaming"
```

---

### Task 4: 修改 App.vue 集成入口

**Files:**
- Modify: `src/renderer/src/App.vue`

- [ ] **Step 1: 齿轮图标加 @click 事件**

```vue
<!-- 将 sidebar-bottom 中的齿轮 div 改为： -->
<div class="sidebar-nav-item" title="设置" @click="ai.openSettings()">
```

- [ ] **Step 2: 引入组件和 composable**

在 `<script setup>` 中添加：

```typescript
import { useAI } from './composables/useAI'
import AISettingsDialog from './components/AISettingsDialog.vue'
import AIChatPanel from './components/AIChatPanel.vue'

const ai = useAI()
```

- [ ] **Step 3: 在模板底部添加组件**

在 `</div> <!-- app-root -->` 之前添加：

```vue
    <AISettingsDialog
      :visible="ai.settingsVisible"
      :config="ai.config"
      @update:visible="ai.closeSettings()"
      @save="ai.saveConfig"
    />

    <AIChatPanel
      :visible="ai.panelVisible"
      @update:visible="ai.closePanel()"
    />
  </div>
</template>
```

- [ ] **Step 4: 构建验证**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/App.vue
git commit -m "feat: integrate AI settings & chat panel into App.vue"
```

---

## 测试步骤

1. 启动应用 → 点击侧边栏齿轮图标 → 看到「设置」弹窗
2. 输入 API Key（如 `sk-test1234567890abcdef`）→ 点击「测试连接」→ 看到「连接成功」
3. 选择 V4 Pro → 点击「保存」→ 弹窗关闭
4. 再次点击齿轮 → 确认 API Key 和模型选择已保留
5. （手动触发）打开 AI 面板 → 看到欢迎页 + 4 个推荐问题
6. 点击推荐问题「这个月花最多的是哪个分类？」→ 看到 mock streaming 逐字输出 + Markdown 渲染
7. 点击「清空对话」→ 消息清空，回到欢迎页
