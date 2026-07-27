<template>
  <div class="stats-page">
    <div class="stats-header">
      <div class="stats-header-left">
        <h1 class="stats-title">统计分析</h1>
        <BookSwitcher />
      </div>
      <div class="stats-header-right">
        <div class="stats-period-toggle">
          <button
            v-for="p in periods"
            :key="p.key"
            class="stats-period-btn"
            :class="{ active: period === p.key }"
            @click="setPeriod(p.key)"
          >{{ p.label }}</button>
        </div>
        <el-date-picker
          v-if="period === 'month'"
          v-model="selectedMonth"
          type="month"
          placeholder="选择月份"
          format="YYYY-MM"
          value-format="YYYY-MM"
          size="small"
          class="stats-period-select"
          @change="fetchStats"
        />
        <el-date-picker
          v-if="period === 'year'"
          v-model="selectedYear"
          type="year"
          placeholder="选择年份"
          format="YYYY"
          value-format="YYYY"
          size="small"
          class="stats-period-select"
          @change="fetchStats"
        />
        <QuarterPicker
          v-if="period === 'quarter'"
          v-model="selectedQuarter"
          class="stats-period-select"
          @change="fetchStats"
        />
        <el-date-picker
          v-if="period === 'custom'"
          v-model="customRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          size="small"
          class="stats-period-select"
          @change="onCustomRangeChange"
        />
      </div>
    </div>

    <div class="stats-body">

      <div class="stats-kpi-row">
        <div class="stats-kpi-card">
          <div class="stats-kpi-icon stats-kpi-icon--expense">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <p class="stats-kpi-label">{{ kpiExpenseLabel }}</p>
          <p class="stats-kpi-value expense">¥{{ formatAmount(kpiData.avgExpense) }}</p>
        </div>

        <div class="stats-kpi-card">
          <div class="stats-kpi-icon stats-kpi-icon--income">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
          <p class="stats-kpi-label">{{ kpiIncomeLabel }}</p>
          <p class="stats-kpi-value income">¥{{ formatAmount(kpiData.avgIncome) }}</p>
        </div>

        <div class="stats-kpi-card">
          <div class="stats-kpi-icon stats-kpi-icon--daily">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <p class="stats-kpi-label">{{ kpiDailyLabel }}</p>
          <p class="stats-kpi-value daily">¥{{ formatAmount(kpiData.avgDaily) }}</p>
        </div>

        <div class="stats-kpi-card">
          <div class="stats-kpi-icon stats-kpi-icon--rate">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <p class="stats-kpi-label">储蓄率</p>
          <p class="stats-kpi-value rate">{{ kpiData.savingsRate }}%</p>
        </div>

        <div class="stats-kpi-card">
          <div class="stats-kpi-icon stats-kpi-icon--count">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
            </svg>
          </div>
          <p class="stats-kpi-label">记账笔数</p>
          <p class="stats-kpi-value count">{{ kpiData.transactionCount }}</p>
        </div>
      </div>

      <div class="stats-charts-row">
        <div class="stats-chart-card stats-chart-card--main">
          <div class="stats-chart-header">
            <h2 class="stats-chart-title">收支趋势</h2>
            <div class="stats-gran-toggle">
              <button
                v-for="g in visibleGrainOptions"
                :key="g.key"
                class="stats-gran-btn"
                :class="{ active: grain === g.key }"
                @click="setGrain(g.key)"
              >{{ g.label }}</button>
            </div>
          </div>
          <div class="stats-chart-body">
            <v-chart
              v-if="lineChartOption"
              :option="lineChartOption"
              :autoresize="true"
              style="height: 280px"
            />
            <el-empty v-else description="暂无数据" :image-size="60" />
          </div>
        </div>

        <div class="stats-chart-card stats-chart-card--side">
          <h2 class="stats-chart-title">消费分类占比</h2>
          <div class="stats-pie-body">
            <v-chart
              v-if="pieChartOption"
              :option="pieChartOption"
              :autoresize="true"
              style="height: 320px"
            />
            <el-empty v-else description="暂无支出数据" :image-size="60" />
          </div>
        </div>
      </div>

      <div class="stats-rank-row-area">
        <div class="stats-rank-card">
          <div class="stats-rank-header">
            <h2 class="stats-chart-title">分类消费排行</h2>
            <span class="stats-rank-period">{{ periodLabel }}</span>
          </div>
          <div class="stats-rank-list">
            <div
              v-for="(item, idx) in rankList"
              :key="idx"
              class="stats-rank-row"
              @click="showCategoryDetail(item)"
            >
              <div class="stats-rank-num" :class="{ 'rank-top': idx < 3 }">{{ idx + 1 }}</div>
              <div class="stats-rank-icon" :style="{ background: item.iconBg }">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" :stroke="item.iconColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <div class="stats-rank-body">
                <div class="stats-rank-info">
                  <span class="stats-rank-name">{{ item.name }}</span>
                  <span class="stats-rank-right">
                    <span class="stats-rank-amount" :style="{ color: item.iconColor }">¥{{ formatAmount(item.total) }}</span>
                    <span class="stats-rank-count">{{ item.count }}笔</span>
                  </span>
                </div>
                <div class="stats-rank-bar-bg">
                  <div class="stats-rank-bar-fill" :style="{ width: item.pct + '%', background: item.iconColor }"></div>
                </div>
              </div>
              <span class="stats-rank-pct">{{ item.pct }}%</span>
            </div>
            <el-empty v-if="rankList.length === 0" description="暂无数据" :image-size="60" />
          </div>
        </div>

        <div class="stats-rank-card">
          <div class="stats-single-list">
            <h3 class="stats-single-title">单笔支出排行</h3>
            <div v-if="topExpenseList.length > 0">
              <div v-for="(item, idx) in topExpenseList.slice(0, 10)" :key="'e'+idx" class="stats-single-row">
                <span class="stats-single-num">{{ idx + 1 }}</span>
                <span class="stats-single-amount expense">¥{{ item.amount.toFixed(2) }}</span>
                <span class="stats-single-cat">{{ item.category_name }}</span>
                <span class="stats-single-date">{{ item.trans_date }}</span>
              </div>
            </div>
            <el-empty v-else description="暂无支出数据" :image-size="40" />
          </div>
          <div class="stats-single-divider"></div>
          <div class="stats-single-list">
            <h3 class="stats-single-title">单笔收入排行</h3>
            <div v-if="topIncomeList.length > 0">
              <div v-for="(item, idx) in topIncomeList.slice(0, 10)" :key="'i'+idx" class="stats-single-row">
                <span class="stats-single-num">{{ idx + 1 }}</span>
                <span class="stats-single-amount income">¥{{ item.amount.toFixed(2) }}</span>
                <span class="stats-single-cat">{{ item.category_name }}</span>
                <span class="stats-single-date">{{ item.trans_date }}</span>
              </div>
            </div>
            <el-empty v-else description="暂无收入数据" :image-size="40" />
          </div>
        </div>
      </div>
    </div>

    <CategoryDetailDialog
      v-model:visible="detailVisible"
      :category-name="detailCategoryName"
      :category-id="detailCategoryId"
      :start-date="detailDateRange.start"
      :end-date="detailDateRange.end"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useLedgerStore } from '../stores/ledgerStore'
