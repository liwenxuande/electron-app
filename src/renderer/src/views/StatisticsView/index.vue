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
          :clearable="false"
          class="stats-period-picker"
          @change="fetchStats"
        />
        <el-date-picker
          v-if="period === 'year'"
          v-model="selectedYear"
          type="year"
          placeholder="选择年份"
          format="YYYY"
          value-format="YYYY"
          :clearable="false"
          class="stats-period-picker"
          @change="fetchStats"
        />
        <QuarterPicker
          v-if="period === 'quarter'"
          v-model="selectedQuarter"
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
          :clearable="false"
          class="stats-period-picker stats-period-range"
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
            <div class="stats-gran-toggle" v-if="visibleGrainOptions.length > 1">
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
              <div class="stats-rank-num" :class="rankClass(idx)">{{ idx + 1 }}</div>
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
import { ref, computed, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { useLedgerStore } from '@/stores/ledgerStore'
import BookSwitcher from '@/components/BookSwitcher.vue'
import QuarterPicker from '@/components/QuarterPicker.vue'
import CategoryDetailDialog from '@/components/CategoryDetailDialog.vue'
import { formatAmount } from '@/utils/format'
import { makeIconColors } from '@/const'
import { useStatsPeriod, PERIODS, type Grain } from './composables/useStatsPeriod'
import { useStatsData } from './composables/useStatsData'

// ---- Constants ----
const PIE_COLORS = ['#FF8C00', '#8B5CF6', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6B7280']
const RANK_ICONS = makeIconColors(PIE_COLORS, 0.08)

// ---- Composables ----
const periodCtx = useStatsPeriod()
const dataCtx = useStatsData()

const { period, grain, selectedMonth, selectedYear, selectedQuarter, customRange,
  visibleGrainOptions, kpiExpenseLabel, kpiIncomeLabel, periodLabel,
  validateGrain, getDateRange } = periodCtx
const { dailyStats, expenseCategoryStats, topExpenseList, topIncomeList, kpiData } = dataCtx

const periods = PERIODS
const kpiDailyLabel = computed(() => '日均消费')

// ---- Detail dialog ----
const detailVisible = ref(false)
const detailCategoryName = ref('')
const detailCategoryId = ref(0)
const detailDateRange = computed(() => getDateRange())

// ---- Chart computed ----
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

// ---- Actions ----
function setPeriod(key: typeof period.value) {
  period.value = key
  validateGrain()
  fetchStats()
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

async function fetchStats() {
  await dataCtx.fetchAll(getDateRange())
}

function showCategoryDetail(item: { name: string }) {
  const cat = expenseCategoryStats.value.find((c: any) => c.category_name === item.name)
  if (cat) {
    detailCategoryName.value = item.name
    detailCategoryId.value = cat.category_id
    detailVisible.value = true
  }
}

function rankClass(idx: number): string {
  if (idx === 0) return 'rank-gold'
  if (idx === 1) return 'rank-silver'
  if (idx === 2) return 'rank-bronze'
  return ''
}

// ---- Lifecycle ----
const ledgerStore = useLedgerStore()
onMounted(() => { validateGrain(); fetchStats() })
watch(() => ledgerStore.currentId, () => { fetchStats() })
</script>

<style lang="scss" scoped>
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
  font-size: $font-4xl;
  font-weight: $font-bold;
  color: $color-text-primary;
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
  background: rgba($color-bg-white, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba($color-border-light,0.7);
  border-radius: $radius-lg;
  padding: 4px;
  gap: 2px;
}

.stats-period-btn {
  padding: 6px 12px;
  border-radius: $radius-sm;
  font-size: $font-sm;
  font-weight: $font-medium;
  color: $color-text-muted;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: $transition-base;
  font-family: inherit;
  white-space: nowrap;
}

.stats-period-btn:hover {
  background: $color-primary-light;
  color: $color-primary;
}

.stats-period-btn.active {
  background: $color-primary;
  color: #fff;
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
  background: rgba($color-bg-white, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba($color-border-light,0.7);
  border-radius: $radius-xl;
  padding: 20px;
  box-shadow: $shadow-sm;
  transition: transform 0.15s, box-shadow 0.15s;
  cursor: default;
}

.stats-kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: $shadow-md;
}

.stats-kpi-icon {
  width: 32px;
  height: 32px;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.stats-kpi-icon--expense { background: rgba($color-primary,0.1); color: $color-primary; }
.stats-kpi-icon--income { background: rgba($color-success,0.08); color: $color-success; }
.stats-kpi-icon--daily { background: rgba($color-info,0.08); color: $color-info; }
.stats-kpi-icon--rate { background: rgba(245,158,11,0.08); color: $color-warning; }
.stats-kpi-icon--count { background: rgba(139,92,246,0.08); color: $color-purple; }

.stats-kpi-label {
  font-size: $font-base;
  color: $color-text-secondary;
  margin-bottom: 4px;
}

.stats-kpi-value {
  font-size: $font-3xl;
  font-weight: $font-bold;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stats-kpi-value.expense { color: $color-primary; }
.stats-kpi-value.income { color: $color-success; }
.stats-kpi-value.daily { color: $color-info; }
.stats-kpi-value.rate { color: $color-text-primary; }
.stats-kpi-value.count { color: $color-purple; }

.stats-charts-row {
  display: grid;
  grid-template-columns: 55fr 45fr;
  gap: 20px;
  margin-bottom: 28px;
}

.stats-chart-card {
  background: rgba($color-bg-white, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba($color-border-light,0.7);
  border-radius: $radius-xl;
  box-shadow: $shadow-sm;
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
  font-size: $font-xl;
  font-weight: $font-semibold;
  color: $color-text-primary;
}

.stats-gran-toggle {
  display: inline-flex;
  align-items: center;
  background: $color-bg-hover;
  border-radius: $radius-md;
  padding: 2px;
  gap: 1px;
}

.stats-gran-btn {
  padding: 4px 10px;
  border-radius: $radius-sm;
  font-size: 0.7rem;
  font-weight: $font-medium;
  color: $color-text-muted;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: $transition-base;
  font-family: inherit;
}

.stats-gran-btn:hover {
  color: $color-primary;
}

.stats-gran-btn.active {
  background: rgba(255,255,255,0.9);
  color: $color-primary;
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

.stats-chart-body {
  min-height: 280px;
}

.stats-pie-body {
  min-height: 320px;
}

.stats-rank-card {
  background: rgba($color-bg-white, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba($color-border-light,0.7);
  border-radius: $radius-xl;
  box-shadow: $shadow-sm;
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
  font-size: $font-base;
  color: $color-text-muted;
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
  border-radius: $radius-lg;
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
  border-radius: $radius-sm;
  background: $color-bg-hover;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-base;
  font-weight: $font-bold;
  color: $color-text-secondary;
  flex-shrink: 0;
}

.stats-rank-num.rank-gold {
  background: rgba($color-primary,0.12);
  color: $color-primary;
  font-weight: 800;
}
.stats-rank-num.rank-silver {
  background: rgba(156,163,175,0.12);
  color: $color-text-secondary;
  font-weight: $font-bold;
}
.stats-rank-num.rank-bronze {
  background: rgba(217,119,6,0.1);
  color: #D97706;
  font-weight: $font-bold;
}

.stats-header-right :deep(.el-date-editor) {
  width: 130px;
  flex-shrink: 0;
}

.stats-header-right :deep(.el-range-editor) {
  width: 230px;
  flex-shrink: 0;
}

.stats-header-right :deep(.el-input__wrapper) {
  padding-left: 6px;
  padding-right: 0;
}

.stats-rank-icon {
  width: 36px;
  height: 36px;
  border-radius: $radius-lg;
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
  font-size: $font-md;
  font-weight: $font-medium;
  color: $color-text-primary;
}

.stats-rank-amount {
  font-size: $font-md;
  font-weight: $font-semibold;
  font-variant-numeric: tabular-nums;
}

.stats-rank-bar-bg {
  height: 6px;
  background: $color-bg-page;
  border-radius: $radius-full;
  overflow: hidden;
}

.stats-rank-bar-fill {
  height: 100%;
  border-radius: $radius-full;
  transition: width 0.5s ease;
}

.stats-rank-pct {
  font-size: $font-base;
  font-weight: $font-medium;
  color: $color-text-secondary;
  white-space: nowrap;
  flex-shrink: 0;
  width: 36px;
  text-align: right;
}

.stats-single-list {
  padding: 20px 24px 8px;
}

.stats-single-title {
  font-size: $font-md;
  font-weight: $font-semibold;
  color: $color-text-primary;
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
  border-radius: $radius-sm; background: $color-bg-hover;
  display: flex; align-items: center; justify-content: center;
  font-size: $font-xs; font-weight: $font-bold; color: $color-text-secondary;
  flex-shrink: 0;
}

.stats-single-amount {
  font-size: $font-base; font-weight: $font-semibold;
  font-variant-numeric: tabular-nums; white-space: nowrap;
  min-width: 80px;
}

.stats-single-amount.expense { color: $color-primary; }
.stats-single-amount.income { color: $color-success; }

.stats-single-cat {
  font-size: $font-base; color: $color-text-secondary;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.stats-single-date {
  font-size: $font-sm; color: $color-text-muted;
  white-space: nowrap; flex-shrink: 0;
}

.stats-single-divider {
  height: 1px; background: $color-bg-page; margin: 0 24px;
}

.stats-rank-right {
  display: flex; align-items: center; gap: 8px;
}

.stats-rank-count {
  font-size: $font-sm; color: $color-text-muted;
  white-space: nowrap;
}
</style>
