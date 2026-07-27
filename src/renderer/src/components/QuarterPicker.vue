<template>
  <div class="quarter-picker" ref="rootRef">
    <div class="qp-trigger" @click="toggleOpen">
      <span class="qp-trigger-text">{{ displayText }}</span>
      <svg class="qp-trigger-arrow" :class="{ open: isOpen }" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
    <Transition name="qp-drop">
      <div v-if="isOpen" class="qp-panel">
        <div class="qp-panel-header">
          <button class="qp-nav-btn" @click="changeYear(-1)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="qp-panel-year">{{ panelYear }}年</span>
          <button class="qp-nav-btn" @click="changeYear(1)">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="qp-grid">
          <button
            v-for="q in 4"
            :key="q"
            :class="['qp-cell', { active: quarter === q && year === panelYear }]"
            @click="selectQuarter(q)"
          >第{{ ['一','二','三','四'][q-1] }}季度</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'change'): void }>()

const now = dayjs()
const year = ref(0)
const quarter = ref(0)
const panelYear = ref(0)
const isOpen = ref(false)
const rootRef = ref<HTMLElement>()

function parse(val: string) {
  if (val) {
    year.value = parseInt(val.split('-Q')[0])
    quarter.value = parseInt(val.split('-Q')[1])
  } else {
    year.value = now.year()
    quarter.value = Math.ceil((now.month() + 1) / 3)
  }
}

parse(props.modelValue)

const displayText = computed(() => {
  return `${year.value}年${['一','二','三','四'][quarter.value - 1]}季度`
})

watch(() => props.modelValue, (val) => parse(val))

function toggleOpen() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    panelYear.value = year.value
  }
}

function changeYear(delta: number) {
  panelYear.value += delta
}

function selectQuarter(q: number) {
  year.value = panelYear.value
  quarter.value = q
  const val = `${year.value}-Q${quarter.value}`
  emit('update:modelValue', val)
  emit('change')
  isOpen.value = false
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped>
.quarter-picker {
  position: relative;
  display: inline-block;
}

.qp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #1A1A2E;
  font-family: inherit;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.qp-trigger:hover {
  border-color: #FF8C00;
}

.qp-trigger-text {
  white-space: nowrap;
}

.qp-trigger-arrow {
  color: #9CA3AF;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.qp-trigger-arrow.open {
  transform: rotate(180deg);
}

.qp-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  padding: 12px 16px 16px;
  min-width: 180px;
}

.qp-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.qp-panel-year {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1A1A2E;
}

.qp-nav-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #9CA3AF;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.qp-nav-btn:hover {
  background: #FFF5E6;
  color: #FF8C00;
}

.qp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.qp-cell {
  padding: 12px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: #F5F7FA;
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6B7280;
  font-family: inherit;
  text-align: center;
  transition: all 0.15s;
}

.qp-cell:hover {
  background: #FFF5E6;
  color: #FF8C00;
}

.qp-cell.active {
  background: #FF8C00;
  color: #fff;
  border-color: #FF8C00;
}

.qp-drop-enter-active {
  transition: opacity 0.15s, transform 0.15s;
}

.qp-drop-leave-active {
  transition: opacity 0.1s, transform 0.1s;
}

.qp-drop-enter-from,
.qp-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
