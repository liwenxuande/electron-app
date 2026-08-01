/**
 * DashboardView 的数据获取与 KPI 计算逻辑。
 * 从模板中拆出，保持页面文件专注渲染。
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useTransactionStore } from '@/stores/transactionStore'
import { useLedgerStore } from '@/stores/ledgerStore'
import dayjs from 'dayjs'
import { makeIconColors } from '@/const'

const PIE_COLORS = ['#FF8C00', '#3B82F6', '#8B5CF6', '#EC4899', '#0EA5E9', '#F59E0B', '#10B981', '#6B7280']
const ICON_COLORS = makeIconColors(['#FF8C00', '#3B82F6', '#8B5CF6', '#EC4899', '#0EA5E9', '#10B981'], 0.08)

export function useDashboardData() {
  const transactionStore = useTransactionStore()
  const ledgerStore = useLedgerStore()

  const monthlyStats = ref({ totalIncome: 0, totalExpense: 0 })
  const recentTransactions = ref<TransactionRow2[]>([])
  const expensePieData = ref<{ category_name: string; total: number }[]>([])

  /** 交易图标颜色：按分类名缓存，首次访问时从调色板分配 */
  const txnIconCache = new Map<string, { bg: string; color: string }>()

  function getTxnIconBg(item: { category_name?: string }) {
    const key = item.category_name || ''
    if (!txnIconCache.has(key)) {
      txnIconCache.set(key, ICON_COLORS[txnIconCache.size % ICON_COLORS.length])
    }
    return txnIconCache.get(key)!.bg
  }

  function getTxnIconColor(item: { category_name?: string }) {
    const key = item.category_name || ''
    if (!txnIconCache.has(key)) {
      txnIconCache.set(key, ICON_COLORS[txnIconCache.size % ICON_COLORS.length])
    }
    return txnIconCache.get(key)!.color
  }

  // ---- KPI computed ----
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

  const expenseTrend = computed(() => '0.0')

  // ---- 饼图 computed ----
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

  // ---- 数据获取 ----
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

  onMounted(() => { fetchData() })
  watch(() => ledgerStore.currentId, () => { fetchData() })

  return {
    monthlyStats,
    recentTransactions,
    expensePieData,
    getTxnIconBg,
    getTxnIconColor,
    currentMonth,
    balance,
    balanceClass,
    balanceTrendText,
    balanceTrendClass,
    savingsRate,
    expenseTrend,
    expensePieDonut,
    expensePieLegend,
    fetchData,
  }
}
