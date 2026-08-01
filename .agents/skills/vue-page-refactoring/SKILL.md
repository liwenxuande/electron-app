---
name: vue-page-refactoring
description: Use when a Vue page file exceeds 300 lines, contains duplicated logic across views, mixes data fetching/state/view in one file, or uses deep relative imports like '../../../stores/'. Use when organizing a Vue 3 + TypeScript project with pages that need composable extraction, component decomposition, and path alias cleanup.
---

# Vue 页面重构

## 概述

将臃肿的单文件 Vue 页面分拆为目录结构：`index.vue` 只做渲染编排，逻辑进 `composables/`，可复用 UI 进 `components/`，页面专属类型进 `types.ts`，跨页面公共函数进 `utils/`。跨目录引用统一用 `@/` 别名。

## 重构信号

以下任一情况触发重构：

- 页面 `.vue` 文件超过 **300 行**
- 同一个函数在 **2 个以上** 视图中重复定义（如 `formatAmount`、`formatDate`）
- `<script setup>` 中同时存在 `ref/reactive/computed/watch` + 数据获取 + 业务函数，无法一目了然
- 模板中有 **30 行以上** 的自包含 UI 块（表格、弹窗、卡片列表）
- import 路径出现 `'../../../'`

## 目标目录结构

```
views/XxxView/
  index.vue                  # 模板 + 胶水代码（<150 行 script）
  types.ts                   # 页面专属类型（IPC 负载、本地状态类型）
  components/                # 页面内部组件（props/emits，不依赖 store）
    FooCard.vue
    FooDialog.vue
  composables/               # 页面内部有状态逻辑
    useFooData.ts            # 数据获取 + computed
    useFooForm.ts            # 表单状态 + 提交
```

```
utils/                       # 跨页面共享纯函数
  format.ts                  # formatAmount / formatDate / …
```

## 分拆决策表

| 代码形态 | 去向 | 通信方式 |
|----------|------|---------|
| 纯工具函数（无响应式） | `utils/xxx.ts` | `import { fn } from '@/utils/xxx'` |
| 有状态逻辑（ref/watch/onMounted） | `composables/useXxx.ts` | 返回 `{ state, fn }`，调用方解构 |
| 30+ 行模板 UI 块 | `components/Xxx.vue` | `props` 入，`emits` 出 |
| 页面专属 interface/type | `types.ts` | `import type { X } from './types'` |

## 核心模式

### 1. Composable：只返回模板需要的

```ts
// 好的 — 调用方解构后模板直接使用
export function useDashboardData() {
  const monthlyStats = ref({ totalIncome: 0, totalExpense: 0 })
  const savingsRate = computed(() => { /* ... */ })
  
  async function fetchData() { /* ... */ }
  onMounted(() => { fetchData() })

  return { monthlyStats, savingsRate, fetchData }
}
```

```vue
<script setup>
const { monthlyStats, savingsRate } = useDashboardData()
</script>
<template>
  <p>¥{{ monthlyStats.totalExpense }}</p>
</template>
```

**反模式**：返回整包对象让模板写 `data.monthlyStats.value.totalExpense`（嵌套 ref 不会自动解包）。

### 2. 组件：props/emits，不碰 store

```vue
<!-- LedgerCard.vue — 纯展示 + 事件上报 -->
<script setup lang="ts">
defineProps<{ ledger: LedgerRow; stats: BookStatsEntry; iconBg: string; iconColor: string }>()
defineEmits<{ select: []; menu: [event: MouseEvent] }>()
</script>
```

**反模式**：组件内部直接 `const store = useXxxStore()` — 剥夺了复用性。

### 3. v-model:formData 优于逐字段绑定

```vue
<!-- 好 -->
<LedgerFormDialog v-model:form-data="formData" />

<!-- 差 -->
<LedgerFormDialog
  :form-name="formData.name"
  :form-description="formData.description"
  @update:form-name="formData.name = $event"
  @update:form-description="formData.description = $event"
/>
```

相应的 composable 用 `ref` 而非 `reactive`（`v-model` 会替换整个值）：

```ts
const formData = ref({ name: '', description: '' })  // ✅
const formData = reactive({ name: '', description: '' })  // ❌ — v-model 替换后会断连
```

### 4. 导入路径规范

```ts
// 跨目录（stores、components、utils）→ @/ 别名
import { useLedgerStore } from '@/stores/ledgerStore'
import BookSwitcher from '@/components/BookSwitcher.vue'
import { formatAmount } from '@/utils/format'

// 同页面目录 → 相对路径
import { useBookStats } from './composables/useBookStats'
import LedgerCard from './components/LedgerCard.vue'
```

## 实施步骤

1. **抽工具函数**：找出所有视图中重复的纯函数 → 移入 `utils/`
2. **建目录**：`mkdir -p views/XxxView/{components,composables}`
3. **抽类型**：`types.ts` — IPC 负载接口、TOOL_LABELS 等文案映射
4. **抽 composable**：数据获取 + computed + watch → `composables/useXxx.ts`
5. **抽组件**：Teleport 弹窗、列表卡片、表格 → `components/Xxx.vue`
6. **写 index.vue**：模板引用新组件 + script 解构 composable
7. **替换导入**：`../../stores/` → `@/stores/`，`./composables/` 保持不变
8. **删除旧文件**：`rm views/XxxView.vue`
9. **构建验证**：`electron-vite build`

## 常见错误

| 错误 | 修正 |
|------|------|
| `reactive()` 做 formData 配合 v-model | 改用 `ref()`，v-model 替换 `.value` 不会断连 |
| 组件里直接 import store | 改为 props 接收数据，emits 上报事件 |
| composable 返回整个对象、模板里 `.value.xxx` | 解构到顶层让 ref 自动解包 |
| IPC 监听器注册了但没在 `onUnmounted` 清理 | 用 `onMounted` 注册 + `onUnmounted` 调 `removeAllListeners` |
| 为"以后可能"拆组件 | 只在当前确实需要时拆，不做过度设计 |
| tsconfig 有 `paths` 但 vite 没配 alias（或反过来） | 两边都要配，否则要么 tsc 报错要么运行时 resolve 失败 |

## 本次会话产出示例

5 个页面全部按照上述模式完成重构：

```
views/
  AIView/                 # index.vue + types.ts + 3 组件 + 1 composable
  DashboardView/          # index.vue + 1 composable
  TransactionList/        # index.vue + 1 组件 + 2 composables
  StatisticsView/         # index.vue + 2 composables
  LedgerManager/          # index.vue + 4 组件 + 2 composables
utils/
  format.ts               # formatAmount / formatAmountInt / formatDate
```

`formatAmount` 从 4 份重复实现收拢到 1 处。路径别名从"有配置但未使用"变为全项目统一。
