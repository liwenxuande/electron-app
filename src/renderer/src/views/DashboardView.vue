<template>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <div class="dashboard-header-left">
        <h1 class="dashboard-title">仪表盘</h1>
        <p class="dashboard-subtitle">{{ currentMonth }}</p>
      </div>
      <div class="dashboard-header-actions">
        <BookSwitcher />
        <el-button type="primary" size="large" round @click="$emit('addRecord')">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:6px">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>记一笔
        </el-button>
      </div>
    </div>

    <div class="dashboard-body">
      <div class="dashboard-kpi-row">
        <div class="dashboard-kpi-card">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-icon dashboard-kpi-icon--expense">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#FF8C00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <span class="dashboard-kpi-label">本月支出</span>
          </div>
          <p class="dashboard-kpi-value expense">¥{{ formatAmount(monthlyStats.totalExpense) }}</p>
          <p class="dashboard-kpi-trend">较上月 <span class="trend-up">+{{ expenseTrend }}%</span></p>
        </div>

        <div class="dashboard-kpi-card">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-icon dashboard-kpi-icon--income">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <span class="dashboard-kpi-label">本月收入</span>
          </div>
          <p class="dashboard-kpi-value income">¥{{ formatAmount(monthlyStats.totalIncome) }}</p>
          <p class="dashboard-kpi-trend">较上月 <span class="trend-flat">+0.0%</span></p>
        </div>

        <div class="dashboard-kpi-card">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-icon dashboard-kpi-icon--balance">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
            </div>
            <span class="dashboard-kpi-label">本月结余</span>
          </div>
          <p class="dashboard-kpi-value" :class="balanceClass">¥{{ formatAmount(monthlyStats.totalIncome - monthlyStats.totalExpense) }}</p>
          <p class="dashboard-kpi-trend">较上月 <span :class="balanceTrendClass">{{ balanceTrendText }}</span></p>
        </div>

        <div class="dashboard-kpi-card">
          <div class="dashboard-kpi-head">
            <div class="dashboard-kpi-icon dashboard-kpi-icon--rate">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <span class="dashboard-kpi-label">储蓄率</span>
          </div>
          <p class="dashboard-kpi-value rate">{{ savingsRate }}%</p>
          <p class="dashboard-kpi-trend">目标 40% <span class="trend-down">未达标</span></p>
        </div>
      </div>

      <div class="dashboard-main-grid">
        <div class="dashboard-card">
          <div class="dashboard-card-header">
            <h2 class="dashboard-card-title">最近账单</h2>
            <span class="dashboard-card-link" @click="$emit('goTransactions')">
              查看全部
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </div>
          <div class="dashboard-txn-list">
            <div v-for="item in recentTransactions" :key="item.id" class="dashboard-txn-row">
              <div class="dashboard-txn-icon" :style="{ background: getTxnIconBg(item), color: getTxnIconColor(item) }">
                <svg v-if="item.type === 'income'" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
              </div>
              <div class="dashboard-txn-body">
                <p class="dashboard-txn-desc">{{ item.description || item.category_name }}</p>
                <p class="dashboard-txn-meta">{{ item.trans_date }} · {{ item.category_name }}</p>
              </div>
              <p class="dashboard-txn-amount" :class="item.type === 'income' ? 'income' : 'expense'">
                {{ item.type === 'income' ? '+' : '-' }}¥{{ item.amount.toFixed(2) }}
              </p>
            </div>
            <el-empty v-if="recentTransactions.length === 0" description="暂无记账记录" :image-size="60" />
          </div>
        </div>

        <div class="dashboard-side-col">
          <div class="dashboard-card dashboard-illustration">
            <img src="/dashboard-hero.jpg" alt="" class="dashboard-hero-img" />
          </div>

          <div class="dashboard-card dashboard-pie-card">
            <h2 class="dashboard-card-title dashboard-pie-title">消费分布</h2>
            <div class="dashboard-pie-body">
              <div class="dashboard-pie-chart">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle cx="70" cy="70" r="50" fill="none" stroke="#F0F2F5" stroke-width="20"/>
                  <template v-for="(s, i) in expensePieDonut" :key="i">
                    <circle cx="70" cy="70" r="50" fill="none" :stroke="s.color" stroke-width="20"
                      :stroke-dasharray="s.dash" :stroke-dashoffset="s.offset"
                      stroke-linecap="round" transform="rotate(-90 70 70)"/>
                  </template>
                  <text x="70" y="66" text-anchor="middle" font-size="16" font-weight="700" fill="#1A1A2E">¥{{ formatAmountInt(monthlyStats.totalExpense) }}</text>
                  <text x="70" y="82" text-anchor="middle" font-size="10" fill="#9CA3AF">本月支出</text>
                </svg>
              </div>
              <div class="dashboard-pie-legend">
                <div v-for="(item, i) in expensePieLegend" :key="i" class="dashboard-pie-legend-row">
                  <span class="dashboard-pie-dot" :style="{ background: item.color }"></span>
                  <span class="dashboard-pie-name">{{ item.name }}</span>
                  <span class="dashboard-pie-pct">{{ item.pct }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dashboard-quick-grid">
        <div class="dashboard-quick-btn" @click="$emit('addRecord')">
          <div class="dashboard-quick-btn-icon" style="background:rgba(255,140,0,0.1);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FF8C00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <span class="dashboard-quick-label">快速记账</span>
        </div>
        <div class="dashboard-quick-btn" @click="$emit('goTo', 'statistics')">
          <div class="dashboard-quick-btn-icon" style="background:rgba(59,130,246,0.1);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <span class="dashboard-quick-label">账单分析</span>
        </div>
        <div class="dashboard-quick-btn" @click="$emit('goTo', 'ledger')">
          <div class="dashboard-quick-btn-icon" style="background:rgba(139,92,246,0.1);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <span class="dashboard-quick-label">账本管理</span>
        </div>
        <div class="dashboard-quick-btn" @click="$emit('importCsv')">
          <div class="dashboard-quick-btn-icon" style="background:rgba(16,185,129,0.1);">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
            </svg>
          </div>
          <span class="dashboard-quick-label">导入账单</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useTransactionStore } from '../stores/transactionStore'
