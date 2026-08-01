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
        <button class="ai-btn primary" :disabled="!key.trim() || !testPassed" @click="save">保存</button>
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
const testPassed = ref(false)

watch(() => props.visible, v => {
  show.value = v
  if (v) {
    key.value = props.config.apiKey
    model.value = props.config.model
    result.value = null
    testPassed.value = props.config.apiKey === '(已保存)'
  }
})

// 修改 Key 后需要重新测试（修改模型不需要）
watch(key, (newKey, oldKey) => {
  if (newKey !== oldKey) {
    testPassed.value = false
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
  testPassed.value = false
  try {
    const res = await window.aiAPI.testConnection({ key: key.value.trim(), model: model.value })
    if (res.code === 0) {
      result.value = { ok: true, msg: '连接成功' }
      testPassed.value = true
    } else {
      result.value = { ok: false, msg: res.msg }
    }
  } catch (e: any) {
    result.value = { ok: false, msg: e.message || '连接失败' }
  }
  loading.value = false
}

function save() {
  const k = key.value.trim()
  emit('save', { apiKey: k, model: model.value })
  close()
}
</script>

<style lang="scss" scoped>
.ai-dialog-mask {
  position: fixed; inset: 0; z-index: 2000;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45);
}
.ai-dialog {
  width: 440px; max-width: 90vw; background: $color-bg-white; border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.18);
}
.ai-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 24px 14px; border-bottom: 1px solid #f0f2f5;
}
.ai-dialog-header h3 { font-size: $font-xl; font-weight: $font-semibold; margin: 0; }
.ai-dialog-close {
  width: 28px; height: 28px; border: none; background: none;
  font-size: $font-xl; color: #999; cursor: pointer; border-radius: $radius-md;
}
.ai-dialog-close:hover { background: #f5f5f5; color: #333; }
.ai-dialog-body { padding: 20px 24px; }
.ai-field { margin-bottom: 16px; }
.ai-field:last-child { margin-bottom: 0; }
.ai-field > label:first-child { display: block; font-size: $font-base; font-weight: $font-medium; color: #888; margin-bottom: 6px; }
.ai-field > input {
  width: 100%; padding: 9px 12px; border: 1px solid #e0e0e0; border-radius: $radius-lg;
  font-size: $font-base; font-family: monospace; outline: none; box-sizing: border-box;
}
.ai-field > input:focus { border-color: $color-primary; }
.ai-radio {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border: 1px solid #e0e0e0; border-radius: $radius-lg; cursor: pointer;
  font-size: $font-base; color: #333; margin-bottom: 6px; transition: $transition-base;
}
.ai-radio.on { border-color: $color-primary; background: rgba($color-primary,0.04); }
.ai-radio input { display: none; }
.ai-dialog-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 24px 18px; border-top: 1px solid #f0f2f5;
}
.ai-btn {
  padding: 7px 20px; border-radius: $radius-lg; font-size: $font-base; font-weight: $font-medium;
  cursor: pointer; font-family: inherit; border: none; transition: $transition-base;
}
.ai-btn.ghost { border: 1px solid #e0e0e0; background: $color-bg-white; color: #666; }
.ai-btn.ghost:hover:not(:disabled) { border-color: $color-primary; color: $color-primary; }
.ai-btn.ghost:disabled { opacity: 0.4; cursor: not-allowed; }
.ai-btn.primary { background: $color-primary; color: #fff; font-weight: $font-semibold; }
.ai-btn.primary:hover:not(:disabled) { background: $color-primary-hover; }
.ai-btn.primary:disabled { opacity: 0.4; cursor: not-allowed; }
.ai-ok { font-size: $font-base; font-weight: $font-medium; color: $color-success; margin-left: 8px; }
.ai-fail { font-size: $font-base; font-weight: $font-medium; color: $color-danger; margin-left: 8px; }
</style>