import BookSwitcher from '../components/BookSwitcher.vue'
import QuarterPicker from '../components/QuarterPicker.vue'
import CategoryDetailDialog from '../components/CategoryDetailDialog.vue'

const PIE_COLORS = ['#FF8C00', '#8B5CF6', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6B7280']
const RANK_ICONS = [
  { bg: 'rgba(255,140,0,0.08)', color: '#FF8C00' },
  { bg: 'rgba(139,92,246,0.08)', color: '#8B5CF6' },
  { bg: 'rgba(59,130,246,0.08)', color: '#3B82F6' },
  { bg: 'rgba(245,158,11,0.08)', color: '#F59E0B' },
  { bg: 'rgba(239,68,68,0.08)', color: '#EF4444' },
  { bg: 'rgba(16,185,129,0.08)', color: '#10B981' },
  { bg: 'rgba(236,72,153,0.08)', color: '#EC4899' },
  { bg: 'rgba(107,114,128,0.08)', color: '#6B7280' },
]

const ledgerStore = useLedgerStore()

const period = ref<'all' | 'month' | 'quarter' | 'year' | 'custom'>('month')
const periods = [
  { key: 'all' as const, label: '全部' },
  { key: 'month' as const, label: '月' },
  { key: 'quarter' as const, label: '季' },
  { key: 'year' as const, label: '年' },
  { key: 'custom' as const, label: '自定义' },
]

type Grain = 'day' | 'month' | 'quarter'
const grain = ref<Grain>('month')

const grainOptions = [
  { key: 'day' as const, label: '日' },
  { key: 'month' as const, label: '月' },
  { key: 'quarter' as const, label: '季' },
]

const availableGrains = computed<Grain[]>(() => {
  if (period.value === 'month') return ['day']
  if (period.value === 'quarter') return ['day', 'month']
  if (period.value === 'all') return ['day', 'month', 'quarter']
  if (period.value === 'custom' && customRange.value) {
    const days = dayjs(customRange.value[1]).diff(dayjs(customRange.value[0]), 'day') + 1
    if (days <= 31) return ['day']
    if (days <= 366) return ['day', 'month']
    return ['day', 'month', 'quarter']
  }
  return ['day', 'month', 'quarter']
})

const visibleGrainOptions = computed(() => {
  return grainOptions.filter(g => availableGrains.value.includes(g.key))
})

function validateGrain() {
  if (!availableGrains.value.includes(grain.value)) {
    grain.value = availableGrains.value[0]
  }
}

const now = dayjs()
const currentYear = now.year()
const selectedYear = ref<number | null>(currentYear)
const selectedMonth = ref(now.format('YYYY-MM'))
const selectedQuarter = ref(`${currentYear}-Q${Math.ceil((now.month() + 1) / 3)}`)
const customRange = ref<[string, string] | null>(null)

const kpiExpenseLabel = computed(() => {
  if (period.value === 'all') return '总支出'
  if (period.value === 'month') return '本月支出'
  if (period.value === 'quarter') return '本季支出'
  return '年均支出'
})
const kpiIncomeLabel = computed(() => {
  if (period.value === 'all') return '总收入'
  if (period.value === 'month') return '本月收入'
  if (period.value === 'quarter') return '本季收入'
  return '年均收入'
})
const kpiDailyLabel = computed(() => {
  return '日均消费'
})

const periodLabel = computed(() => {
  if (period.value === 'all') return '全部时间'
  if (period.value === 'month') return selectedMonth.value
  if (period.value === 'quarter') return selectedQuarter.value
  if (period.value === 'year') return `${selectedYear.value}年`
  if (customRange.value) return `${customRange.value[0]} ~ ${customRange.value[1]}`
  return ''
})

const dailyStats = ref<any[]>([])
const expenseCategoryStats = ref<any[]>([])
const topExpenseList = ref<any[]>([])
const topIncomeList = ref<any[]>([])

// 明细弹框状态
const detailVisible = ref(false)
const detailCategoryName = ref('')
const detailCategoryId = ref(0)
const detailDateRange = computed(() => getDateRange())

const kpiData = reactive({
  avgExpense: 0,
  avgIncome: 0,
  avgDaily: 0,
  savingsRate: 0,
  transactionCount: 0
})

const pieChartOption = computed(() => {
  const data = expenseCategoryStats.value.slice(0, 8)
  if (!data.length) return null
  const total = data.reduce((s: number, c: any) => s + c.total, 0)
  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(26,26,46,0.9)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#F0F2F5', fontSize: 12 },
      formatter: (params: any) => `${params.marker} ${params.name}: ¥${params.value.toFixed(2)} (${params.percent}%)`
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'middle',
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 8,
      textStyle: { color: '#6B7280', fontSize: 11 },
      selectedMode: true,
    },
    series: [{
      type: 'pie',
      radius: ['50%', '75%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 3,
        borderColor: '#fff',
        borderWidth: 2,
      },
      label: { show: false },
      labelLine: { show: false },
      emphasis: {
        label: { show: false },
        labelLine: { show: false },
        scaleSize: 8,
      },
      data: data.map((c: any, i: number) => ({
        name: c.category_name,
        value: c.total,
        itemStyle: { color: PIE_COLORS[i % PIE_COLORS.length] },
      })),
    }],
    graphic: total > 0 ? [{
      type: 'text',
      left: '48%',
      top: 'middle',
      style: {
        text: `¥${total.toFixed(2)}`,
        textAlign: 'center',
        fill: '#1A1A2E',
        fontSize: 13,
        fontWeight: 'bold',
      },
    }] : [],
  }
})

