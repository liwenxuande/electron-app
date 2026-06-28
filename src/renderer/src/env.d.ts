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

interface UserRow {
  id: number
  name: string
  phone: string
  address: string
  create_time: string
}

interface PaginatedResult {
  list: UserRow[]
  total: number
}

interface UserInput {
  name: string
  phone: string
  address: string
}

interface ListParams {
  searchName?: string
  page?: number
  pageSize?: number
}

interface UserAPI {
  getUserList(params: ListParams): Promise<ApiResponse<PaginatedResult>>
  getUserById(id: number): Promise<ApiResponse<UserRow>>
  createUser(data: UserInput): Promise<ApiResponse<null>>
  updateUser(id: number, data: UserInput): Promise<ApiResponse<null>>
  deleteUser(id: number): Promise<ApiResponse<null>>
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
    userAPI: UserAPI
  }
}

export {}

