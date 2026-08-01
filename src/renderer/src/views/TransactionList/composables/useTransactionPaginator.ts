/**
 * 分页器：提供 totalPages / pageNumbers / goPage，用在 TransactionList 表格底部。
 * 依赖 transactionStore.total / currentPage / pageSize / fetchList。
 */
import { computed } from 'vue'
import { useTransactionStore } from '@/stores/transactionStore'

const PAGE_WINDOW = 3

export function useTransactionPaginator() {
  const store = useTransactionStore()

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(store.total / store.pageSize))
  )

  const pageNumbers = computed(() => {
    const pages: number[] = []
    const start = Math.max(1, store.currentPage - PAGE_WINDOW)
    const end = Math.min(totalPages.value, store.currentPage + PAGE_WINDOW)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  })

  function goPage(p: number) {
    store.currentPage = p
    void store.fetchList()
  }

  return { totalPages, pageNumbers, goPage }
}