const aggregatedTrend = computed(() => {
  if (!dailyStats.value.length) return []
  if (grain.value === 'day') return dailyStats.value

  const groups = new Map<string, { expense: number; income: number }>()
  dailyStats.value.forEach((d: any) => {
    let key = d.date
    if (grain.value === 'month') {
      key = d.date.substring(0, 7)
    } else if (grain.value === 'quarter') {
      const m = dayjs(d.date)
      key = `${m.year()}-Q${Math.ceil((m.month() + 1) / 3)}`
    }
    const exist = groups.get(key) || { expense: 0, income: 0 }
    exist.expense += d.expense || 0
    exist.income += d.income || 0
    groups.set(key, exist)
  })
  return Array.from(groups.entries()).map(([date, v]) => ({
    date, expense: Math.round(v.expense * 100) / 100, income: Math.round(v.income * 100) / 100
  }))
})

const lineChartOption = computed(() => {
  if (!aggregatedTrend.value.length) return null
  const data = aggregatedTrend.value
  return {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26,26,46,0.9)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#F0F2F5', fontSize: 12 },
      formatter: (params: any) => {
        let html = `<strong>${params[0].axisValue}</strong><br/>`
        params.forEach((p: any) => { html += `${p.marker} ${p.seriesName}: ¥${p.value.toFixed(2)}<br/>` })
        return html
      }
    },
    legend: {
      show: true,
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 3,
      textStyle: { color: '#6B7280', fontSize: 11 },
      selectedMode: true,
    },
    grid: { left: 52, right: 16, top: 30, bottom: 24 },
    xAxis: {
      type: 'category',
      data: data.map((d: any) => d.date),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 11, color: '#9CA3AF' }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: 11, color: '#9CA3AF',
        formatter: (v: number) => v >= 1000 ? '¥' + (v / 1000).toFixed(0) + 'k' : '¥' + v
      },
      splitLine: { lineStyle: { color: '#F0F2F5' } }
    },
    series: [
      {
        name: '支出', type: 'line',
        data: data.map((d: any) => d.expense),
        smooth: true, symbol: 'circle', symbolSize: 3,
        lineStyle: { color: '#FF8C00', width: 2.5 },
        itemStyle: { color: '#FF8C00' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(255,140,0,0.15)' }, { offset: 1, color: 'rgba(255,140,0,0.01)' }] } }
      },
      {
        name: '收入', type: 'line',
        data: data.map((d: any) => d.income),
        smooth: true, symbol: 'circle', symbolSize: 3,
        lineStyle: { color: '#10B981', width: 2.5 },
        itemStyle: { color: '#10B981' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(16,185,129,0.12)' }, { offset: 1, color: 'rgba(16,185,129,0.01)' }] } }
      }
    ]
  }
})

