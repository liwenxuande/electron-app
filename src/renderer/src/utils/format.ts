/**
 * 全局共享的格式化工具函数。
 * 各视图此前各自实现了一份 formatAmount/formatDate，行为略有出入，这里统一收拢。
 */

/** 金额格式化为两位小数字符串，如需展示绝对值请自行 Math.abs() 后传入 */
export function formatAmount(val: number): string {
  return val.toFixed(2)
}

/** 金额四舍五入为整数并加千分位分隔符，用于空间有限的展示场景（如图表中心文字） */
export function formatAmountInt(val: number): string {
  return Math.round(val).toLocaleString()
}

/** 日期字符串（YYYY-MM-DD）截断为 MM-DD，用于列表中紧凑展示 */
export function formatDate(d: string): string {
  return d ? d.substring(5) : ''
}
