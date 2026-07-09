/// <reference types="vite/client" />

/** 声明 .vue 单文件组件模块 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/** ===== preload 桥接 API 类型 ===== */

interface ApiResponse<T = any> {
  code: number
  data: T
  msg: string
}

interface ElectronAPI {
  showNotification(title: string, body: string): Promise<ApiResponse<null>>
  minimize(): Promise<void>
  maximize(): Promise<void>
  close(): Promise<void>
  isMaximized(): Promise<boolean>
  onMaximizeChange(callback: (isMaximized: boolean) => void): void
  toggleDevTools(): Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
    categoryAPI: CategoryAPI
    transactionAPI: TransactionAPI
    ledgerAPI: LedgerAPI
  }
}

interface LedgerAPI {
  getLedgerList(): Promise<ApiResponse<LedgerRow[]>>
  createLedger(name: string, description?: string): Promise<ApiResponse<null>>
  updateLedger(id: number, name: string, description: string): Promise<ApiResponse<null>>
  deleteLedger(id: number): Promise<ApiResponse<null>>
}

interface LedgerRow {
  id: number
  name: string
  description: string
  create_time: string
}

interface CategoryRow {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string
  sort_order: number
}

interface CategoryAPI {
  getCategoryList(type?: string): Promise<ApiResponse<CategoryRow[]>>
  createCategory(name: string, type: string, icon?: string, sortOrder?: number): Promise<ApiResponse<null>>
  updateCategory(id: number, name: string, icon: string, sortOrder: number): Promise<ApiResponse<null>>
  deleteCategory(id: number): Promise<ApiResponse<null>>
}

interface TransactionRow2 {
  id: number
  type: 'income' | 'expense'
  amount: number
  category_id: number
  category_name?: string
  ledger_id: number
  ledger_name?: string
  trans_date: string
  description: string
  payment_method: string
  create_time: string
  update_time: string
}

interface PaginatedTransactions {
  list: TransactionRow2[]
  total: number
}

interface MonthlyStats {
  totalIncome: number
  totalExpense: number
}

interface CsvImportResult {
  successCount: number
  failCount: number
  skipCount: number
  errors: string[]
}

interface DailyStat {
  date: string
  income: number
  expense: number
}

interface CategoryStat {
  category_id: number
  category_name: string
  type: string
  total: number
}

interface StatsData {
  dailyStats: DailyStat[]
  expenseCategoryStats: CategoryStat[]
  incomeCategoryStats: CategoryStat[]
}

interface TransactionAPI {
  getTransactionList(params: Record<string, unknown>): Promise<ApiResponse<PaginatedTransactions>>
  getTransactionById(id: number): Promise<ApiResponse<TransactionRow2>>
  createTransaction(data: Record<string, unknown>): Promise<ApiResponse<null>>
  updateTransaction(id: number, data: Record<string, unknown>): Promise<ApiResponse<null>>
  deleteTransaction(id: number): Promise<ApiResponse<null>>
  getMonthlyStats(yearMonth: string): Promise<ApiResponse<MonthlyStats>>
  getStats(startDate: string, endDate: string, categoryId?: number, ledgerId?: number, keyword?: string): Promise<ApiResponse<StatsData>>
  importCsv(csvText: string, ledgerId?: number): Promise<ApiResponse<CsvImportResult>>
}

export {}

