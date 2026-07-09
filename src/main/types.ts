/**
 * 主进程共享类型定义
 */

/** 统一返回格式 */
export interface ApiResponse<T = unknown> {
  code: number    // 0 成功, -1 失败
  data: T
  msg: string
}
