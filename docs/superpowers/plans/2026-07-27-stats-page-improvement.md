# 统计分析页面改进 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 重构统计分析页面：换用 Element Plus 日期选择器、粒度联动、新增笔数 KPI、单笔排行、分类明细弹框

**架构：** 分层修改 —— Repository 层扩展 SQL 返回新字段 → Service 层透传 → Controller+Preload 暴露 API → 前端新增 QuarterPicker/CategoryDetailDialog 组件 → StatisticsView 重构 UI

**技术栈：** Electron + Vue 3 + Pinia + Element Plus + ECharts + better-sqlite3 + TypeScript

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `src/main/repository/transactionRepository.ts` | SQL 层：CategoryStat 加 count、新增 getTransactionCount、getTopTransactions |
| `src/main/service/transactionService.ts` | 业务层：getStats 加 transactionCount、新增 getTopTransactions |
| `src/main/controller/transactionController.ts` | IPC 路由：新增 transaction:topTransactions |
| `src/preload/index.ts` | 安全桥接：暴露 getTopTransactions |
| `src/preload/index.d.ts` | 类型声明：TopTransactionData、getTopTransactions |
| `src/renderer/src/env.d.ts` | 渲染进程类型：CategoryStat.count、StatsData.transactionCount、TopTransactionData |
| `src/renderer/src/components/QuarterPicker.vue` | 新增：季度选择器组件 |
| `src/renderer/src/components/CategoryDetailDialog.vue` | 新增：分类明细弹框组件 |
| `src/renderer/src/views/StatisticsView.vue` | 主要改造：选择器、粒度联动、KPI、排行区、弹框集成 |

---

### 任务 1：后端 — CategoryStat 加 count 字段 + 总笔数

**文件：**
- 修改：`src/main/repository/transactionRepository.ts:44-49,202-230`
- 修改：`src/main/service/transactionService.ts:181-196`

- [ ] **步骤 1：CategoryStat 接口加 count 字段**

```ts
// transactionRepository.ts
export interface CategoryStat {
  category_id: number
  category_name: string
  type: string
  total: number
  count: number  // 新增
}
```

- [ ] **步骤 2：getCategoryStats SQL 加 COUNT(*)**

```ts
// transactionRepository.ts 第221-229行，替换 SQL
return this.dbManager.all<CategoryStat>(
  `SELECT t.category_id, c.name as category_name, t.type,
          SUM(t.amount) as total,
          COUNT(*) as count
   FROM transactions t
   LEFT JOIN category c ON t.category_id = c.id
   ${whereClause}
   GROUP BY t.category_id
   ORDER BY total DESC`,
  params
)
```

- [ ] **步骤 3：新增 getTransactionCount 方法**

在 `transactionRepository.ts` 的 `getCategoryStats` 方法后面添加：

