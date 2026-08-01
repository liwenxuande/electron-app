/**
 * 分类颜色分配逻辑。
 * 从调色板中按首次遇到顺序为每个分类名分配唯一颜色并缓存。
 * 模板中通过 getCatColor/getCatBg 为行级标签做内联样式着色。
 */
import { CHART_COLORS, hexToRgba } from '@/const'

export function useCategoryColors() {
  const cache = new Map<string, { bg: string; color: string }>()

  function getColor(name: string): string {
    if (!cache.has(name)) {
      cache.set(name, {
        bg: hexToRgba(CHART_COLORS[cache.size % CHART_COLORS.length], 0.08),
        color: CHART_COLORS[cache.size % CHART_COLORS.length],
      })
    }
    return cache.get(name)!.color
  }

  function getBg(name: string): string {
    if (!cache.has(name)) {
      getColor(name) // 触发首次分配
    }
    return cache.get(name)!.bg
  }

  return { getCatColor: getColor, getCatBg: getBg, cache }
}
