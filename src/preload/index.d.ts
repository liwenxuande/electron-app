/**
 * preload API 类型声明
 * 渲染进程通过 window.userAPI 调用这些方法
 */

/** 统一返回格式 */
interface ApiResponse<T = any> {
  code: number
  data: T
  msg: string
}

/** 用户数据行 */
interface UserRow {
  id: number
  name: string
  phone: string
  address: string
  create_time: string
}

/** 分页查询结果 */
interface PaginatedResult {
  list: UserRow[]
  total: number
}

/** 用户输入数据 */
interface UserInput {
  name: string
  phone: string
  address: string
}

/** 列表查询参数 */
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
}

declare global {
  interface Window {
    /** 安全的用户管理API桥接对象 */
    userAPI: UserAPI
  }
}
