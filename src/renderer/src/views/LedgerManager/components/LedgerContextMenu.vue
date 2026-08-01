<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="ledger-menu-overlay" @click="$emit('close')">
        <Transition name="dialog-scale">
          <div v-if="visible" class="ledger-menu-pop" :style="position" @click.stop>
            <button class="ledger-menu-item" @click="$emit('edit')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              编辑
            </button>
            <button class="ledger-menu-item ledger-menu-item--danger" @click="$emit('delete')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              删除
            </button>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  position: { top: string; left: string }
}>()

defineEmits<{
  close: []
  edit: []
  delete: []
}>()
</script>

<style lang="scss" scoped>
.ledger-menu-overlay {
  position: fixed; inset: 0; z-index: 3000;
}
.ledger-menu-pop {
  position: fixed;
  background: rgba($color-bg-white, 0.95);
  border: 1px solid rgba($color-border-light,0.7);
  border-radius: $radius-lg;
  box-shadow: $shadow-lg;
  backdrop-filter: blur(12px);
  padding: 4px; min-width: 120px;
  display: flex; flex-direction: column; gap: 2px;
}
.ledger-menu-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border: none; background: transparent;
  border-radius: $radius-md; font-size: $font-base; color: $color-text-primary;
  cursor: pointer; transition: background 0.12s ease; font-family: inherit;
}
.ledger-menu-item:hover { background: $color-bg-hover; }
.ledger-menu-item--danger { color: $color-danger; }
.ledger-menu-item--danger:hover { background: #FEF2F2; }

.dialog-fade-enter-active { transition: opacity 0.2s ease; }
.dialog-fade-leave-active { transition: opacity 0.15s ease; }
.dialog-fade-enter-from, .dialog-fade-leave-to { opacity: 0; }

.dialog-scale-enter-active { transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.dialog-scale-leave-active { transition: all 0.12s ease-in; }
.dialog-scale-enter-from, .dialog-scale-leave-to { opacity: 0; transform: scale(0.9); }
</style>