import { useLedgerStore } from '../stores/ledgerStore'
import BookSwitcher from '../components/BookSwitcher.vue'
import dayjs from 'dayjs'

defineEmits<{
  addRecord: []
  importCsv: []
  goTransactions: []
  goTo: [nav: string]
}>()

const PIE_COLORS = ['#FF8C00', '#3B82F6', '#8B5CF6', '#EC4899', '#0EA5E9', '#F59E0B', '#10B981', '#6B7280']

const TXN_ICONS: Record<string, { bg: string; color: string }> = {}
const ICON_COLORS = [
  { bg: 'rgba(255,140,0,0.08)', color: '#FF8C00' },
  { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6' },
  { bg: 'rgba(139,92,246,0.08)', color: '#8B5CF6' },
  { bg: 'rgba(236,72,153,0.08)', color: '#EC4899' },
  { bg: 'rgba(14,165,233,0.08)', color: '#0EA5E9' },
  { bg: 'rgba(16,185,129,0.08)', color: '#10B981' },
]

const transactionStore = useTransactionStore()
const ledgerStore = useLedgerStore()

const monthlyStats = ref({ totalIncome: 0, totalExpense: 0 })
const recentTransactions = ref<TransactionRow2[]>([])
const expensePieData = ref<{ category_name: string; total: number }[]>([])

const currentMonth = computed(() => dayjs().format('YYYY年M月'))

const balance = computed(() => monthlyStats.value.totalIncome - monthlyStats.value.totalExpense)
const balanceClass = computed(() => balance.value >= 0 ? 'income' : 'expense')
const balanceTrendText = computed(() => balance.value >= 0 ? '+0.0%' : '-0.0%')
const balanceTrendClass = computed(() => balance.value >= 0 ? 'trend-up' : 'trend-down')

const savingsRate = computed(() => {
  const inc = monthlyStats.value.totalIncome
  if (inc <= 0) return '0.0'
  return ((balance.value / inc) * 100).toFixed(1)
})

const expenseTrend = computed(() => {
  return '0.0'
})

const expensePieDonut = computed(() => {
  const total = expensePieData.value.reduce((s, i) => s + i.total, 0)
  if (total <= 0) return []
  const circumference = Math.PI * 100
  let offset = 0
  return expensePieData.value.map((item, i) => {
    const pct = item.total / total
    const dash = Math.round(pct * circumference)
    const slice = { color: PIE_COLORS[i % PIE_COLORS.length], dash: `${dash} ${circumference - dash}`, offset }
    offset -= dash
    return slice
  })
})

const expensePieLegend = computed(() => {
  const total = expensePieData.value.reduce((s, i) => s + i.total, 0)
  return expensePieData.value.map((item, i) => ({
    name: item.category_name,
    color: PIE_COLORS[i % PIE_COLORS.length],
    pct: total > 0 ? Math.round((item.total / total) * 100) : 0
  }))
})

function getTxnIconBg(item: { category_name?: string }) {
  const key = item.category_name || ''
  if (!TXN_ICONS[key]) {
    const idx = Object.keys(TXN_ICONS).length
    TXN_ICONS[key] = ICON_COLORS[idx % ICON_COLORS.length]
  }
  return TXN_ICONS[key].bg
}

function getTxnIconColor(item: { category_name?: string }) {
  const key = item.category_name || ''
  if (!TXN_ICONS[key]) {
    const idx = Object.keys(TXN_ICONS).length
    TXN_ICONS[key] = ICON_COLORS[idx % ICON_COLORS.length]
  }
  return TXN_ICONS[key].color
}

onMounted(() => { fetchData() })
watch(() => ledgerStore.currentId, () => { fetchData() })

async function fetchData() {
  transactionStore.fetchMonthlyStats()
  monthlyStats.value = transactionStore.monthlyStats

  const res = await window.transactionAPI.getTransactionList({
    page: 1, pageSize: 6, ledgerId: ledgerStore.currentId
  })
  if (res.code === 0) {
    recentTransactions.value = res.data.list
  }

  const yearMonth = dayjs().format('YYYY-MM')
  const statsRes = await window.transactionAPI.getStats(
    `${yearMonth}-01`, dayjs().endOf('month').format('YYYY-MM-DD'), undefined, ledgerStore.currentId
  )
  if (statsRes.code === 0) {
    expensePieData.value = (statsRes.data.expenseCategoryStats || []).slice(0, 5)
  }
}

function formatAmount(val: number): string { return val.toFixed(2) }
function formatAmountInt(val: number): string { return Math.round(val).toLocaleString() }
</script>

<style scoped>
.dashboard-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dashboard-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 40px;
  flex-shrink: 0;
}

