import * as electron from 'electron'
const { contextBridge, ipcRenderer } = electron

/**
 * preload 预加载脚本 —— 安全桥接层
 * 通过 contextBridge 向渲染进程暴露有限的安全API
 */

contextBridge.exposeInMainWorld('electronAPI', {
  /** 发送系统通知 */
  showNotification: (title: string, body: string) => {
    return ipcRenderer.invoke('notification:show', title, body)
  },

  /** 窗口最小化 */
  minimize: () => ipcRenderer.invoke('window:minimize'),

  /** 窗口最大化/还原 */
  maximize: () => ipcRenderer.invoke('window:maximize'),

  /** 关闭窗口 */
  close: () => ipcRenderer.invoke('window:close'),

  /** 查询是否最大化 */
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  /** 监听最大化状态变化 */
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    ipcRenderer.on('window:maximizeChange', (_event, state) => callback(state))
  },

  /** 切换开发者工具 */
  toggleDevTools: () => ipcRenderer.invoke('window:toggleDevTools')
})

contextBridge.exposeInMainWorld('categoryAPI', {
  /** 查询分类列表（可选筛选类型） */
  getCategoryList: (type?: string) => {
    return ipcRenderer.invoke('category:list', type)
  },

  /** 新增分类 */
  createCategory: (name: string, type: string, icon?: string, sortOrder?: number) => {
    return ipcRenderer.invoke('category:create', name, type, icon, sortOrder)
  },

  /** 编辑分类 */
  updateCategory: (id: number, name: string, icon: string, sortOrder: number) => {
    return ipcRenderer.invoke('category:update', id, name, icon, sortOrder)
  },

  /** 删除分类 */
  deleteCategory: (id: number) => {
    return ipcRenderer.invoke('category:delete', id)
  }
})

contextBridge.exposeInMainWorld('transactionAPI', {
  /** 分页查询交易列表 */
  getTransactionList: (params: Record<string, unknown>) => {
    return ipcRenderer.invoke('transaction:list', params)
  },

  /** 根据ID查询 */
  getTransactionById: (id: number) => {
    return ipcRenderer.invoke('transaction:getById', id)
  },

  /** 新增交易 */
  createTransaction: (data: Record<string, unknown>) => {
    return ipcRenderer.invoke('transaction:create', data)
  },

  /** 编辑交易 */
  updateTransaction: (id: number, data: Record<string, unknown>) => {
    return ipcRenderer.invoke('transaction:update', id, data)
  },

  /** 删除交易 */
  deleteTransaction: (id: number) => {
    return ipcRenderer.invoke('transaction:delete', id)
  },

  /** 查询月度统计 */
  getMonthlyStats: (yearMonth: string) => {
    return ipcRenderer.invoke('transaction:monthlyStats', yearMonth)
  },

  /** 查询时间段统计数据（每日折线图 + 分类占比） */
  getStats: (startDate: string, endDate: string, categoryId?: number, ledgerId?: number, keyword?: string) => {
    return ipcRenderer.invoke('transaction:stats', startDate, endDate, categoryId, ledgerId, keyword)
  },

  /** CSV导入 */
  importCsv: (csvText: string, ledgerId?: number) => {
    return ipcRenderer.invoke('transaction:importCsv', csvText, ledgerId)
  },

  /** 查询单笔排行（收入/支出各 top 10） */
  getTopTransactions: (startDate: string, endDate: string, ledgerId?: number) => {
    return ipcRenderer.invoke('transaction:topTransactions', startDate, endDate, ledgerId)
  }
})

contextBridge.exposeInMainWorld('ledgerAPI', {
  /** 查询账本列表 */
  getLedgerList: () => {
    return ipcRenderer.invoke('ledger:list')
  },

  /** 新增账本 */
  createLedger: (name: string, description?: string) => {
    return ipcRenderer.invoke('ledger:create', name, description)
  },

  /** 编辑账本 */
  updateLedger: (id: number, name: string, description: string) => {
    return ipcRenderer.invoke('ledger:update', id, name, description)
  },

  /** 删除账本 */
  deleteLedger: (id: number) => {
    return ipcRenderer.invoke('ledger:delete', id)
  }
})

contextBridge.exposeInMainWorld('aiAPI', {
  saveConfig: (config: { key: string; model: string }) =>
    ipcRenderer.invoke('ai:config:save', config),
  getConfig: () =>
    ipcRenderer.invoke('ai:config:get'),
  testConnection: (params?: { key?: string; model?: string }) =>
    ipcRenderer.invoke('ai:config:test', params ?? {}),

  chat: (params: { messages: Array<{ role: string; content: string | null }>; ledgerId: number; sessionId?: string }) =>
    ipcRenderer.invoke('ai:chat', params),
  cancelChat: (sessionId: string) =>
    ipcRenderer.invoke('ai:chat:cancel', sessionId),
  reportMonthly: (params: { yearMonth: string; ledgerId: number }) =>
    ipcRenderer.invoke('ai:report:monthly', params),
  reportStats: (params: { statsData: Record<string, unknown>; ledgerId: number }) =>
    ipcRenderer.invoke('ai:report:stats', params),

  getHistory: (params?: { sessionId?: string }) => ipcRenderer.invoke('ai:chat:history', params ?? {}),
  clearHistory: () => ipcRenderer.invoke('ai:chat:clear'),

  listSessions: () => ipcRenderer.invoke('ai:session:list'),
  createSession: (ledgerId: number) => ipcRenderer.invoke('ai:session:create', { ledgerId }),
  switchSession: (sessionId: string) => ipcRenderer.invoke('ai:session:switch', { sessionId }),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('ai:session:delete', { sessionId }),

  onChatChunk: (cb: (data: { sessionId: string; chunk: string }) => void) => {
    ipcRenderer.on('ai:chat:chunk', (_event, data: { sessionId: string; chunk: string }) => cb(data))
  },
  onChatDone: (cb: (data: { sessionId: string; result: string }) => void) => {
    ipcRenderer.on('ai:chat:done', (_event, data: { sessionId: string; result: string }) => cb(data))
  },
  onChatError: (cb: (data: { sessionId: string; error: string }) => void) => {
    ipcRenderer.on('ai:chat:error', (_event, data: { sessionId: string; error: string }) => cb(data))
  },
  onToolStatus: (cb: (data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) => void) => {
    ipcRenderer.on('ai:chat:tool-status', (_event, data: { sessionId: string; toolName: string; phase: 'start' | 'end' }) => cb(data))
  },
  onReportChunk: (cb: (chunk: string) => void) => {
    ipcRenderer.on('ai:report:chunk', (_event, chunk: string) => cb(chunk))
  },
  onReportDone: (cb: (result: string) => void) => {
    ipcRenderer.on('ai:report:done', (_event, result: string) => cb(result))
  },
  onReportError: (cb: (err: string) => void) => {
    ipcRenderer.on('ai:report:error', (_event, err: string) => cb(err))
  },
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('ai:chat:chunk')
    ipcRenderer.removeAllListeners('ai:chat:done')
    ipcRenderer.removeAllListeners('ai:chat:error')
    ipcRenderer.removeAllListeners('ai:report:chunk')
    ipcRenderer.removeAllListeners('ai:report:done')
    ipcRenderer.removeAllListeners('ai:report:error')
    ipcRenderer.removeAllListeners('ai:chat:tool-status')
  },
})
