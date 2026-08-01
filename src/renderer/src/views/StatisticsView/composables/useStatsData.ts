/**
 * 统计分析页面数据获取与 KPI 计算。
 * getDateRange 由 useStatsPeriod 提供。
 */
import { ref, reactive } from 'vue'
import { useLedgerStore } from '@/stores/ledgerStore'

export interface DateRange { start: string; end: string; months: number; days: number }

export function useStatsData() {
  const ledgerStore = useLedgerStore()

  const dailyStats = ref<any[]>([])
  const expenseCategoryStats = ref<any[]>([])
  const topExpenseList = ref<any[]>([])
  const topIncomeList = ref<any[]>([])

  const kpiData = reactive({
    avgExpense: 0,
    avgIncome: 0,
    avgDaily: 0,
    savingsRate: 0,
    transactionCount: 0,
  })

  async function fetchStats(range: DateRange) {
    try {
      const res = await window.transactionAPI.getStats(range.start, range.end, undefined, ledgerStore.currentId)
      if (res.code === 0) {
        dailyStats.value = res.data.dailyStats || []
        expenseCategoryStats.value = res.data.expenseCategoryStats || []
        const incomeStats = res.data.incomeCategoryStats || []

        const totalExpense = expenseCategoryStats.value.reduce((s, c) => s + c.total, 0)
        const totalIncome = incomeStats.reduce((s, c) => s + c.total, 0)

        kpiData.avgExpense = totalExpense
        kpiData.avgIncome = totalIncome
        kpiData.avgDaily = range.days ? totalExpense / range.days : 0
        kpiData.savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : 0
        kpiData.transactionCount = res.data.transactionCount || 0
      }
    } catch (error: unknown) {
      console.error('获取统计数据失败:', error)
    }
  }

  async function fetchTopTransactions(range: DateRange) {
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

  async function fetchAll(range: DateRange) {
    await fetchStats(range)
    await fetchTopTransactions(range)
  }

  return {
    dailyStats, expenseCategoryStats, topExpenseList, topIncomeList,
    kpiData,
    fetchStats, fetchTopTransactions, fetchAll,
  }
}
