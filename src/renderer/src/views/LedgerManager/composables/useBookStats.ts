/**
 * 账本统计信息获取与缓存。
 * 为每个账本查询本月流水笔数和支出总额，按 ledgerId 缓存。
 */
import { ref } from 'vue'
import dayjs from 'dayjs'

export interface BookStatsEntry { count: number; monthlyExpense: number }

export function useBookStats() {
  const statsCache = ref<Record<number, BookStatsEntry>>({})

  async function fetchBookStats(ledgerId: number) {
    try {
      const yearMonth = dayjs().format('YYYY-MM')
      const res = await window.transactionAPI.getTransactionList({
        page: 1, pageSize: 9999, ledgerId
      })
      const count = res.code === 0 ? res.data.total : 0

      const statsRes = await window.transactionAPI.getStats(
        `${yearMonth}-01`,
        dayjs().endOf('month').format('YYYY-MM-DD'),
        undefined,
        ledgerId
      )
      const monthlyExpense = statsRes.code === 0
        ? (statsRes.data.expenseCategoryStats || []).reduce((s: number, c: any) => s + c.total, 0)
        : 0

      statsCache.value = { ...statsCache.value, [ledgerId]: { count, monthlyExpense } }
    } catch {
      statsCache.value = { ...statsCache.value, [ledgerId]: { count: 0, monthlyExpense: 0 } }
    }
  }

  function getBookStats(ledgerId: number): BookStatsEntry {
    return statsCache.value[ledgerId] || { count: 0, monthlyExpense: 0 }
  }

  return { statsCache, fetchBookStats, getBookStats }
}
