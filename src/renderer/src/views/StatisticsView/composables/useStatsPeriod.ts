/**
 * 统计分析页面的周期/粒度选择状态。
 * 管理 period（全/月/季/年/自定义）、grain（日/月/季）、日期范围计算。
 */
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

export type Period = 'all' | 'month' | 'quarter' | 'year' | 'custom'
export type Grain = 'day' | 'month' | 'quarter'

export const PERIODS = [
  { key: 'all' as const, label: '全部' },
  { key: 'month' as const, label: '月' },
  { key: 'quarter' as const, label: '季' },
  { key: 'year' as const, label: '年' },
  { key: 'custom' as const, label: '自定义' },
]

const GRAIN_OPTIONS = [
  { key: 'day' as const, label: '日' },
  { key: 'month' as const, label: '月' },
  { key: 'quarter' as const, label: '季' },
]

export function useStatsPeriod() {
  const now = dayjs()
  const currentYear = now.year()

  const period = ref<Period>('month')
  const grain = ref<Grain>('month')
  const selectedYear = ref<number | null>(currentYear)
  const selectedMonth = ref(now.format('YYYY-MM'))
  const selectedQuarter = ref(`${currentYear}-Q${Math.ceil((now.month() + 1) / 3)}`)
  const customRange = ref<[string, string] | null>(null)

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

  const visibleGrainOptions = computed(() =>
    GRAIN_OPTIONS.filter(g => availableGrains.value.includes(g.key))
  )

  const kpiExpenseLabel = computed(() => {
    const map: Record<Period, string> = { month: '本月支出', quarter: '本季支出', year: '本年支出', all: '总支出', custom: '支出' }
    return map[period.value] || '支出'
  })

  const kpiIncomeLabel = computed(() => {
    const map: Record<Period, string> = { month: '本月收入', quarter: '本季收入', year: '本年收入', all: '总收入', custom: '收入' }
    return map[period.value] || '收入'
  })

  const periodLabel = computed(() => {
    if (period.value === 'all') return '全部时间'
    if (period.value === 'month') return selectedMonth.value
    if (period.value === 'quarter') return selectedQuarter.value
    if (period.value === 'year') return `${selectedYear.value}年`
    if (customRange.value) return `${customRange.value[0]} ~ ${customRange.value[1]}`
    return ''
  })

  function validateGrain() {
    if (!availableGrains.value.includes(grain.value)) {
      grain.value = availableGrains.value[0]
    }
  }

  function getDateRange() {
    if (period.value === 'custom' && customRange.value) {
      const days = dayjs(customRange.value[1]).diff(dayjs(customRange.value[0]), 'day') + 1
      return { start: customRange.value[0], end: customRange.value[1], months: Math.max(days / 30, 1), days }
    }
    if (period.value === 'all') {
      return { start: '2000-01-01', end: dayjs().format('YYYY-MM-DD'), months: 120, days: 36500 }
    }
    if (period.value === 'month') {
      const m = dayjs(selectedMonth.value)
      const days = m.daysInMonth()
      return { start: m.startOf('month').format('YYYY-MM-DD'), end: m.endOf('month').format('YYYY-MM-DD'), months: 1, days }
    }
    if (period.value === 'quarter') {
      const [y, q] = selectedQuarter.value.split('-Q')
      const qStart = dayjs(`${y}-${String((parseInt(q) - 1) * 3 + 1).padStart(2, '0')}-01`)
      const qEnd = qStart.add(2, 'month').endOf('month')
      const days = qEnd.diff(qStart.startOf('month'), 'day') + 1
      return { start: qStart.startOf('month').format('YYYY-MM-DD'), end: qEnd.format('YYYY-MM-DD'), months: 3, days }
    }
    const y = selectedYear.value || currentYear
    const start = dayjs(`${y}-01-01`)
    const end = start.endOf('year')
    const days = end.diff(start, 'day') + 1
    return { start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD'), months: 12, days }
  }

  return {
    period, grain,
    selectedYear, selectedMonth, selectedQuarter, customRange,
    availableGrains, visibleGrainOptions,
    kpiExpenseLabel, kpiIncomeLabel, periodLabel,
    validateGrain, getDateRange,
  }
}