const rankList = computed(() => {
  const total = expenseCategoryStats.value.reduce((s, i) => s + i.total, 0)
  return [...expenseCategoryStats.value]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((c: any, i: number) => ({
      name: c.category_name,
      total: c.total,
      count: c.count || 0,
      pct: total > 0 ? Math.round((c.total / total) * 100) : 0,
      iconBg: RANK_ICONS[i % RANK_ICONS.length].bg,
      iconColor: RANK_ICONS[i % RANK_ICONS.length].color
    }))
})

onMounted(() => {
  validateGrain()
  fetchStats()
  fetchTopTransactions()
})
watch(() => ledgerStore.currentId, () => { fetchStats(); fetchTopTransactions() })
watch(period, () => {
  validateGrain()
  fetchStats()
})

function setPeriod(key: 'all' | 'month' | 'quarter' | 'year' | 'custom') {
  period.value = key
}

function setGrain(g: Grain) {
  grain.value = g
}

function onCustomRangeChange() {
  if (customRange.value && customRange.value.length === 2) {
    validateGrain()
    fetchStats()
  }
}

function getDateRange() {
  if (period.value === 'custom' && customRange.value) {
    const days = dayjs(customRange.value[1]).diff(dayjs(customRange.value[0]), 'day') + 1
    const months = Math.max(days / 30, 1)
    return { start: customRange.value[0], end: customRange.value[1], months }
  }
  if (period.value === 'all') {
    return { start: '2000-01-01', end: dayjs().format('YYYY-MM-DD'), months: 120 }
  }
  if (period.value === 'month') {
    const m = dayjs(selectedMonth.value)
    return { start: m.startOf('month').format('YYYY-MM-DD'), end: m.endOf('month').format('YYYY-MM-DD'), months: 1 }
  }
  if (period.value === 'quarter') {
    const [y, q] = selectedQuarter.value.split('-Q')
    const qStart = dayjs(`${y}-${String((parseInt(q) - 1) * 3 + 1).padStart(2, '0')}-01`)
    return { start: qStart.startOf('month').format('YYYY-MM-DD'), end: qStart.add(2, 'month').endOf('month').format('YYYY-MM-DD'), months: 3 }
  }
  const y = selectedYear.value || currentYear
  const start = dayjs(`${y}-01-01`)
  return { start: start.format('YYYY-MM-DD'), end: start.endOf('year').format('YYYY-MM-DD'), months: 12 }
}

