import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import dayjs from 'dayjs'

export const useTransactionStore = defineStore('transaction', () => {
  const list = ref<TransactionRow[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const loading = ref(false)
  const monthlyStats = ref<MonthlyStats>({ totalIncome: 0, totalExpense: 0 })

  const filter = reactive({
    type: '' as '' | 'income' | 'expense',
    categoryId: undefined as number | undefined,
    ledgerId: undefined as number | undefined,
    startDate: '',
    endDate: '',
    keyword: ''
  })

  async function fetchList() {
    loading.value = true
    try {
      const res = await window.transactionAPI.getTransactionList({
        type: filter.type || undefined,
        categoryId: filter.categoryId,
        ledgerId: filter.ledgerId,
        startDate: filter.startDate || undefined,
        endDate: filter.endDate || undefined,
        keyword: filter.keyword || undefined,
        page: currentPage.value,
        pageSize: pageSize.value
      })
      if (res.code === 0) {
        list.value = res.data.list
        total.value = res.data.total
      } else {
        ElMessage.error(res.msg)
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('查询失败: ' + errMsg)
    } finally {
      loading.value = false
    }
  }

  async function createTransaction(data: {
    type: string; amount: number; categoryId: number; ledgerId: number;
    transDate: string; description?: string; paymentMethod?: string
  }): Promise<boolean> {
    try {
      const res = await window.transactionAPI.createTransaction(data)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchList()
        await fetchMonthlyStats()
        return true
      } else {
        ElMessage.error(res.msg)
        return false
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('新增失败: ' + errMsg)
      return false
    }
  }

  async function updateTransaction(id: number, data: {
    type: string; amount: number; categoryId: number; ledgerId: number;
    transDate: string; description?: string; paymentMethod?: string
  }): Promise<boolean> {
    try {
      const res = await window.transactionAPI.updateTransaction(id, data)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchList()
        await fetchMonthlyStats()
        return true
      } else {
        ElMessage.error(res.msg)
        return false
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('编辑失败: ' + errMsg)
      return false
    }
  }

  async function deleteTransaction(id: number) {
    try {
      const res = await window.transactionAPI.deleteTransaction(id)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchList()
        await fetchMonthlyStats()
      } else {
        ElMessage.error(res.msg)
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('删除失败: ' + errMsg)
    }
  }

  async function fetchMonthlyStats(yearMonth?: string) {
    const ym = yearMonth || dayjs().format('YYYY-MM')
    try {
      const res = await window.transactionAPI.getMonthlyStats(ym)
      if (res.code === 0) {
        monthlyStats.value = res.data
      }
    } catch (error: unknown) {
      console.error('获取月度统计失败:', error)
    }
  }

  async function search() {
    currentPage.value = 1
    await fetchList()
  }

  async function setLedgerId(id: number) {
    filter.ledgerId = id
    await search()
  }

  async function goPage(page: number) {
    currentPage.value = page
    await fetchList()
  }

  async function importCsv(csvText: string, ledgerId?: number): Promise<CsvImportResult | null> {
    try {
      const res = await window.transactionAPI.importCsv(csvText, ledgerId)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchList()
        await fetchMonthlyStats()
        return res.data
      } else {
        ElMessage.error(res.msg)
        return null
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('CSV导入失败: ' + errMsg)
      return null
    }
  }

  function resetFilter() {
    filter.type = ''
    filter.categoryId = undefined
    filter.ledgerId = undefined
    filter.startDate = ''
    filter.endDate = ''
    filter.keyword = ''
  }

  return {
    list,
    total,
    currentPage,
    pageSize,
    loading,
    filter,
    monthlyStats,
    fetchList,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    fetchMonthlyStats,
    search,
    setLedgerId,
    goPage,
    importCsv,
    resetFilter
  }
})