```ts
getTransactionCount(filter: StatsFilter): number {
  const conditions: string[] = ['trans_date >= ?', 'trans_date <= ?']
  const params: any[] = [filter.startDate, filter.endDate]

  if (filter.categoryId) {
    conditions.push('category_id = ?')
    params.push(filter.categoryId)
  }
  if (filter.ledgerId) {
    conditions.push('ledger_id = ?')
    params.push(filter.ledgerId)
  }
  if (filter.keyword) {
    conditions.push('description LIKE ?')
    params.push(`%${filter.keyword}%`)
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ')
  const row = this.dbManager.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM transactions ${whereClause}`,
    params
  )
  return row ? row.count : 0
}
```

- [ ] **步骤 4：Service 层 getStats 加 transactionCount**

```ts
// transactionService.ts 第181-196行，替换 getStats 方法
getStats(startDate: string, endDate: string, categoryId?: number, ledgerId?: number, keyword?: string): ApiResponse {
  try {
    if (!startDate || !endDate) {
      return this.fail('请选择起止日期')
    }
    const filter = { startDate, endDate, categoryId, ledgerId, keyword }
    const dailyStats = this.repository.getDailyStats(filter)
    const expenseCategoryStats = this.repository.getCategoryStats(filter, 'expense')
    const incomeCategoryStats = this.repository.getCategoryStats(filter, 'income')
    const transactionCount = this.repository.getTransactionCount(filter)
    return this.success({ dailyStats, expenseCategoryStats, incomeCategoryStats, transactionCount }, '查询成功')
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    logger.error(`查询统计数据失败: ${errMsg}`)
    return this.fail(`查询失败: ${errMsg}`)
  }
}
```

- [ ] **步骤 5：Commit**

```bash
git add src/main/repository/transactionRepository.ts src/main/service/transactionService.ts
git commit -m "feat: 统计接口增强 — CategoryStat 加笔数、StatsData 加 transactionCount"
```

---

### 任务 2：后端 — 新增 getTopTransactions 接口

**文件：**
- 修改：`src/main/repository/transactionRepository.ts`
- 修改：`src/main/service/transactionService.ts`

- [ ] **步骤 1：Repository 新增 getTopTransactions 方法**

在 `transactionRepository.ts` 的 `getTransactionCount` 方法后面添加：

```ts
getTopTransactions(filter: StatsFilter, type: 'income' | 'expense', limit: number = 10): TransactionRow[] {
  const conditions: string[] = ['t.trans_date >= ?', 't.trans_date <= ?', 't.type = ?']
  const params: any[] = [filter.startDate, filter.endDate, type]

  if (filter.ledgerId) {
    conditions.push('t.ledger_id = ?')
    params.push(filter.ledgerId)
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ')

  return this.dbManager.all<TransactionRow>(
    `SELECT t.*, c.name as category_name, l.name as ledger_name
     FROM transactions t
     LEFT JOIN category c ON t.category_id = c.id
     LEFT JOIN ledger l ON t.ledger_id = l.id
     ${whereClause}
     ORDER BY t.amount DESC
     LIMIT ?`,
    [...params, limit]
  )
}
```

- [ ] **步骤 2：Service 新增 getTopTransactions**

在 `transactionService.ts` 的 `getStats` 方法后面添加：

```ts
getTopTransactions(startDate: string, endDate: string, ledgerId?: number): ApiResponse {
  try {
    if (!startDate || !endDate) {
      return this.fail('请选择起止日期')
    }
    const filter = { startDate, endDate, ledgerId }
    const expenseTop = this.repository.getTopTransactions(filter, 'expense', 10)
    const incomeTop = this.repository.getTopTransactions(filter, 'income', 10)
    return this.success({ expenseTop, incomeTop }, '查询成功')
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    logger.error(`查询单笔排行失败: ${errMsg}`)
    return this.fail(`查询失败: ${errMsg}`)
  }
}
```

- [ ] **步骤 3：Commit**

```bash
git add src/main/repository/transactionRepository.ts src/main/service/transactionService.ts
git commit -m "feat: 新增 getTopTransactions — 支持支出/收入 top N 单笔排行查询"
```

---

### 任务 3：Controller + Preload — 暴露新接口

**文件：**
- 修改：`src/main/controller/transactionController.ts`
- 修改：`src/preload/index.ts`
- 修改：`src/preload/index.d.ts`
- 修改：`src/renderer/src/env.d.ts`

- [ ] **步骤 1：Controller 加 IPC handler**

在 `transactionController.ts` 的 `transaction:importCsv` 之后、`logger.info('Transaction IPC控制器注册完成')` 之前添加：

```ts
ipcMain.handle('transaction:topTransactions', async (_event, startDate: string, endDate: string, ledgerId?: number) => {
  try {
    logger.info(`[IPC] transaction:topTransactions 收到请求: ${startDate} ~ ${endDate}, ledgerId=${ledgerId}`)
    return service.getTopTransactions(startDate, endDate, ledgerId)
  } catch (error: any) {
    logger.error(`[IPC] transaction:topTransactions 异常: ${error.message}`)
    return { code: -1, data: null, msg: `系统异常: ${error.message}` }
  }
})
```

- [ ] **步骤 2：Preload index.ts 暴露 API**

在 `preload/index.ts` 的 `importCsv` 之后添加：

```ts
/** 查询单笔排行（收入/支出各 top 10） */
getTopTransactions: (startDate: string, endDate: string, ledgerId?: number) => {
  return ipcRenderer.invoke('transaction:topTransactions', startDate, endDate, ledgerId)
}
```

- [ ] **步骤 3：类型声明更新**

`preload/index.d.ts` — 在 `TransactionAPI` 接口中 `importCsv` 之后添加：

```ts
  getTopTransactions(startDate: string, endDate: string, ledgerId?: number): Promise<ApiResponse<TopTransactionData>>
```

在 `StatsData` 之前新增：

```ts
interface TopTransactionData {
  expenseTop: TransactionRow2[]
  incomeTop: TransactionRow2[]
}
```

`src/renderer/src/env.d.ts` 同步做相同修改：

- `CategoryStat` 加 `count: number`
- `StatsData` 加 `transactionCount: number`
- 新增 `TopTransactionData`
- `TransactionAPI` 加 `getTopTransactions`

- [ ] **步骤 4：Commit**

```bash
git add src/main/controller/transactionController.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/env.d.ts
git commit -m "feat: 暴露 getTopTransactions API — IPC 路由 + preload 桥接 + 类型声明"
```

---

### 任务 4：前端 — QuarterPicker 组件

**文件：**
- 创建：`src/renderer/src/components/QuarterPicker.vue`

- [ ] **步骤 1：创建 QuarterPicker.vue**

```vue
<template>
  <div class="quarter-picker">
    <button class="qp-arrow" @click="prevYear">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
    </button>
    <span class="qp-year">{{ modelYear }}</span>
    <button class="qp-arrow" @click="nextYear">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <div class="qp-quarters">
      <button
        v-for="(label, idx) in ['一季度','二季度','三季度','四季度']"
        :key="idx"
        :class="['qp-quarter-btn', { active: modelQuarter === idx + 1 }]"
        @click="selectQuarter(idx + 1)"
      >{{ label }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'change'): void }>()