async function fetchStats() {
  const range = getDateRange()
  try {
    const res = await window.transactionAPI.getStats(range.start, range.end, undefined, ledgerStore.currentId)
    if (res.code === 0) {
      dailyStats.value = res.data.dailyStats || []
      expenseCategoryStats.value = res.data.expenseCategoryStats || []
      const incomeStats = res.data.incomeCategoryStats || []

      const totalExpense = expenseCategoryStats.value.reduce((s, c) => s + c.total, 0)
      const totalIncome = incomeStats.reduce((s, c) => s + c.total, 0)

      kpiData.avgExpense = range.months > 0 ? totalExpense / range.months : totalExpense
      kpiData.avgIncome = range.months > 0 ? totalIncome / range.months : totalIncome
      kpiData.avgDaily = range.months > 0 ? totalExpense / (range.months * 30) : 0
      kpiData.savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : 0
      kpiData.transactionCount = res.data.transactionCount || 0
    }
    fetchTopTransactions()
  } catch (error: unknown) { console.error('获取统计数据失败:', error) }
}

async function fetchTopTransactions() {
  const range = getDateRange()
  try {
    const res = await window.transactionAPI.getTopTransactions(range.start, range.end, ledgerStore.currentId)
    if (res.code === 0) {
      topExpenseList.value = res.data.expenseTop || []
      topIncomeList.value = res.data.incomeTop || []
    }
  } catch (error: unknown) {
    console.error('获取单笔排行失败:', error)
  }
}

function showCategoryDetail(item: { name: string; total: number; count: number }) {
  // 从 expenseCategoryStats 中找回完整的 category_id
  const cat = expenseCategoryStats.value.find((c: any) => c.category_name === item.name)
  if (cat) {
    detailCategoryName.value = item.name
    detailCategoryId.value = cat.category_id
    detailVisible.value = true
  }
}

function formatAmount(v: number): string {
  return v.toFixed(2)
}
</script>

<style scoped>
.stats-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 40px;
  flex-shrink: 0;
}

.stats-header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.stats-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1A1A2E;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

.stats-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stats-period-toggle {
  display: inline-flex;
  align-items: center;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 8px;
  padding: 4px;
  gap: 2px;
}

.stats-period-btn {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #9CA3AF;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}

.stats-period-btn:hover {
  background: #FFF5E6;
  color: #FF8C00;
}

.stats-period-btn.active {
  background: #FF8C00;
  color: #fff;
}

.stats-period-select {
  width: 150px;
}

.stats-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 40px 32px;
}

.stats-kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.stats-kpi-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: transform 0.15s, box-shadow 0.15s;
  cursor: default;
}

.stats-kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

