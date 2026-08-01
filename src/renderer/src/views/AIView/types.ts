/**
 * AIView 页面专属类型声明。
 * 会话/消息的核心类型（ChatMessage、SessionItem）归属 aiSessionStore，这里只放
 * 页面 UI 层用得到、且不适合放进全局 store 的类型（IPC 事件负载、工具名文案映射等）。
 */
import type { ChatMessage } from '@/stores/aiSessionStore'

export type { ChatMessage }

/** window.aiAPI.onChatChunk 回调负载 */
export interface ChatChunkPayload {
  sessionId: string
  chunk: string
}

/** window.aiAPI.onChatDone 回调负载 */
export interface ChatDonePayload {
  sessionId: string
  result: string
}

/** window.aiAPI.onChatError 回调负载 */
export interface ChatErrorPayload {
  sessionId: string
  error: string
}

/** window.aiAPI.onToolStatus 回调负载 */
export interface ToolStatusPayload {
  sessionId: string
  toolName: string
  phase: 'start' | 'end'
}

/** 工具函数名 -> 中文展示文案 */
export const TOOL_LABELS: Record<string, string> = {
  get_current_time: '获取当前时间',
  get_monthly_summary: '查询月度收支',
  get_category_breakdown: '分析分类排行',
  get_daily_trend: '查看每日走势',
  get_top_entries: '查看交易明细',
  compare_months: '对比月度数据',
}
