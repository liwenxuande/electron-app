import { contextBridge, ipcRenderer } from 'electron'

/**
 * preload 预加载脚本 —— 安全桥接层
 * 通过 contextBridge 向渲染进程暴露有限的安全API
 * 渲染进程只能通过 window.userAPI 调用，无法直接访问 Node.js / SQLite
 */

contextBridge.exposeInMainWorld('userAPI', {
  /** 分页查询用户列表（含模糊搜索） */
  getUserList: (params: { searchName?: string; page?: number; pageSize?: number }) => {
    return ipcRenderer.invoke('user:list', params)
  },

  /** 根据ID查询单条用户 */
  getUserById: (id: number) => {
    return ipcRenderer.invoke('user:getById', id)
  },

  /** 新增用户 */
  createUser: (data: { name: string; phone: string; address: string }) => {
    return ipcRenderer.invoke('user:create', data)
  },

  /** 编辑用户（传入ID和新数据） */
  updateUser: (id: number, data: { name: string; phone: string; address: string }) => {
    return ipcRenderer.invoke('user:update', id, data)
  },

  /** 删除用户 */
  deleteUser: (id: number) => {
    return ipcRenderer.invoke('user:delete', id)
  },

  /** 发送系统通知 */
  showNotification: (title: string, body: string) => {
    return ipcRenderer.invoke('notification:show', title, body)
  }
})
