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

<style lang="scss" scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000; display: flex;
  align-items: center; justify-content: center;
}
.modal-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
}
.modal-panel {
  position: relative; background: $color-bg-white; border-radius: $radius-2xl;
  box-shadow: $shadow-xl; overflow: hidden;
  display: flex; flex-direction: column; max-height: 85vh;
}
.modal-header {
  padding: 20px 24px 14px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid $color-bg-page;
}
.modal-title { font-size: $font-lg; font-weight: $font-semibold; color: $color-text-primary; }
.modal-close {
  width: 28px; height: 28px; border-radius: $radius-md; border: none;
  background: transparent; cursor: pointer; color: $color-text-muted;
  display: flex; align-items: center; justify-content: center;
  transition: $transition-base;
}
.modal-close:hover { background: $color-bg-hover; color: $color-text-secondary; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer {
  padding: 14px 24px 20px; display: flex; justify-content: flex-end;
  gap: 8px; border-top: 1px solid $color-bg-page;
}

.ldb-row { margin-bottom: 16px; }
.ldb-row:last-child { margin-bottom: 0; }
.ldb-label {
  font-size: $font-base; font-weight: $font-medium; color: $color-text-secondary;
  display: block; margin-bottom: 6px;
}
.ldb-input {
  width: 100%; padding: 8px 12px; border-radius: $radius-md;
  border: 1px solid rgba($color-border-light,0.7); font-size: $font-base;
  color: $color-text-primary; outline: none; font-family: inherit; box-sizing: border-box;
}
.ldb-input:focus { border-color: $color-primary; }
.ldb-textarea {
  width: 100%; padding: 8px 12px; border-radius: $radius-md;
  border: 1px solid rgba($color-border-light,0.7); font-size: $font-base;
  color: $color-text-primary; outline: none; font-family: inherit;
  resize: vertical; box-sizing: border-box;
}
.ldb-textarea:focus { border-color: $color-primary; }
.ldb-textarea::placeholder { color: $color-text-muted; }
.ldb-btn-cancel {
  padding: 7px 18px; border-radius: $radius-md; font-size: $font-base; font-weight: $font-medium;
  cursor: pointer; font-family: inherit; border: 1px solid rgba($color-border-light,0.7);
  background: transparent; color: $color-text-secondary; transition: $transition-base;
}
.ldb-btn-cancel:hover { border-color: $color-primary-border; color: $color-primary; }
.ldb-btn-submit {
  padding: 7px 18px; border-radius: $radius-md; font-size: $font-base; font-weight: $font-semibold;
  cursor: pointer; font-family: inherit; border: none;
  background: $color-primary; color: #fff; transition: $transition-base;
  box-shadow: 0 2px 6px rgba($color-primary,0.25);
}
.ldb-btn-submit:hover { background: $color-primary-hover; }
.ldb-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