const now = dayjs()
const year = ref(props.modelValue ? parseInt(props.modelValue.split('-Q')[0]) : now.year())
const quarter = ref(props.modelValue ? parseInt(props.modelValue.split('-Q')[1]) : Math.ceil((now.month() + 1) / 3))

const modelYear = computed(() => year.value)

watch(() => props.modelValue, (val) => {
  if (val) {
    year.value = parseInt(val.split('-Q')[0])
    quarter.value = parseInt(val.split('-Q')[1])
  }
})

function sync() {
  const val = `${year.value}-Q${quarter.value}`
  emit('update:modelValue', val)
  emit('change')
}

function selectQuarter(q: number) {
  quarter.value = q
  sync()
}

function prevYear() {
  year.value--
  sync()
}

function nextYear() {
  year.value++
  sync()
}
</script>

<style scoped>
.quarter-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 8px;
  padding: 4px 8px;
}
.qp-arrow {
  width: 24px; height: 24px;
  border-radius: 4px; border: none;
  background: transparent; cursor: pointer;
  color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
}
.qp-arrow:hover { background: #FFF5E6; color: #FF8C00; }
.qp-year {
  font-size: 0.8125rem; font-weight: 600; color: #1A1A2E;
  min-width: 48px; text-align: center;
}
.qp-quarters { display: flex; gap: 2px; }
.qp-quarter-btn {
  padding: 6px 10px; border-radius: 4px;
  font-size: 0.75rem; font-weight: 500;
  color: #9CA3AF; border: none;
  background: transparent; cursor: pointer;
  font-family: inherit; white-space: nowrap;
}
.qp-quarter-btn:hover { background: #FFF5E6; color: #FF8C00; }
.qp-quarter-btn.active { background: #FF8C00; color: #fff; }
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/renderer/src/components/QuarterPicker.vue
git commit -m "feat: 新增 QuarterPicker 季度选择器组件"
```

---

### 任务 5：前端 — CategoryDetailDialog 组件

**文件：**
- 创建：`src/renderer/src/components/CategoryDetailDialog.vue`

- [ ] **步骤 1：创建 CategoryDetailDialog.vue**

```vue
<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-backdrop"></div>
        <div class="modal-panel" style="width:560px">
          <div class="modal-header">
            <h3 class="modal-title">{{ categoryName }} 账单明细</h3>
            <button class="modal-close" @click="handleClose">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body" :class="{ 'cdd-scroll': list.length > 15 }">
            <table class="cdd-table" v-if="list.length > 0">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>金额</th>
                  <th>描述</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in list" :key="item.id">
                  <td>{{ item.trans_date }}</td>
                  <td :class="item.type === 'income' ? 'cdd-income' : 'cdd-expense'">¥{{ item.amount.toFixed(2) }}</td>
                  <td>{{ item.description || '-' }}</td>
                  <td>{{ item.note || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <el-empty v-else description="暂无数据" :image-size="60" />
          </div>

          <div class="modal-footer cdd-footer">
            <span class="cdd-summary">共 {{ list.length }} 笔，合计 ¥{{ totalAmount.toFixed(2) }}</span>
            <button class="cdd-btn-close" @click="handleClose">关闭</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface DetailItem {
  id: number
  type: string
  amount: number
  trans_date: string
  description: string
  note?: string
}

const props = defineProps<{
  visible: boolean
  categoryName: string
  categoryId: number
  startDate: string
  endDate: string
}>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const list = ref<DetailItem[]>([])
const loading = ref(false)

const totalAmount = computed(() => list.value.reduce((s, i) => s + i.amount, 0))

watch(() => props.visible, async (val) => {
  if (val) {
    await fetchDetail()
  }
})

async function fetchDetail() {
  loading.value = true
  try {
    const res = await window.transactionAPI.getTransactionList({
      categoryId: props.categoryId,
      startDate: props.startDate,
      endDate: props.endDate,
      page: 1,
      pageSize: 1000
    })
    if (res.code === 0) {
      list.value = res.data.list
    }
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000; display: flex;
  align-items: center; justify-content: center;
}
.modal-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
}
.modal-panel {
  position: relative; background: #fff;
  border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  overflow: hidden; max-height: 85vh; display: flex; flex-direction: column;
}
.modal-header {
  padding: 20px 24px 14px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid #F0F2F5;
}
.modal-title {
  font-size: 0.9375rem; font-weight: 600; color: #1A1A2E;
}
.modal-close {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
}
.modal-close:hover { background: #F5F7FA; color: #6B7280; }
.modal-body {
  padding: 16px 24px; overflow-y: auto; flex: 1;
}
.cdd-scroll { max-height: 420px; }
.cdd-table { width: 100%; border-collapse: collapse; }
.cdd-table th {
  text-align: left; font-size: 0.75rem; font-weight: 500; color: #9CA3AF;
  padding: 8px 12px; border-bottom: 1px solid #F0F2F5;
}
.cdd-table td {
  padding: 10px 12px; font-size: 0.8125rem; color: #1A1A2E;
  border-bottom: 1px solid #F5F7FA;
}
.cdd-table tbody tr:hover { background: #FAFBFC; }
.cdd-income { color: #10B981; font-weight: 600; font-variant-numeric: tabular-nums; }
.cdd-expense { color: #FF8C00; font-weight: 600; font-variant-numeric: tabular-nums; }
.cdd-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px 20px; border-top: 1px solid #F0F2F5;
}
.cdd-summary { font-size: 0.8125rem; color: #6B7280; }
.cdd-btn-close {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; font-family: inherit; border: 1px solid rgba(235,238,242,0.7);
  background: transparent; color: #6B7280; transition: all 0.15s;
}
.cdd-btn-close:hover { border-color: #FFAD42; color: #FF8C00; }
.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/renderer/src/components/CategoryDetailDialog.vue
git commit -m "feat: 新增 CategoryDetailDialog 分类账单明细弹框"
```

---

### 任务 6：StatisticsView — 周期选择器改造 + 颗粒度联动

**文件：**
- 修改：`src/renderer/src/views/StatisticsView.vue`

- [ ] **步骤 1：模板 — 替换周期选择器区域**

替换 `<template>` 中 `.stats-header-right` 内的周期选择控件（原第 9-57 行）：

```vue
<div class="stats-header-right">
  <div class="stats-period-toggle">
    <button
      v-for="p in periods"
      :key="p.key"
      class="stats-period-btn"
      :class="{ active: period === p.key }"
      @click="setPeriod(p.key)"
    >{{ p.label }}</button>
  </div>
  <el-date-picker
    v-if="period === 'month'"
    v-model="selectedMonth"
    type="month"
    placeholder="选择月份"
    format="YYYY-MM"
    value-format="YYYY-MM"
    size="small"
    class="stats-period-select"
    @change="fetchStats"
  />
  <el-date-picker
    v-if="period === 'year'"
    v-model="selectedYear"
    type="year"
    placeholder="选择年份"
    format="YYYY"
    value-format="YYYY"
    size="small"
    class="stats-period-select"
    @change="fetchStats"
  />
  <QuarterPicker
    v-if="period === 'quarter'"
    v-model="selectedQuarter"
    class="stats-period-select"
    @change="fetchStats"
  />
  <el-date-picker
    v-if="period === 'custom'"
    v-model="customRange"
    type="daterange"
    range-separator="至"
    start-placeholder="开始"
    end-placeholder="结束"
    format="YYYY-MM-DD"
    value-format="YYYY-MM-DD"
    size="small"
    class="stats-period-select"
    @change="onCustomRangeChange"
  />
</div>
```

- [ ] **步骤 2：脚本 — 导入 QuarterPicker + 修改变量/逻辑**

a) 在 `<script>` 顶部添加导入：

```ts
import QuarterPicker from '../components/QuarterPicker.vue'
```

b) 修改默认周期从 `'quarter'` 改为 `'month'`（第200行），默认月份为当前月：

```ts
const period = ref<'all' | 'month' | 'quarter' | 'year' | 'custom'>('month')
```

c) 删除不再需要的 `yearOptions`、`monthOptions`、`quarterOptions` computed（第233-249行）

d) `selectedYear` 改为 `number | null` 类型配合 `el-date-picker type="year"`：

```ts
const selectedYear = ref<number | null>(currentYear)
```

e) 删除 `selectedMonth` 和 `selectedQuarter` 的旧 watch：

移除第455行：`watch(selectedYear, () => { fetchStats() })`

- [ ] **步骤 3：脚本 — 颗粒度动态限制逻辑**

替换 `defaultGrainMap` 和 `availableGrains` computed：

```ts
const availableGrains = computed<Grain[]>(() => {
  if (period.value === 'month') return ['day']
  if (period.value === 'quarter') return ['day', 'month']
  if (period.value === 'all') return ['day', 'month', 'quarter']
  if (period.value === 'custom' && customRange.value) {
    const days = dayjs(customRange.value[1]).diff(dayjs(customRange.value[0]), 'day') + 1
    if (days <= 31) return ['day']
    if (days <= 366) return ['day', 'month']
    return ['day', 'month', 'quarter']
  }
  return ['day', 'month', 'quarter']
})

const visibleGrainOptions = computed(() => {
  return grainOptions.filter(g => availableGrains.value.includes(g.key))
})

function validateGrain() {
  if (!availableGrains.value.includes(grain.value)) {
    grain.value = availableGrains.value[0]
  }
}
```

在 `watch(period, ...)` 中调用 `validateGrain()`：

```ts
watch(period, () => {
  validateGrain()
  fetchStats()
})
```

在 `onCustomRangeChange` 中调用：

```ts
function onCustomRangeChange() {
  if (customRange.value && customRange.value.length === 2) {
    validateGrain()
    fetchStats()
  }
}
```

- [ ] **步骤 4：模板 — 颗粒度按钮改为动态渲染**

替换现有的颗粒度按钮（第111-116行），用 `visibleGrainOptions` 渲染：

```vue
<div class="stats-gran-toggle">
  <button
    v-for="g in visibleGrainOptions"
    :key="g.key"
    class="stats-gran-btn"
    :class="{ active: grain === g.key }"
    @click="setGrain(g.key)"
  >{{ g.label }}</button>
</div>
```

- [ ] **步骤 5：脚本 — 修复 getDateRange 配合 el-date-picker**

修改 `getDateRange` 函数中对 `selectedYear` 的处理（第489行）。`el-date-picker type="year"` 返回 `number` 类型：

```ts
function getDateRange() {
  if (period.value === 'custom' && customRange.value) {
    const days = dayjs(customRange.value[1]).diff(dayjs(customRange.value[0]), 'day') + 1
    const months = Math.max(days / 30, 1)
    return { start: customRange.value[0], end: customRange.value[1], months }
  }
  if (period.value === 'all') {
    return { start: '2000-01-01', end: dayjs().format('YYYY-MM-DD'), months: 120 }
  }
  if (period.value === 'month') {
    const m = dayjs(selectedMonth.value)
    return { start: m.startOf('month').format('YYYY-MM-DD'), end: m.endOf('month').format('YYYY-MM-DD'), months: 1 }
  }
  if (period.value === 'quarter') {
    const [y, q] = selectedQuarter.value.split('-Q')
    const qStart = dayjs(`${y}-${String((parseInt(q) - 1) * 3 + 1).padStart(2, '0')}-01`)
    return { start: qStart.startOf('month').format('YYYY-MM-DD'), end: qStart.add(2, 'month').endOf('month').format('YYYY-MM-DD'), months: 3 }
  }
  const y = selectedYear.value || currentYear
  const start = dayjs(`${y}-01-01`)
  return { start: start.format('YYYY-MM-DD'), end: start.endOf('year').format('YYYY-MM-DD'), months: 12 }
}
```

- [ ] **步骤 6：脚本 — 删除 onMounted 中多余的 grain 设置**

`onMounted` 中删除 `grain.value = defaultGrainMap[period.value]`，改为使用 `validateGrain()`。

- [ ] **步骤 7：Commit**

```bash
git add src/renderer/src/views/StatisticsView.vue
git commit -m "feat: 统计分析 — Element Plus 日期选择器 + 颗粒度联动限制"
```

---

### 任务 7：StatisticsView — KPI 扩展 + 排行区改造

**文件：**
- 修改：`src/renderer/src/views/StatisticsView.vue`

- [ ] **步骤 1：KPI 行 — 新增笔数卡片模板**

在现有 KPI 储蓄率卡片（第94-102行）之后添加：

```vue
<div class="stats-kpi-card">
  <div class="stats-kpi-icon stats-kpi-icon--count">
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
  </div>
  <p class="stats-kpi-label">记账笔数</p>
  <p class="stats-kpi-value count">{{ kpiData.transactionCount }}</p>
</div>
```

- [ ] **步骤 2：KPI 行 — 新增图标样式 + grid 修复**

在 `<style>` 中添加新样式：

```css
.stats-kpi-icon--count { background: rgba(139,92,246,0.08); color: #8B5CF6; }
.stats-kpi-value.count { color: #8B5CF6; }
```

同时修改 `.stats-kpi-row` 的 grid 从 4 列改为 5 列：

```css
.stats-kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);  /* 原来是 repeat(4, 1fr) */
  gap: 16px;
  margin-bottom: 28px;
}
```

- [ ] **步骤 3：KPI 数据扩展**

`kpiData` reactive 中新增字段（第279行）：

```ts
const kpiData = reactive({
  avgExpense: 0,
  avgIncome: 0,
  avgDaily: 0,
  savingsRate: 0,
  transactionCount: 0  // 新增
})
```

在 `fetchStats` 函数中（第507行后）添加：

```ts
kpiData.transactionCount = res.data.transactionCount || 0
```

- [ ] **步骤 4：分类排行 — 每行加笔数显示**

在排行模板 `.stats-rank-info` 中的金额后面添加笔数显示。修改第164-165行区域：

```vue
<div class="stats-rank-info">
  <span class="stats-rank-name">{{ item.name }}</span>
  <span class="stats-rank-right">
    <span class="stats-rank-amount" :style="{ color: item.iconColor }">¥{{ formatAmount(item.total) }}</span>
    <span class="stats-rank-count">{{ item.count }}笔</span>
  </span>
</div>
```

添加样式：

```css
.stats-rank-right {
  display: flex; align-items: center; gap: 8px;
}
.stats-rank-count {
  font-size: 0.75rem; color: #9CA3AF;
  white-space: nowrap;
}
```

- [ ] **步骤 5：rankList computed — 加 count 字段**

```ts
const rankList = computed(() => {
  const total = expenseCategoryStats.value.reduce((s, i) => s + i.total, 0)
  return [...expenseCategoryStats.value]
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((c: any, i: number) => ({
      name: c.category_name,
      total: c.total,
      count: c.count || 0,   // 新增
      pct: total > 0 ? Math.round((c.total / total) * 100) : 0,
      iconBg: RANK_ICONS[i % RANK_ICONS.length].bg,
      iconColor: RANK_ICONS[i % RANK_ICONS.length].color
    }))
})
```

- [ ] **步骤 6：单笔排行 — 数据获取**

新增响应式数据和获取函数：

```ts
const topExpenseList = ref<any[]>([])
const topIncomeList = ref<any[]>([])

async function fetchTopTransactions() {
  const range = getDateRange()
  try {
    const res = await window.transactionAPI.getTopTransactions(range.start, range.end, ledgerStore.currentId)
    if (res.code === 0) {
      topExpenseList.value = res.data.expenseTop || []
      topIncomeList.value = res.data.incomeTop || []
    }
  } catch (error: unknown) {
    console.error('获取单笔排行失败:', error)
  }
}
```

在 `fetchStats` 末尾、`onMounted`、`watch ledgerStore.currentId` 中调用 `fetchTopTransactions()`。

- [ ] **步骤 7：单笔排行 — 模板**

在排行区 `.stats-charts-row` 下方新增区域。将现有排行区布局改为：左栏分类排行 + 右栏单笔排行（两栏布局 `grid-template-columns: 1fr 1fr`）。

现有排行区模板改为：

```vue
<div class="stats-rank-row-area">
  <div class="stats-rank-card">
    <div class="stats-rank-header">
      <h2 class="stats-chart-title">分类消费排行</h2>
      <span class="stats-rank-period">{{ periodLabel }}</span>
    </div>
    <div class="stats-rank-list">
      <div
        v-for="(item, idx) in rankList"
        :key="idx"
        class="stats-rank-row"
        @click="showCategoryDetail(item)"
      >
        <div class="stats-rank-num" :class="{ 'rank-top': idx < 3 }">{{ idx + 1 }}</div>
        <div class="stats-rank-icon" :style="{ background: item.iconBg }">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" :stroke="item.iconColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div class="stats-rank-body">
          <div class="stats-rank-info">
            <span class="stats-rank-name">{{ item.name }}</span>
            <span class="stats-rank-right">
              <span class="stats-rank-amount" :style="{ color: item.iconColor }">¥{{ formatAmount(item.total) }}</span>
              <span class="stats-rank-count">{{ item.count }}笔</span>
            </span>
          </div>
          <div class="stats-rank-bar-bg">
            <div class="stats-rank-bar-fill" :style="{ width: item.pct + '%', background: item.iconColor }"></div>
          </div>
        </div>
        <span class="stats-rank-pct">{{ item.pct }}%</span>
      </div>
      <el-empty v-if="rankList.length === 0" description="暂无数据" :image-size="60" />
    </div>
  </div>

  <div class="stats-rank-card">
    <div class="stats-single-list">
      <h3 class="stats-single-title">单笔支出排行</h3>
      <div v-if="topExpenseList.length > 0">
        <div v-for="(item, idx) in topExpenseList" :key="'e'+idx" class="stats-single-row">
          <span class="stats-single-num">{{ idx + 1 }}</span>
          <span class="stats-single-amount expense">¥{{ item.amount.toFixed(2) }}</span>
          <span class="stats-single-cat">{{ item.category_name }}</span>
          <span class="stats-single-date">{{ item.trans_date }}</span>
        </div>
      </div>
      <el-empty v-else description="暂无支出数据" :image-size="40" />
    </div>
    <div class="stats-single-divider"></div>
    <div class="stats-single-list">
      <h3 class="stats-single-title">单笔收入排行</h3>
      <div v-if="topIncomeList.length > 0">
        <div v-for="(item, idx) in topIncomeList" :key="'i'+idx" class="stats-single-row">
          <span class="stats-single-num">{{ idx + 1 }}</span>
          <span class="stats-single-amount income">¥{{ item.amount.toFixed(2) }}</span>
          <span class="stats-single-cat">{{ item.category_name }}</span>
          <span class="stats-single-date">{{ item.trans_date }}</span>
        </div>
      </div>
      <el-empty v-else description="暂无收入数据" :image-size="40" />
    </div>
  </div>
</div>
```

- [ ] **步骤 8：单笔排行 + 整体布局样式**

```css
.stats-rank-row-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 28px;
}

.stats-rank-row {
  cursor: pointer;
}

.stats-single-list {
  padding: 20px 24px 8px;
}

.stats-single-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1A1A2E;
  margin-bottom: 12px;
}

.stats-single-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  gap: 12px;
  border-bottom: 1px solid #F5F7FA;
}

.stats-single-row:last-child { border-bottom: none; }

.stats-single-num {
  width: 20px; height: 20px;
  border-radius: 4px; background: #F5F7FA;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.6875rem; font-weight: 700; color: #6B7280;
  flex-shrink: 0;
}

.stats-single-amount {
  font-size: 0.8125rem; font-weight: 600;
  font-variant-numeric: tabular-nums; white-space: nowrap;
  min-width: 80px;
}

.stats-single-amount.expense { color: #FF8C00; }
.stats-single-amount.income { color: #10B981; }

.stats-single-cat {
  font-size: 0.8125rem; color: #6B7280;
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.stats-single-date {
  font-size: 0.75rem; color: #9CA3AF;
  white-space: nowrap; flex-shrink: 0;
}

.stats-single-divider {
  height: 1px; background: #F0F2F5; margin: 0 24px;
}

.stats-rank-right {
  display: flex; align-items: center; gap: 8px;
}

.stats-rank-count {
  font-size: 0.75rem; color: #9CA3AF;
  white-space: nowrap;
}
```

- [ ] **步骤 9：Commit**

```bash
git add src/renderer/src/views/StatisticsView.vue
git commit -m "feat: 统计分析 — 新增记账笔数KPI、分类排行加笔数、单笔收支top10排行"
```

---

### 任务 8：StatisticsView — 分类排行点击弹框集成

**文件：**
- 修改：`src/renderer/src/views/StatisticsView.vue`

- [ ] **步骤 1：导入 + 状态**

在 `<script>` 中添加：

```ts
import CategoryDetailDialog from '../components/CategoryDetailDialog.vue'

// 明细弹框状态
const detailVisible = ref(false)
const detailCategoryName = ref('')
const detailCategoryId = ref(0)
const detailDateRange = computed(() => getDateRange())

function showCategoryDetail(item: { name: string; total: number; count: number }) {
  // 从 expenseCategoryStats 中找回完整的 category_id
  const cat = expenseCategoryStats.value.find((c: any) => c.category_name === item.name)
  if (cat) {
    detailCategoryName.value = item.name
    detailCategoryId.value = cat.category_id
    detailVisible.value = true
  }
}
```

- [ ] **步骤 2：模板 — 添加弹框组件**

在 `</div>` (`.stats-body`) 之前添加：

```vue
<CategoryDetailDialog
  v-model:visible="detailVisible"
  :category-name="detailCategoryName"
  :category-id="detailCategoryId"
  :start-date="detailDateRange.start"
  :end-date="detailDateRange.end"
/>
```

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/views/StatisticsView.vue
git commit -m "feat: 统计分析 — 分类排行点击弹出账单明细弹框"
```

