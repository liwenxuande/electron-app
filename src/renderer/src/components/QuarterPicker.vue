<template>
  <div class="quarter-picker">
    <button class="qp-arrow" @click="prevYear">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="qp-year">{{ modelYear }}</span>
    <button class="qp-arrow" @click="nextYear">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <div class="qp-quarters">
      <button
        v-for="(label, idx) in ['一季度','二季度','三季度','四季度']"
        :key="idx"
        :class="['qp-quarter-btn', { active: modelQuarter === idx + 1 }]"
        @click="selectQuarter(idx + 1)"
      >{{ label }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'change'): void }>()

const now = dayjs()
const year = ref(props.modelValue ? parseInt(props.modelValue.split('-Q')[0]) : now.year())
const quarter = ref(props.modelValue ? parseInt(props.modelValue.split('-Q')[1]) : Math.ceil((now.month() + 1) / 3))

const modelYear = computed(() => year.value)
const modelQuarter = computed(() => quarter.value)

watch(() => props.modelValue, (val) => {
  if (val) {
    year.value = parseInt(val.split('-Q')[0])
    quarter.value = parseInt(val.split('-Q')[1])
  }
})

function sync() {
  const val = `${year.value}-Q${quarter.value}`
  emit('update:modelValue', val)
  emit('change')
}

function selectQuarter(q: number) {
  quarter.value = q
  sync()
}

function prevYear() {
  year.value--
  sync()
}

function nextYear() {
  year.value++
  sync()
}
</script>

<style scoped>
.quarter-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 8px;
  padding: 4px 8px;
}
.qp-arrow {
  width: 24px; height: 24px;
  border-radius: 4px; border: none;
  background: transparent; cursor: pointer;
  color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
}
.qp-arrow:hover { background: #FFF5E6; color: #FF8C00; }
.qp-year {
  font-size: 0.8125rem; font-weight: 600; color: #1A1A2E;
  min-width: 48px; text-align: center;
}
.qp-quarters { display: flex; gap: 2px; }
.qp-quarter-btn {
  padding: 6px 10px; border-radius: 4px;
  font-size: 0.75rem; font-weight: 500;
  color: #9CA3AF; border: none;
  background: transparent; cursor: pointer;
  font-family: inherit; white-space: nowrap;
}
.qp-quarter-btn:hover { background: #FFF5E6; color: #FF8C00; }
.qp-quarter-btn.active { background: #FF8C00; color: #fff; }
</style>
