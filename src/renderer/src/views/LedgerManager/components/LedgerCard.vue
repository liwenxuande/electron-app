<template>
  <div class="ledger-card" @click="$emit('select')">
    <div class="ledger-card-top">
      <div class="ledger-card-icon" :style="{ background: iconBg, color: iconColor }">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <line x1="8" y1="7" x2="16" y2="7"/>
          <line x1="8" y1="11" x2="13" y2="11"/>
        </svg>
      </div>
      <button class="ledger-menu-btn" @click.stop="$emit('menu', $event)">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
    </div>
    <div class="ledger-card-body">
      <h4 class="ledger-card-name">{{ ledger.name }}</h4>
      <p class="ledger-card-desc">{{ ledger.description || '暂无描述' }}</p>
    </div>
    <div class="ledger-card-footer">
      <span class="ledger-stat">共 <strong>{{ stats.count }}</strong> 笔</span>
      <span class="ledger-stat-divider"></span>
      <span class="ledger-stat">本月 <strong :style="{ color: iconColor }">¥{{ formatAmount(stats.monthlyExpense) }}</strong></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatAmount } from '@/utils/format'

defineProps<{
  ledger: LedgerRow
  stats: { count: number; monthlyExpense: number }
  iconBg: string
  iconColor: string
}>()

defineEmits<{
  select: []
  menu: [event: MouseEvent]
}>()
</script>

<style scoped>
.ledger-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  padding: 24px;
  display: flex; flex-direction: column; gap: 12px;
  cursor: pointer; transition: all 0.2s ease;
}
.ledger-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  transform: translateY(-2px);
}
.ledger-card-top {
  display: flex; align-items: flex-start; justify-content: space-between;
}
.ledger-card-icon {
  width: 44px; height: 44px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: transform 0.2s ease;
}
.ledger-card:hover .ledger-card-icon { transform: scale(1.06); }

.ledger-menu-btn {
  width: 28px; height: 28px; border-radius: 4px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  color: #9CA3AF; transition: all 0.15s ease; flex-shrink: 0;
}
.ledger-menu-btn:hover { background: #F5F7FA; color: #6B7280; }

.ledger-card-body { min-width: 0; }
.ledger-card-name {
  font-size: 0.875rem; font-weight: 600; color: #1A1A2E; margin-bottom: 4px;
}
.ledger-card-desc {
  font-size: 0.75rem; color: #9CA3AF;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ledger-card-footer {
  display: flex; align-items: center; gap: 12px;
  font-size: 0.75rem; padding-top: 8px;
  border-top: 1px solid rgba(235,238,242,0.7);
}

.ledger-stat { color: #9CA3AF; }
.ledger-stat strong { color: #1A1A2E; font-weight: 600; }
.ledger-stat-divider {
  width: 1px; height: 14px; background: rgba(235,238,242,0.7);
}
</style>
