<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="$emit('close')">
        <div class="modal-backdrop"></div>
        <div class="modal-panel" style="width:400px">
          <div class="modal-header">
            <h3 class="modal-title">{{ mode === 'create' ? '新建账本' : '编辑账本' }}</h3>
            <button class="modal-close" @click="$emit('close')">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="ldb-row">
              <label class="ldb-label">名称</label>
              <input v-model="name" class="ldb-input" placeholder="请输入账本名称" maxlength="30" @keyup.enter="$emit('submit')" />
            </div>
            <div class="ldb-row">
              <label class="ldb-label">描述（选填）</label>
              <textarea v-model="description" class="ldb-textarea" rows="2" placeholder="描述账本用途..." maxlength="100"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="ldb-btn-cancel" @click="$emit('close')">取消</button>
            <button class="ldb-btn-submit" :disabled="!name.trim() || submitting" @click="$emit('submit')">
              {{ submitting ? '提交中...' : (mode === 'create' ? '创建' : '保存') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  formData: { name: string; description: string }
  submitting: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: []
  'update:formData': [v: { name: string; description: string }]
}>()

const name = computed({
  get: () => props.formData.name,
  set: (v) => emit('update:formData', { ...props.formData, name: v }),
})
const description = computed({
  get: () => props.formData.description,
  set: (v) => emit('update:formData', { ...props.formData, description: v }),
})
</script>

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
}
.modal-header {
  padding: 20px 24px 14px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid #F0F2F5;
}
.modal-title { font-size: 0.9375rem; font-weight: 600; color: #1A1A2E; }
.modal-close {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.modal-close:hover { background: #F5F7FA; color: #6B7280; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer {
  padding: 14px 24px 20px; display: flex; justify-content: flex-end;
  gap: 8px; border-top: 1px solid #F0F2F5;
}

.ldb-row { margin-bottom: 16px; }
.ldb-row:last-child { margin-bottom: 0; }
.ldb-label {
  font-size: 0.8125rem; font-weight: 500; color: #6B7280;
  display: block; margin-bottom: 6px;
}
.ldb-input {
  width: 100%; padding: 8px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; outline: none; font-family: inherit; box-sizing: border-box;
}
.ldb-input:focus { border-color: #FF8C00; }
.ldb-textarea {
  width: 100%; padding: 8px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; outline: none; font-family: inherit;
  resize: vertical; box-sizing: border-box;
}
.ldb-textarea:focus { border-color: #FF8C00; }
.ldb-textarea::placeholder { color: #9CA3AF; }
.ldb-btn-cancel {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; font-family: inherit; border: 1px solid rgba(235,238,242,0.7);
  background: transparent; color: #6B7280; transition: all 0.15s;
}
.ldb-btn-cancel:hover { border-color: #FFAD42; color: #FF8C00; }
.ldb-btn-submit {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; font-family: inherit; border: none;
  background: #FF8C00; color: #fff; transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(255,140,0,0.25);
}
.ldb-btn-submit:hover { background: #E07800; }
.ldb-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
