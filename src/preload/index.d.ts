/**
 * preload API 类型声明
 */

/** 统一返回格式 */
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
    aiAPI: AIAPI
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

interface CategoryAPI {
  getCategoryList(type?: string): Promise<ApiResponse<CategoryRow[]>>
  createCategory(name: string, type: string, icon?: string, sortOrder?: number): Promise<ApiResponse<null>>
  updateCategory(id: number, name: string, icon: string, sortOrder: number): Promise<ApiResponse<null>>
  deleteCategory(id: number): Promise<ApiResponse<null>>
}

interface CategoryRow {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string
  sort_order: number
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

interface ChatHistoryRecord {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface AISessionSummary {
  sessionId: string
  title: string
  createdAt: number
  updatedAt: number
  recordCount: number
}

type AIModel = 'deepseek-v4-flash' | 'deepseek-v4-pro'

interface AIAPI {
  saveConfig(config: { key: string; model: AIModel }): Promise<ApiResponse<null>>
  getConfig(): Promise<ApiResponse<{ hasKey: boolean; model: AIModel; apiKey: string }>>
  testConnection(params?: { key?: string; model?: string }): Promise<ApiResponse<null>>
  chat(params: { messages: Array<{ role: string; content: string | null }>; ledgerId: number; sessionId?: string }): Promise<ApiResponse<{ sessionId: string }>>
  reportMonthly(params: { yearMonth: string; ledgerId: number }): Promise<ApiResponse<null>>
  reportStats(params: { statsData: Record<string, unknown>; ledgerId: number }): Promise<ApiResponse<null>>
  getHistory(params?: { sessionId?: string }): Promise<ApiResponse<ChatHistoryRecord[]>>
  clearHistory(): Promise<ApiResponse<null>>
  listSessions(): Promise<ApiResponse<AISessionSummary[]>>
  createSession(ledgerId: number): Promise<ApiResponse<{ sessionId: string }>>
  switchSession(sessionId: string): Promise<ApiResponse<{ sessionId: string }>>
  deleteSession(sessionId: string): Promise<ApiResponse<null>>
  onChatChunk(cb: (data: { sessionId: string; chunk: string }) => void): void
  onChatDone(cb: (data: { sessionId: string; result: string }) => void): void
  onChatError(cb: (data: { sessionId: string; error: string }) => void): void
  cancelChat(sessionId: string): Promise<ApiResponse<null>>
  onToolStatus(cb: (data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) => void): void
  onReportChunk(cb: (chunk: string) => void): void
  onReportDone(cb: (result: string) => void): void
  onReportError(cb: (err: string) => void): void
  removeAllListeners(): void
}
