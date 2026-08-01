<template>
  <div v-if="ledger" class="ledger-default-card">
    <div class="ledger-default-icon">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#FF8C00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        <line x1="8" y1="7" x2="16" y2="7"/>
        <line x1="8" y1="11" x2="13" y2="11"/>
      </svg>
    </div>

    <div class="ledger-default-body">
      <div class="ledger-default-name-row">
        <h2 class="ledger-default-name">{{ ledger.name }}</h2>
        <span class="ledger-badge">默认</span>
      </div>
      <p class="ledger-default-desc">{{ ledger.description || '记录日常生活收支' }}</p>
      <div class="ledger-default-stats" v-if="stats">
        <span class="ledger-stat">共 <strong>{{ stats.count }}</strong> 笔</span>
        <span class="ledger-stat-divider"></span>
        <span class="ledger-stat">本月 <strong class="ledger-stat-amount">¥{{ formatAmount(stats.monthlyExpense) }}</strong></span>
      </div>
    </div>

    <button class="ledger-edit-btn" @click="$emit('edit')">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      编辑
    </button>
  </div>
</template>

<script setup lang="ts">
import { formatAmount } from '@/utils/format'

defineProps<{
  ledger: LedgerRow | null
  stats: { count: number; monthlyExpense: number } | null
}>()

defineEmits<{ edit: [] }>()
</script>

<style lang="scss" scoped>
.ledger-default-card {
  background: rgba($color-bg-white, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba($color-border-light,0.7);
  border-radius: $radius-2xl;
  box-shadow: $shadow-md;
  padding: 28px 32px;
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
  transition: box-shadow 0.2s ease;
}
.ledger-default-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

.ledger-default-icon {
  width: 64px; height: 64px; border-radius: $radius-2xl;
  background: $color-primary-light; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0;
}
.ledger-default-body { flex: 1; min-width: 0; }
.ledger-default-name-row {
  display: flex; align-items: center; gap: 10px; margin-bottom: 4px;
}
.ledger-default-name { font-size: $font-2xl; font-weight: $font-bold; color: $color-text-primary; }
.ledger-badge {
  display: inline-flex; align-items: center; padding: 3px 10px;
  border-radius: $radius-full; background: $color-primary-light; color: $color-primary;
  font-size: $font-sm; font-weight: $font-semibold; flex-shrink: 0;
}
.ledger-default-desc { font-size: $font-base; color: $color-text-secondary; margin-bottom: 10px; }
.ledger-default-stats { display: flex; align-items: center; gap: 16px; font-size: $font-base; }

.ledger-stat { color: $color-text-muted; }
.ledger-stat strong { color: $color-text-primary; font-weight: $font-semibold; }
.ledger-stat-amount { color: $color-primary; }
.ledger-stat-divider {
  width: 1px; height: 14px; background: rgba($color-border-light,0.7);
}

.ledger-edit-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 8px 14px; background: transparent; color: $color-text-secondary;
  border: 1px solid rgba($color-border-light,0.7); border-radius: $radius-lg;
  font-size: $font-base; font-weight: $font-medium; font-family: inherit;
  cursor: pointer; transition: $transition-base; white-space: nowrap; flex-shrink: 0;
}
.ledger-edit-btn:hover { border-color: $color-primary-border; color: $color-primary; }
</style>
