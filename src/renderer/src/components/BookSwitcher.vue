<template>
  <div class="book-switcher" ref="switcherRef" @click="toggle">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
    <span class="book-switcher__name">{{ currentName }}</span>
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>

    <Teleport to="body">
      <Transition name="bs-drop-fade">
        <div v-if="visible" class="book-switcher__overlay" @click.stop="visible = false">
          <Transition name="bs-drop-scale">
            <div v-if="visible" class="book-switcher__dropdown" :style="dropStyle">
              <div
                v-for="lb in ledgerStore.list"
                :key="lb.id"
                class="book-switcher__item"
                :class="{ active: lb.id === ledgerStore.currentId }"
                @click.stop="select(lb)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <span class="book-switcher__item-name">{{ lb.name }}</span>
                <svg v-if="lb.id === ledgerStore.currentId" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLedgerStore } from '../stores/ledgerStore'

const ledgerStore = useLedgerStore()
const switcherRef = ref<HTMLElement>()
const visible = ref(false)
const dropStyle = ref({ top: '0px', left: '0px' })

const currentName = computed(() => {
  const lb = ledgerStore.list.find(l => l.id === ledgerStore.currentId)
  return lb ? lb.name : '选择账本'
})

function toggle() {
  if (visible.value) {
    visible.value = false
    return
  }
  const el = switcherRef.value
  if (el) {
    const rect = el.getBoundingClientRect()
    dropStyle.value = { top: `${rect.bottom + 4}px`, left: `${rect.left}px` }
  }
  visible.value = true
}

function select(lb: { id: number; name: string }) {
  ledgerStore.setCurrentId(lb.id)
  visible.value = false
}
</script>

<style scoped>
.book-switcher {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid rgba(235,238,242,0.5);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #1A1A2E;
  white-space: nowrap;
  user-select: none;
}

.book-switcher:hover {
  border-color: #FFAD42;
  background: #FFF5E6;
  color: #FF8C00;
}

.book-switcher svg {
  flex-shrink: 0;
  color: #9CA3AF;
  transition: color 0.15s;
}

.book-switcher:hover svg {
  color: #FF8C00;
}

.book-switcher__name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-switcher__overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.book-switcher__dropdown {
  position: fixed;
  background: #fff;
  border: 1px solid #EBEEF2;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  padding: 4px;
  min-width: 180px;
  display: flex;
  flex-direction: column;
}

.book-switcher__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-size: 0.8125rem;
  color: #1A1A2E;
  cursor: pointer;
  transition: background 0.12s ease;
}

.book-switcher__item:hover {
  background: #F5F7FA;
}

.book-switcher__item.active {
  background: #FFF5E6;
  color: #FF8C00;
}

.book-switcher__item svg {
  flex-shrink: 0;
  color: #9CA3AF;
}

.book-switcher__item.active svg {
  color: #FF8C00;
}

.book-switcher__item-name {
  flex: 1;
  text-align: left;
}

.bs-drop-fade-enter-active { transition: opacity 0.15s ease; }
.bs-drop-fade-leave-active { transition: opacity 0.1s ease; }
.bs-drop-fade-enter-from,
.bs-drop-fade-leave-to { opacity: 0; }

.bs-drop-scale-enter-active { transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1); }
.bs-drop-scale-leave-active { transition: all 0.1s ease-in; }
.bs-drop-scale-enter-from,
.bs-drop-scale-leave-to { opacity: 0; transform: scale(0.95) translateY(-4px); }
</style>