.dashboard-header-left { min-width: 0; }

.dashboard-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.dashboard-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1A1A2E;
  letter-spacing: -0.02em;
  line-height: 1.3;
  margin-bottom: 4px;
}

.dashboard-subtitle {
  font-size: 0.8125rem;
  color: #6B7280;
}

.dashboard-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 40px 32px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.dashboard-kpi-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: default;
}

.dashboard-kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.dashboard-kpi-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.dashboard-kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard-kpi-icon--expense { background: rgba(255,140,0,0.1); }
.dashboard-kpi-icon--income { background: rgba(16,185,129,0.1); }
.dashboard-kpi-icon--balance { background: rgba(59,130,246,0.1); }
.dashboard-kpi-icon--rate { background: rgba(245,158,11,0.1); }

.dashboard-kpi-label {
  font-size: 0.8125rem;
  color: #6B7280;
}

.dashboard-kpi-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dashboard-kpi-value.income { color: #10B981; }
.dashboard-kpi-value.expense { color: #FF8C00; }
.dashboard-kpi-value.rate { color: #F59E0B; }

.dashboard-kpi-trend {
  font-size: 0.75rem;
  color: #9CA3AF;
  margin-top: 6px;
}

.trend-up { color: #EF4444; }
.trend-down { color: #EF4444; }
.trend-flat { color: #10B981; }

.dashboard-main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.dashboard-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.dashboard-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 0;
  margin-bottom: 20px;
}

.dashboard-card-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1A1A2E;
}

.dashboard-card-link {
  font-size: 0.8125rem;
  color: #FF8C00;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.dashboard-txn-list {
  padding: 0 24px 8px;
}

.dashboard-txn-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid rgba(235,238,242,0.7);
  gap: 12px;
  transition: background 0.15s;
}
.dashboard-txn-row:last-child { border-bottom: none; }
.dashboard-txn-row:hover {
  background: rgba(0,0,0,0.015);
  margin: 0 -16px;
  padding: 12px 16px;
  border-radius: 8px;
}

.dashboard-txn-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dashboard-txn-body {
  flex: 1;
  min-width: 0;
}

.dashboard-txn-desc {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #1A1A2E;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dashboard-txn-meta {
  font-size: 0.75rem;
  color: #9CA3AF;
  margin-top: 2px;
}

.dashboard-txn-amount {
  font-size: 0.8125rem;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}
.dashboard-txn-amount.income { color: #10B981; }
.dashboard-txn-amount.expense { color: #EF4444; }

.dashboard-side-col {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.dashboard-illustration {
  padding: 0;
  overflow: hidden;
  border-radius: 12px;
  max-height: 160px;
  flex-shrink: 0;
}

.dashboard-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dashboard-pie-card {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.dashboard-pie-title {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.dashboard-pie-body {
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 1;
}

.dashboard-pie-body {
  display: flex;
  align-items: center;
  gap: 24px;
}

.dashboard-pie-chart {
  flex-shrink: 0;
}

.dashboard-pie-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.dashboard-pie-legend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashboard-pie-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
  margin-right: 8px;
}

.dashboard-pie-name {
  font-size: 0.8125rem;
  color: #6B7280;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dashboard-pie-pct {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #1A1A2E;
  white-space: nowrap;
}

.dashboard-quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.dashboard-quick-btn {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.dashboard-quick-btn:hover {
  border-color: #FFAD42;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  transform: translateY(-2px);
}

.dashboard-quick-btn-icon {
  width: 48px;
  height: 48px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard-quick-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #1A1A2E;
}
</style>