.stats-kpi-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.stats-kpi-icon--expense { background: rgba(255,140,0,0.1); color: #FF8C00; }
.stats-kpi-icon--income { background: rgba(16,185,129,0.08); color: #10B981; }
.stats-kpi-icon--daily { background: rgba(59,130,246,0.08); color: #3B82F6; }
.stats-kpi-icon--rate { background: rgba(245,158,11,0.08); color: #F59E0B; }
.stats-kpi-icon--count { background: rgba(139,92,246,0.08); color: #8B5CF6; }

.stats-kpi-label {
  font-size: 0.8125rem;
  color: #6B7280;
  margin-bottom: 4px;
}

.stats-kpi-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stats-kpi-value.expense { color: #FF8C00; }
.stats-kpi-value.income { color: #10B981; }
.stats-kpi-value.daily { color: #3B82F6; }
.stats-kpi-value.rate { color: #1A1A2E; }
.stats-kpi-value.count { color: #8B5CF6; }

.stats-charts-row {
  display: grid;
  grid-template-columns: 55fr 45fr;
  gap: 20px;
  margin-bottom: 28px;
}

.stats-chart-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  overflow: hidden;
  padding: 24px;
}

.stats-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.stats-chart-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1A1A2E;
}

.stats-gran-toggle {
  display: inline-flex;
  align-items: center;
  background: #F5F7FA;
  border-radius: 6px;
  padding: 2px;
  gap: 1px;
}

.stats-gran-btn {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  color: #9CA3AF;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.stats-gran-btn:hover {
  color: #FF8C00;
}

.stats-gran-btn.active {
  background: rgba(255,255,255,0.9);
  color: #FF8C00;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.stats-chart-body {
  min-height: 280px;
}

.stats-pie-body {
  min-height: 320px;
}

.stats-rank-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  overflow: hidden;
}

.stats-rank-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
}

.stats-rank-header .stats-chart-title {
  margin-bottom: 0;
}

.stats-rank-period {
  font-size: 0.8125rem;
  color: #9CA3AF;
}

.stats-rank-list {
  padding: 0 24px 16px;
}

.stats-rank-row-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 28px;
}

.stats-rank-row {
  display: flex;
  align-items: center;
  padding: 14px 12px;
  border-radius: 8px;
  gap: 16px;
  transition: background 0.12s;
}

.stats-rank-row:hover {
  background: #FAFBFC;
  cursor: pointer;
}

.stats-rank-num {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: #F5F7FA;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #6B7280;
  flex-shrink: 0;
}

.stats-rank-num.rank-top {
  background: #FFF5E6;
  color: #FF8C00;
}

.stats-rank-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stats-rank-body {
  flex: 1;
  min-width: 0;
}

.stats-rank-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.stats-rank-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1A1A2E;
}

.stats-rank-amount {
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stats-rank-bar-bg {
  height: 6px;
  background: #F0F2F5;
  border-radius: 999px;
  overflow: hidden;
}

.stats-rank-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}

.stats-rank-pct {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6B7280;
  white-space: nowrap;
  flex-shrink: 0;
  width: 36px;
  text-align: right;
}

.stats-rank-row-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 28px;
}

.stats-rank-row {
  cursor: pointer;
}

.stats-single-list {
  padding: 20px 24px 8px;
}

.stats-single-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1A1A2E;
  margin-bottom: 12px;
}

.stats-single-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 12px;
  border-bottom: 1px solid #F5F7FA;
}

.stats-single-row:last-child { border-bottom: none; }

.stats-single-num {
  width: 20px; height: 20px;
  border-radius: 4px; background: #F5F7FA;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6875rem; font-weight: 700; color: #6B7280;
  flex-shrink: 0;
}

.stats-single-amount {
  font-size: 0.8125rem; font-weight: 600;
  font-variant-numeric: tabular-nums; white-space: nowrap;
  min-width: 80px;
}

.stats-single-amount.expense { color: #FF8C00; }
.stats-single-amount.income { color: #10B981; }

.stats-single-cat {
  font-size: 0.8125rem; color: #6B7280;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.stats-single-date {
  font-size: 0.75rem; color: #9CA3AF;
  white-space: nowrap; flex-shrink: 0;
}

.stats-single-divider {
  height: 1px; background: #F0F2F5; margin: 0 24px;
}

.stats-rank-right {
  display: flex; align-items: center; gap: 8px;
}

.stats-rank-count {
  font-size: 0.75rem; color: #9CA3AF;
  white-space: nowrap;
}
</style>
