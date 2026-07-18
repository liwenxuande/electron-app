<template>
  <div v-if="show" class="ai-dialog-mask" @click="close">
    <div class="ai-dialog" @click.stop>
      <div class="ai-dialog-header">
        <h3>设置</h3>
        <button class="ai-dialog-close" @click="close">✕</button>
      </div>
      <div class="ai-dialog-body">
        <div class="ai-field">
          <label>API Key</label>
          <input v-model="key" type="password" placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
        <div class="ai-field">
          <label>模型</label>
          <label class="ai-radio" :class="{ on: model === 'deepseek-v4-flash' }">
            <input type="radio" value="deepseek-v4-flash" v-model="model" /> V4 Flash（免费）
          </label>
          <label class="ai-radio" :class="{ on: model === 'deepseek-v4-pro' }">
            <input type="radio" value="deepseek-v4-pro" v-model="model" /> V4 Pro（更强）
          </label>
        </div>
        <div class="ai-field">
          <button class="ai-btn ghost" :disabled="!key.trim() || loading" @click="test">
            {{ loading ? '测试中...' : '测试连接' }}
          </button>
          <span v-if="result" :class="result.ok ? 'ai-ok' : 'ai-fail'">{{ result.msg }}</span>
        </div>
      </div>
      <div class="ai-dialog-footer">
        <button class="ai-btn ghost" @click="close">取消</button>
        <button class="ai-btn primary" :disabled="!key.trim()" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AIConfig } from '../composables/useAI'

const props = defineProps<{ visible: boolean; config: AIConfig }>()
const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'save', config: AIConfig): void
}>()

const show = ref(props.visible)
const key = ref('')
const model = ref<AIConfig['model']>('deepseek-v4-flash')
const loading = ref(false)
const result = ref<{ ok: boolean; msg: string } | null>(null)

watch(() => props.visible, v => {
  show.value = v
  if (v) {
    key.value = props.config.apiKey === '(已保存)' ? '' : props.config.apiKey
    model.value = props.config.model
    result.value = null
  }
})

function close() {
  show.value = false
  emit('update:visible', false)
}

async function test() {
  if (!key.value.trim()) return
  loading.value = true
  result.value = null
  try {
    await window.aiAPI.saveConfig({ key: key.value.trim(), model: model.value })
    const res = await window.aiAPI.testConnection()
    result.value = res.code === 0
      ? { ok: true, msg: '✓ 连接成功' }
      : { ok: false, msg: '✗ ' + res.msg }
  } catch (e: any) {
    result.value = { ok: false, msg: '✗ ' + (e.message || '失败') }
  }
  loading.value = false
}

function save() {
  const k = key.value.trim() || (props.config.apiKey === '(已保存)' ? '(已保存)' : '')
  if (!k && props.config.apiKey !== '(已保存)') return
  window.aiAPI?.saveConfig({ key: k, model: model.value })
  emit('save', { apiKey: k, model: model.value })
  close()
}
</script>

<style scoped>
.ai-dialog-mask {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45);
}
.ai-dialog {
  width: 440px; max-width: 90vw; background: #fff; border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.18);
}
.ai-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 14px; border-bottom: 1px solid #f0f2f5;
}
.ai-dialog-header h3 { font-size: 1rem; font-weight: 600; margin: 0; }
.ai-dialog-close {
  width: 28px; height: 28px; border: none; background: none;
  font-size: 1rem; color: #999; cursor: pointer; border-radius: 6px;
}
.ai-dialog-close:hover { background: #f5f5f5; color: #333; }
.ai-dialog-body { padding: 20px 24px; }
.ai-field { margin-bottom: 16px; }
.ai-field:last-child { margin-bottom: 0; }
.ai-field > label:first-child { display: block; font-size: 0.8125rem; font-weight: 500; color: #888; margin-bottom: 6px; }
.ai-field > input {
  width: 100%; padding: 9px 12px; border: 1px solid #e0e0e0; border-radius: 8px;
  font-size: 0.8125rem; font-family: monospace; outline: none; box-sizing: border-box;
}
.ai-field > input:focus { border-color: #FF8C00; }
.ai-radio {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border: 1px solid #e0e0e0; border-radius: 8px; cursor: pointer;
  font-size: 0.8125rem; color: #333; margin-bottom: 6px; transition: all 0.15s;
}
.ai-radio.on { border-color: #FF8C00; background: rgba(255,140,0,0.04); }
.ai-radio input { display: none; }
.ai-dialog-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 24px 18px; border-top: 1px solid #f0f2f5;
}
.ai-btn {
  padding: 7px 20px; border-radius: 8px; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; font-family: inherit; border: none; transition: all 0.15s;
}
.ai-btn.ghost { border: 1px solid #e0e0e0; background: #fff; color: #666; }
.ai-btn.ghost:hover:not(:disabled) { border-color: #FF8C00; color: #FF8C00; }
.ai-btn.ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.ai-btn.primary { background: #FF8C00; color: #fff; font-weight: 600; }
.ai-btn.primary:hover:not(:disabled) { background: #E07800; }
.ai-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
.ai-ok { font-size: 0.8125rem; font-weight: 500; color: #10B981; margin-left: 8px; }
.ai-fail { font-size: 0.8125rem; font-weight: 500; color: #EF4444; margin-left: 8px; }
</style>
