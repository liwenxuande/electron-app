/**
 * 全局常量 — 调色板、工具函数等跨文件共用的静态数据。
 * 各页面独有的颜色排列（如 PIE_COLORS 不同排序）保留在页面内部，不在此处强行统一。
 */

/** 主调色板（12 色），按视觉权重排列 */
export const CHART_COLORS = [
  '#FF8C00', '#3B82F6', '#8B5CF6', '#F59E0B',
  '#EF4444', '#10B981', '#EC4899', '#6B7280',
  '#6366F1', '#14B8A6', '#F97316', '#06B6D4',
]

/** hex 字符串 → rgba 字符串 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 从指定 hex 数组构建 { bg, color } 对，bg 用给定 alpha 的 rgba */
export function makeIconColors(hexes: string[], alpha: number) {
  return hexes.map(c => ({ bg: hexToRgba(c, alpha), color: c }))
}
