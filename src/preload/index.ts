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
