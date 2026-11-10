# 月度财务报表 PDF 导出 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在主应用中新增独立报表页，基于已定稿的 `report-template-ultra.html` 生成 7 页月度财务报告，并一键导出为 PDF 文件。

**架构：** 主进程 `reportDataService` 直连 SQLite 做确定性聚合，`reportAiService` 只生成文案（zod 校验 + 重试 + 降级），两者合并为 `ReportData`；渲染层用共享的 `ReportDocument` 组件树同时服务主窗口预览与独立打印页（vite 多入口 `report-print.html`）；导出时主进程开隐藏窗口加载打印页，收到 `report:print-ready` 回执后调用 `webContents.printToPDF` 落盘。

**技术栈：** Electron 42（`printToPDF`）、Vue 3 + TypeScript、ECharts 6（`animation:false` + `devicePixelRatio:3`）、zod、vitest、better-sqlite3。包管理器只用 pnpm。

**规格文档：** `docs/superpowers/specs/2026-11-10-report-export-design.md`

---

## 文件结构

### 新建

| 文件 | 职责 |
|---|---|
| `vitest.config.ts` | 单测配置（node 环境，`src/**/*.test.ts`） |
| `src/shared/types/report.ts` | `ReportData` / `ReportBase` / `ReportAiNarrative` 类型 + AI 输出 zod schema |
| `src/shared/types/report.test.ts` | zod schema 合法/非法样例单测 |
| `src/main/service/report/reportAggregate.ts` | 纯函数聚合（结余/储蓄率/分类占比与环比/整月补全/记账行为统计/YTD） |
| `src/main/service/report/reportAggregate.test.ts` | 上述纯函数单测（空月/单月/跨年） |
| `src/main/service/report/reportDataService.ts` | SQL 查询 + 组装 `ReportBase` |
| `src/main/service/report/reportDataService.test.ts` | 内存库集成测试（跨年月份区间、分类环比、空月） |
| `src/main/service/report/reportAiService.ts` | AI 文案生成（注入式 `callModel`，zod 校验，失败重试 1 次，降级） |
| `src/main/service/report/reportAiService.test.ts` | 非法 JSON 重试、两次失败降级单测 |
| `src/main/service/report/reportExportService.ts` | 隐藏窗口 + `printToPDF` + 保存对话框 + 落盘 |
| `src/main/controller/reportController.ts` | `report:generate` / `report:export` IPC |
| `src/renderer/report-print.html` | 打印页 HTML 入口 |
| `src/renderer/report-print/main.ts` | 打印页挂载 + IPC 收发 |
| `src/renderer/report-print/PrintRoot.vue` | 打印页根组件（收数据 → 渲染 → 回执） |
| `src/renderer/src/views/ReportView/index.vue` | 月份选择 / 生成 / 预览 / 导出 |
| `src/renderer/src/components/report/report.css` | 从 Ultra 模板迁移的全部报表样式 |
| `src/renderer/src/components/report/reportFormat.ts` | 金额/百分比/期间标题格式化 |
| `src/renderer/src/components/report/ReportDocument.vue` | 7 页拼装 + 暴露 `waitRendered()` |
| `src/renderer/src/components/report/ReportPage.vue` | 通用页壳（页头 + 页脚 + 页码） |
| `src/renderer/src/components/report/sections/CoverPage.vue` | 第 1 页封面 |
| `src/renderer/src/components/report/sections/ExecSummaryPage.vue` | 第 2 页执行摘要 |
| `src/renderer/src/components/report/sections/CashflowPage.vue` | 第 3 页收支总览 + 近 6 月趋势 |
| `src/renderer/src/components/report/sections/StructurePage.vue` | 第 4 页帕累托 + 分类环比 + 分类表 |
| `src/renderer/src/components/report/sections/BudgetSection.vue` | 预算节（无数据自动隐藏） |
| `src/renderer/src/components/report/sections/DailyPage.vue` | 第 5 页每日走势 + 记账行为 + TOP5 |
| `src/renderer/src/components/report/sections/InsightsPage.vue` | 第 6 页 AI 洞察 + 五维评分 |
| `src/renderer/src/components/report/sections/ClosingPage.vue` | 第 7 页建议 + 附录 + 结语 |
| `src/renderer/src/components/report/charts/useReportChart.ts` | ECharts 挂载/销毁 + 全局渲染完成等待 |
| `src/renderer/src/components/report/charts/Trend6Chart.vue` | 近 6 月收支 + 储蓄率双轴图 |
| `src/renderer/src/components/report/charts/ParetoChart.vue` | 支出帕累托图 |
| `src/renderer/src/components/report/charts/CompareChart.vue` | 分类环比双柱图 |
| `src/renderer/src/components/report/charts/DailyChart.vue` | 每日支出走势（含峰值标注） |
| `src/renderer/src/components/report/charts/RadarChart.vue` | 五维财务健康雷达图 |

### 修改

| 文件 | 改动 |
|---|---|
| `package.json` | 新增 `zod`、`vitest`，新增 `test` 脚本 |
| `electron.vite.config.ts` | renderer 增加 `@shared` 别名与多入口 `index` / `report-print` |
| `tsconfig.node.json` | 增加 `paths` 的 `@shared/*`（供 IDE 解析） |
| `tsconfig.web.json` | `rootDir` 改为 `./src`，include 增加 `src/shared/**/*.ts`，paths 增加 `@shared/*` |
| `src/main/service/ai/aiToolService.ts` | 新增 `get_monthly_summaries`、`compare_category_breakdown` 两个工具 |
| `src/main/index.ts` | 注册 `registerReportController()` |
| `src/preload/index.ts` | 暴露 `reportAPI` |
| `src/preload/index.d.ts`、`src/renderer/src/env.d.ts` | 声明 `ReportAPI` 与 `Window.reportAPI` |
| `src/renderer/src/App.vue` | 侧栏新增「月度报表」导航项与视图挂载 |

---

## 任务 1：依赖与测试基础设施

**文件：**
- 修改：`package.json:7-16`、`package.json:17-24`
- 创建：`vitest.config.ts`

- [ ] **步骤 1：安装依赖**

```powershell
pnpm add zod
pnpm add -D vitest
```

预期：`package.json` 的 `dependencies` 出现 `"zod"`，`devDependencies` 出现 `"vitest"`；终端无 peer 依赖报错。

- [ ] **步骤 2：添加 test 脚本**

修改 `package.json` 的 `scripts`，在 `"build"` 之前插入一行（保持 JSON 逗号正确）：

```json
    "test": "vitest run --passWithNoTests",
```

- [ ] **步骤 3：创建测试配置**

创建 `vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **步骤 4：验证**

运行：`pnpm test`
预期：输出 `No test files found, exiting with code 0`（`--passWithNoTests` 生效）。

- [ ] **步骤 5：Commit**

```powershell
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: 引入 zod 与 vitest 测试基础设施"
```

---

## 任务 2：报表数据契约与 AI 输出校验

**文件：**
- 创建：`src/shared/types/report.ts`
- 测试：`src/shared/types/report.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `src/shared/types/report.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { aiNarrativeSchema } from './report'

const valid = {
  overview: '10月总收入 18,500 元，总支出 9,216.5 元，整体财务状况健康。',
  changeFromLastMonth: '支出较上月下降 8.3%，主要来自购物回落。',
  insights: ['餐饮 62 笔，笔均 42.2 元。', '储蓄率连续两月高于 45%。'],
  suggestions: [
    { text: '双十一尾款建议提前规划预算。', prio: 'high' },
    { text: '每周自炊 2~3 次可再省 300 元。', prio: 'mid' },
  ],
  scoreDims: [
    { name: '储蓄能力', value: 92, prev: 85 },
    { name: '支出控制', value: 78, prev: 72 },
    { name: '消费结构', value: 70, prev: 63 },
    { name: '消费稳定', value: 68, prev: 60 },
    { name: '记账习惯', value: 74, prev: 69 },
  ],
  score: 82,
}

describe('aiNarrativeSchema', () => {
  it('接受合法结构', () => {
    expect(aiNarrativeSchema.safeParse(valid).success).toBe(true)
  })

  it('拒绝缺少 insights 的对象', () => {
    const bad = { ...valid, insights: undefined }
    expect(aiNarrativeSchema.safeParse(bad).success).toBe(false)
  })

  it('拒绝优先级不在 high/mid 的建议', () => {
    const bad = { ...valid, suggestions: [{ text: '随便花花', prio: 'low' }] }
    expect(aiNarrativeSchema.safeParse(bad).success).toBe(false)
  })

  it('拒绝维度数量不是 5 的评分', () => {
    const bad = { ...valid, scoreDims: valid.scoreDims.slice(0, 4) }
    expect(aiNarrativeSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm test src/shared/types/report.test.ts`
预期：FAIL，报错 `Failed to resolve import "./report"`。

- [ ] **步骤 3：编写类型契约与 schema**

创建 `src/shared/types/report.ts`：

```ts
import { z } from 'zod'

export interface ReportSummary {
  income: number
  expense: number
  balance: number
  count: number
  /** 储蓄率，百分比，保留 1 位小数；收入为 0 时取 0 */
  savingsRate: number
}

export interface ReportCategory {
  name: string
  amount: number
  /** 占本月支出百分比，保留 1 位小数 */
  percent: number
  count: number
  /** 上月同分类金额，用于环比 */
  prev: number
}

export interface ReportBudget {
  name: string
  amount: number
  budget: number
}

export interface ReportTopEntry {
  /** 形如 10-18 */
  date: string
  title: string
  category: string
  amount: number
}

export interface ReportMonthlyPoint {
  /** 形如 10月 */
  ym: string
  income: number
  expense: number
  savingsRate: number
}

export interface ReportDailyPoint {
  day: number
  expense: number
  weekend: boolean
  /** 当日是否有任何交易（含收入） */
  hasRecord: boolean
}

export interface ReportScoreDim {
  name: string
  value: number
  prev: number
}

export interface ReportSuggestion {
  text: string
  prio: 'high' | 'mid'
}

export interface ReportBookStats {
  activeDays: number
  /** 有记账的天数内，日均交易笔数 */
  avgPerDay: number
  maxDayExpense: number
  maxDayDate: string
  /** 从月末向前连续记账的天数 */
  streak: number
}

export interface ReportAiNarrative {
  overview: string
  changeFromLastMonth: string
  insights: string[]
  suggestions: ReportSuggestion[]
  scoreDims: ReportScoreDim[]
  score: number
  /** true 表示 AI 生成失败，渲染层隐藏洞察与雷达图 */
  failed: boolean
}

export interface ReportData {
  yearMonth: string
  ledgerName: string
  /** 形如 2026-10-01 ~ 2026-10-31 */
  period: string
  generatedAt: string
  summary: ReportSummary
  prevSummary: ReportSummary
  monthly6: ReportMonthlyPoint[]
  ytd: { income: number; expense: number; savingsRate: number }
  categories: ReportCategory[]
  /** 收入分类结构（金额降序，percent 为占收入比） */
  incomeStructure: ReportCategory[]
  budgets: ReportBudget[]
  topEntries: ReportTopEntry[]
  daily: ReportDailyPoint[]
  bookStats: ReportBookStats
  ai: ReportAiNarrative
}

/** AI 文案生成前的基础数据（不含 ai 字段） */
export type ReportBase = Omit<ReportData, 'ai'>

/**
 * AI 返回的 JSON 契约。
 * 五个评分维度固定为：储蓄能力 / 支出控制 / 消费结构 / 消费稳定 / 记账习惯。
 * 注：预算功能尚未实现，原模板中的「预算执行」维度改为可由记账行为数据支撑的「记账习惯」。
 */
export const aiNarrativeSchema = z.object({
  overview: z.string().min(10).max(400),
  changeFromLastMonth: z.string().min(4).max(200),
  insights: z.array(z.string().min(4).max(120)).min(2).max(6),
  suggestions: z
    .array(z.object({ text: z.string().min(4).max(120), prio: z.enum(['high', 'mid']) }))
    .min(1)
    .max(5),
  scoreDims: z
    .array(
      z.object({
        name: z.string().min(1).max(10),
        value: z.number().int().min(0).max(100),
        prev: z.number().int().min(0).max(100),
      }),
    )
    .length(5),
  score: z.number().int().min(0).max(100),
})

export type AiNarrativePayload = z.infer<typeof aiNarrativeSchema>
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm test src/shared/types/report.test.ts`
预期：PASS，4 个用例通过。

- [ ] **步骤 5：Commit**

```powershell
git add src/shared/types/report.ts src/shared/types/report.test.ts
git commit -m "feat: 新增报表数据契约与 AI 文案校验 schema"
```

---

## 任务 3：纯聚合函数

**文件：**
- 创建：`src/main/service/report/reportAggregate.ts`
- 测试：`src/main/service/report/reportAggregate.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `src/main/service/report/reportAggregate.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import {
  toSummary,
  buildCategories,
  buildDaily,
  buildBookStats,
  buildMonthlySeries,
  buildYtd,
} from './reportAggregate'

describe('toSummary', () => {
  it('计算结余与储蓄率', () => {
    expect(toSummary({ income: 18500, expense: 9216.5, count: 147 })).toEqual({
      income: 18500,
      expense: 9216.5,
      balance: 9283.5,
      count: 147,
      savingsRate: 50.2,
    })
  })

  it('空月储蓄率为 0 且金额为 0', () => {
    expect(toSummary({ income: 0, expense: 0, count: 0 })).toEqual({
      income: 0,
      expense: 0,
      balance: 0,
      count: 0,
      savingsRate: 0,
    })
  })
})

describe('buildCategories', () => {
  it('计算占比、上月金额并按金额降序', () => {
    const rows = buildCategories(
      [
        { name: '餐饮', amount: 2617.5, count: 62 },
        { name: '购物', amount: 1906, count: 18 },
      ],
      [{ name: '餐饮', amount: 2452, count: 60 }],
    )
    expect(rows[0]).toEqual({ name: '餐饮', amount: 2617.5, percent: 57.9, count: 62, prev: 2452 })
    expect(rows[1]).toEqual({ name: '购物', amount: 1906, percent: 42.1, count: 18, prev: 0 })
  })

  it('当月无支出时占比为 0', () => {
    expect(buildCategories([], [])).toEqual([])
  })
})

describe('buildDaily', () => {
  it('补齐整月天数并标记周末', () => {
    const daily = buildDaily(
      [
        { date: '2026-10-01', income: 0, expense: 100 },
        { date: '2026-10-03', income: 0, expense: 50 },
      ],
      '2026-10',
    )
    expect(daily).toHaveLength(31)
    expect(daily[0]).toEqual({ day: 1, expense: 100, weekend: false, hasRecord: true })
    expect(daily[2]).toEqual({ day: 3, expense: 50, weekend: true, hasRecord: true })
    expect(daily[4]).toEqual({ day: 5, expense: 0, weekend: false, hasRecord: false })
  })
})

describe('buildBookStats', () => {
  it('统计活跃天数、日均笔数、最大单日与连续记账', () => {
    const daily = buildDaily(
      [
        { date: '2026-10-28', income: 0, expense: 20 },
        { date: '2026-10-29', income: 0, expense: 30 },
        { date: '2026-10-30', income: 0, expense: 900 },
        { date: '2026-10-31', income: 0, expense: 10 },
      ],
      '2026-10',
    )
    expect(buildBookStats(daily, 12, '2026-10')).toEqual({
      activeDays: 4,
      avgPerDay: 3,
      maxDayExpense: 900,
      maxDayDate: '2026-10-30',
      streak: 4,
    })
  })

  it('空月不抛错', () => {
    expect(buildBookStats(buildDaily([], '2026-02'), 0, '2026-02')).toEqual({
      activeDays: 0,
      avgPerDay: 0,
      maxDayExpense: 0,
      maxDayDate: '',
      streak: 0,
    })
  })
})

describe('buildMonthlySeries / buildYtd', () => {
  const rows = [
    { ym: '2025-12', income: 10000, expense: 8000, count: 10 },
    { ym: '2026-01', income: 12000, expense: 6000, count: 12 },
  ]

  it('月份标签转为中文月', () => {
    expect(buildMonthlySeries(rows)).toEqual([
      { ym: '12月', income: 10000, expense: 8000, savingsRate: 20 },
      { ym: '1月', income: 12000, expense: 6000, savingsRate: 50 },
    ])
  })

  it('YTD 汇总收入、支出与储蓄率', () => {
    expect(buildYtd(rows)).toEqual({ income: 22000, expense: 14000, savingsRate: 36.4 })
  })

  it('YTD 空数组返回 0', () => {
    expect(buildYtd([])).toEqual({ income: 0, expense: 0, savingsRate: 0 })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm test src/main/service/report/reportAggregate.test.ts`
预期：FAIL，报错 `Failed to resolve import "./reportAggregate"`。

- [ ] **步骤 3：编写最少实现**

创建 `src/main/service/report/reportAggregate.ts`：

```ts
import type {
  ReportBookStats,
  ReportCategory,
  ReportDailyPoint,
  ReportMonthlyPoint,
  ReportSummary,
} from '../../../shared/types/report'

export interface RawMonthSummary {
  income: number
  expense: number
  count: number
}

export interface RawCategoryRow {
  name: string
  amount: number
  count: number
}

export interface RawDailyRow {
  date: string
  income: number
  expense: number
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function toSummary(raw: RawMonthSummary): ReportSummary {
  const income = round2(raw.income)
  const expense = round2(raw.expense)
  return {
    income,
    expense,
    balance: round2(income - expense),
    count: raw.count,
    savingsRate: income > 0 ? round1(((income - expense) / income) * 100) : 0,
  }
}

export function toMonthlyPoint(ym: string, raw: RawMonthSummary): ReportMonthlyPoint {
  const s = toSummary(raw)
  return { ym: `${Number(ym.slice(5, 7))}月`, income: s.income, expense: s.expense, savingsRate: s.savingsRate }
}

export function buildCategories(current: RawCategoryRow[], prev: RawCategoryRow[]): ReportCategory[] {
  const total = current.reduce((s, r) => s + r.amount, 0)
  const prevMap = new Map(prev.map((r) => [r.name, r.amount]))
  return current
    .map((r) => ({
      name: r.name,
      amount: round2(r.amount),
      percent: total > 0 ? round1((r.amount / total) * 100) : 0,
      count: r.count,
      prev: round2(prevMap.get(r.name) ?? 0),
    }))
    .sort((a, b) => b.amount - a.amount)
}

export function buildMonthlySeries(rows: Array<{ ym: string } & RawMonthSummary>): ReportMonthlyPoint[] {
  return rows.map((r) => toMonthlyPoint(r.ym, r))
}

export function buildYtd(rows: RawMonthSummary[]): { income: number; expense: number; savingsRate: number } {
  const income = round2(rows.reduce((s, r) => s + r.income, 0))
  const expense = round2(rows.reduce((s, r) => s + r.expense, 0))
  return {
    income,
    expense,
    savingsRate: income > 0 ? round1(((income - expense) / income) * 100) : 0,
  }
}

export function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function buildDaily(rows: RawDailyRow[], yearMonth: string): ReportDailyPoint[] {
  const [y, m] = yearMonth.split('-').map(Number)
  const map = new Map(rows.map((r) => [Number(r.date.slice(8, 10)), r]))
  const total = daysInMonth(yearMonth)
  const out: ReportDailyPoint[] = []
  for (let day = 1; day <= total; day++) {
    const row = map.get(day)
    const weekday = new Date(y, m - 1, day).getDay()
    out.push({
      day,
      expense: round2(row?.expense ?? 0),
      weekend: weekday === 0 || weekday === 6,
      hasRecord: !!row && (row.income > 0 || row.expense > 0),
    })
  }
  return out
}

export function buildBookStats(daily: ReportDailyPoint[], count: number, yearMonth: string): ReportBookStats {
  const activeDays = daily.filter((d) => d.hasRecord).length
  let maxDayExpense = 0
  let maxDayDate = ''
  for (const d of daily) {
    if (d.expense > maxDayExpense) {
      maxDayExpense = d.expense
      maxDayDate = `${yearMonth}-${String(d.day).padStart(2, '0')}`
    }
  }
  let streak = 0
  for (let i = daily.length - 1; i >= 0; i--) {
    if (!daily[i].hasRecord) break
    streak++
  }
  return {
    activeDays,
    avgPerDay: activeDays > 0 ? round1(count / activeDays) : 0,
    maxDayExpense,
    maxDayDate,
    streak,
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm test src/main/service/report/reportAggregate.test.ts`
预期：PASS，10 个用例通过。

- [ ] **步骤 5：Commit**

```powershell
git add src/main/service/report/reportAggregate.ts src/main/service/report/reportAggregate.test.ts
git commit -m "feat: 新增报表纯聚合函数与单测"
```

---

## 任务 4：数据查询服务

**文件：**
- 创建：`src/main/service/report/reportDataService.ts`
- 测试：`src/main/service/report/reportDataService.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `src/main/service/report/reportDataService.test.ts`。测试使用内存库（`DbManager.init(':memory:')`），直接插入账本与交易：

```ts
import { describe, it, expect, beforeAll } from 'vitest'
import DbManager from '../../db/database'
import { ReportDataService } from './reportDataService'

function seed(): void {
  const db = DbManager.getInstance().getDb()
  db.prepare("INSERT OR IGNORE INTO ledger (id, name) VALUES (2, '测试账本')").run()
  db.prepare("INSERT OR IGNORE INTO category (id, name, type) VALUES (900, '餐饮', 'expense')").run()
  db.prepare("INSERT OR IGNORE INTO category (id, name, type) VALUES (901, '工资', 'income')").run()
  const insert = db.prepare(
    'INSERT INTO transactions (type, amount, category_id, ledger_id, trans_date, description) VALUES (?, ?, ?, ?, ?, ?)',
  )
  insert.run('expense', 100, 900, 2, '2025-12-05', '午餐')
  insert.run('expense', 200, 900, 2, '2026-01-06', '聚餐')
  insert.run('income', 5000, 901, 2, '2026-01-10', '工资')
  insert.run('expense', 300, 900, 2, '2026-02-07', '外卖')
  insert.run('expense', 999, 900, 1, '2026-02-08', '其他账本不应计入')
}

beforeAll(() => {
  DbManager.getInstance().init(':memory:')
  seed()
})

describe('getMonthlySummaries', () => {
  it('返回指定月份数并按时间升序，跨年连续', () => {
    const svc = new ReportDataService(2)
    const { series } = svc.getMonthlySummaries('2026-02', 3)
    expect(series.map((s) => s.ym)).toEqual(['12月', '1月', '2月'])
    expect(series[1]).toEqual({ ym: '1月', income: 5000, expense: 200, savingsRate: 96 })
    expect(series[2]).toEqual({ ym: '2月', income: 0, expense: 300, savingsRate: 0 })
  })

  it('YTD 只累计当年 1 月到结束月', () => {
    const svc = new ReportDataService(2)
    expect(svc.getMonthlySummaries('2026-02', 3).ytd).toEqual({
      income: 5000,
      expense: 500,
      savingsRate: 90,
    })
  })
})

describe('getCategoryComparison', () => {
  it('返回分类环比并在上月无该分类时 prev=0', () => {
    const svc = new ReportDataService(2)
    const rows = svc.getCategoryComparison('2026-01', '2025-12')
    expect(rows).toEqual([{ name: '餐饮', amount: 200, percent: 100, count: 1, prev: 100 }])
  })
})

describe('buildBase', () => {
  it('组装 7 页所需基础数据', () => {
    const svc = new ReportDataService(2)
    const base = svc.buildBase('2026-01')
    expect(base.ledgerName).toBe('测试账本')
    expect(base.period).toBe('2026-01-01 ~ 2026-01-31')
    expect(base.summary).toEqual({ income: 5000, expense: 200, balance: 4800, count: 2, savingsRate: 96 })
    expect(base.prevSummary).toEqual({ income: 0, expense: 100, balance: -100, count: 1, savingsRate: 0 })
    expect(base.categories).toHaveLength(1)
    expect(base.daily).toHaveLength(31)
    expect(base.monthly6).toHaveLength(6)
    expect(base.bookStats.activeDays).toBe(2)
    expect(base.incomeStructure[0]).toEqual({ name: '工资', amount: 5000, percent: 100, count: 1, prev: 0 })
    expect(base.topEntries[0]).toEqual({ date: '01-06', title: '聚餐', category: '餐饮', amount: 200 })
  })

  it('空月不抛错且金额全为 0', () => {
    const svc = new ReportDataService(2)
    const base = svc.buildBase('2026-05')
    expect(base.summary.count).toBe(0)
    expect(base.categories).toEqual([])
    expect(base.topEntries).toEqual([])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm test src/main/service/report/reportDataService.test.ts`
预期：FAIL，报错 `Failed to resolve import "./reportDataService"`。

- [ ] **步骤 3：编写实现**

创建 `src/main/service/report/reportDataService.ts`：

```ts
import dayjs from 'dayjs'
import DbManager from '../../db/database'
import type { ReportBase, ReportDailyPoint, ReportTopEntry } from '../../../shared/types/report'
import {
  buildBookStats,
  buildCategories,
  buildDaily,
  buildMonthlySeries,
  buildYtd,
  daysInMonth,
  round2,
  toMonthlyPoint,
  toSummary,
  type RawCategoryRow,
  type RawDailyRow,
  type RawMonthSummary,
} from './reportAggregate'

export class ReportDataService {
  private db = DbManager.getInstance()
  private ledgerId: number

  constructor(ledgerId: number) {
    this.ledgerId = ledgerId
  }

  private monthRaw(yearMonth: string): RawMonthSummary {
    const row = this.db.get<RawMonthSummary>(
      `SELECT
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense,
        COUNT(*) as count
      FROM transactions t
      WHERE t.ledger_id = ? AND t.trans_date LIKE ?`,
      [this.ledgerId, `${yearMonth}%`],
    )
    return { income: row?.income ?? 0, expense: row?.expense ?? 0, count: row?.count ?? 0 }
  }

  private categoryRaw(yearMonth: string, type: 'expense' | 'income'): RawCategoryRow[] {
    return this.db.all<RawCategoryRow>(
      `SELECT c.name as name, SUM(t.amount) as amount, COUNT(*) as count
      FROM transactions t
      LEFT JOIN category c ON t.category_id = c.id
      WHERE t.ledger_id = ? AND t.trans_date LIKE ? AND t.type = ?
      GROUP BY c.name ORDER BY amount DESC`,
      [this.ledgerId, `${yearMonth}%`, type],
    )
  }

  private dailyRaw(yearMonth: string): RawDailyRow[] {
    return this.db.all<RawDailyRow>(
      `SELECT t.trans_date as date,
        COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END), 0) as expense
      FROM transactions t
      WHERE t.ledger_id = ? AND t.trans_date LIKE ?
      GROUP BY t.trans_date ORDER BY t.trans_date ASC`,
      [this.ledgerId, `${yearMonth}%`],
    )
  }

  private topRaw(yearMonth: string, limit: number): ReportTopEntry[] {
    const rows = this.db.all<{ date: string; title: string; category: string; amount: number }>(
      `SELECT t.trans_date as date, COALESCE(t.description, '') as title,
        COALESCE(c.name, '未分类') as category, t.amount as amount
      FROM transactions t LEFT JOIN category c ON t.category_id = c.id
      WHERE t.ledger_id = ? AND t.trans_date LIKE ? AND t.type = 'expense'
      ORDER BY t.amount DESC LIMIT ?`,
      [this.ledgerId, `${yearMonth}%`, limit],
    )
    return rows.map((r) => ({ date: r.date.slice(5), title: r.title || '无备注', category: r.category, amount: round2(r.amount) }))
  }

  private ledgerName(): string {
    const row = this.db.get<{ name: string }>('SELECT name FROM ledger WHERE id = ?', [this.ledgerId])
    return row?.name || '默认账本'
  }

  /** 近 N 月汇总（含结束月），按时间升序；ytd 为结束月所在年 1 月至结束月累计 */
  getMonthlySummaries(endYM: string, months: number): {
    series: ReturnType<typeof buildMonthlySeries>
    ytd: ReturnType<typeof buildYtd>
  } {
    const count = Math.max(1, Math.floor(months))
    const rows: Array<{ ym: string } & RawMonthSummary> = []
    for (let i = count - 1; i >= 0; i--) {
      const ym = dayjs(`${endYM}-01`).subtract(i, 'month').format('YYYY-MM')
      rows.push({ ym, ...this.monthRaw(ym) })
    }
    const endYear = endYM.slice(0, 4)
    const ytdRows = rows.filter((r) => r.ym.startsWith(endYear))
    return { series: buildMonthlySeries(rows), ytd: buildYtd(ytdRows) }
  }

  /** 分类级环比：返回当月支出分类，prev 为上月同分类金额 */
  getCategoryComparison(currentYM: string, prevYM: string) {
    return buildCategories(this.categoryRaw(currentYM, 'expense'), this.categoryRaw(prevYM, 'expense'))
  }

  /** 返回该月每日支出（补齐整月） */
  getDaily(yearMonth: string): ReportDailyPoint[] {
    return buildDaily(this.dailyRaw(yearMonth), yearMonth)
  }

  /** 汇总除 AI 文案外的全部报表数据 */
  buildBase(yearMonth: string): ReportBase {
    const prevYM = dayjs(`${yearMonth}-01`).subtract(1, 'month').format('YYYY-MM')
    const raw = this.monthRaw(yearMonth)
    const daily = this.getDaily(yearMonth)
    const { series, ytd } = this.getMonthlySummaries(yearMonth, 6)
    const incomeCats = this.categoryRaw(yearMonth, 'income')
    const incomeTotal = incomeCats.reduce((s, r) => s + r.amount, 0)

    return {
      yearMonth,
      ledgerName: this.ledgerName(),
      period: `${yearMonth}-01 ~ ${yearMonth}-${String(daysInMonth(yearMonth)).padStart(2, '0')}`,
      generatedAt: dayjs().format('YYYY-MM-DD HH:mm'),
      summary: toSummary(raw),
      prevSummary: toSummary(this.monthRaw(prevYM)),
      monthly6: series,
      ytd,
      categories: this.getCategoryComparison(yearMonth, prevYM),
      incomeStructure: incomeTotal > 0 ? buildCategories(incomeCats, []) : [],
      budgets: [],
      topEntries: this.topRaw(yearMonth, 5),
      daily,
      bookStats: buildBookStats(daily, raw.count, yearMonth),
    }
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm test src/main/service/report/reportDataService.test.ts`
预期：PASS，5 个用例通过。

- [ ] **步骤 5：Commit**

```powershell
git add src/shared/types/report.ts src/main/service/report/reportDataService.ts src/main/service/report/reportDataService.test.ts
git commit -m "feat: 新增报表数据查询服务与内存库集成测试"
```

---

## 任务 5：AI 文案生成与降级

**文件：**
- 创建：`src/main/service/report/reportAiService.ts`
- 测试：`src/main/service/report/reportAiService.test.ts`

- [ ] **步骤 1：编写失败的测试**

创建 `src/main/service/report/reportAiService.test.ts`：

```ts
import { describe, it, expect, vi } from 'vitest'
import { ReportAiService, extractJson } from './reportAiService'
import type { ReportBase } from '../../../shared/types/report'

const base = {
  yearMonth: '2026-10',
  ledgerName: '日常账本',
  period: '2026-10-01 ~ 2026-10-31',
  generatedAt: '2026-11-09 21:30',
  summary: { income: 18500, expense: 9216.5, balance: 9283.5, count: 147, savingsRate: 50.2 },
  prevSummary: { income: 17800, expense: 10049.4, balance: 7750.6, count: 150, savingsRate: 43.5 },
  monthly6: [{ ym: '10月', income: 18500, expense: 9216.5, savingsRate: 50.2 }],
  ytd: { income: 100000, expense: 70000, savingsRate: 30 },
  categories: [{ name: '餐饮', amount: 2617.5, percent: 28.4, count: 62, prev: 2452 }],
  incomeStructure: [{ name: '工资', amount: 18500, percent: 100, count: 1, prev: 0 }],
  budgets: [],
  topEntries: [{ date: '10-18', title: '双十一预售', category: '购物', amount: 899 }],
  daily: [],
  bookStats: { activeDays: 25, avgPerDay: 5.9, maxDayExpense: 1650, maxDayDate: '2026-10-01', streak: 4 },
} satisfies ReportBase

const validJson = JSON.stringify({
  overview: '10月总收入 18,500 元，总支出 9,216.5 元，整体财务状况健康。',
  changeFromLastMonth: '支出较上月下降 8.3%。',
  insights: ['餐饮 62 笔，笔均 42.2 元。', '储蓄率连续两个月高于 45%。'],
  suggestions: [{ text: '提前规划 11 月尾款预算。', prio: 'high' }],
  scoreDims: [
    { name: '储蓄能力', value: 92, prev: 85 },
    { name: '支出控制', value: 78, prev: 72 },
    { name: '消费结构', value: 70, prev: 63 },
    { name: '消费稳定', value: 68, prev: 60 },
    { name: '记账习惯', value: 74, prev: 69 },
  ],
  score: 82,
})

describe('extractJson', () => {
  it('剥离 ```json 围栏', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('截取首个 { 到最后一个 }', () => {
    expect(extractJson('好的，结果如下：{"a":1} 完毕')).toBe('{"a":1}')
  })
})

describe('ReportAiService.buildNarrative', () => {
  it('首次返回非法 JSON 时重试一次并成功', async () => {
    const callModel = vi.fn().mockResolvedValueOnce('不是 JSON').mockResolvedValueOnce(validJson)
    const svc = new ReportAiService(callModel)
    const result = await svc.buildNarrative(base)
    expect(callModel).toHaveBeenCalledTimes(2)
    expect(result.failed).toBe(false)
    expect(result.score).toBe(82)
    expect(result.scoreDims).toHaveLength(5)
  })

  it('两次都失败时降级且不抛错', async () => {
    const callModel = vi.fn().mockResolvedValue('还是不是 JSON')
    const svc = new ReportAiService(callModel)
    const result = await svc.buildNarrative(base)
    expect(callModel).toHaveBeenCalledTimes(2)
    expect(result.failed).toBe(true)
    expect(result.overview).toContain('分析生成失败')
    expect(result.scoreDims).toEqual([])
  })

  it('prompt 中带上关键统计数字', async () => {
    const callModel = vi.fn().mockResolvedValue(validJson)
    const svc = new ReportAiService(callModel)
    await svc.buildNarrative(base)
    const prompt = callModel.mock.calls[0][0][1].content as string
    expect(prompt).toContain('18500')
    expect(prompt).toContain('储蓄能力')
    expect(prompt).toContain('147')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`pnpm test src/main/service/report/reportAiService.test.ts`
预期：FAIL，报错 `Failed to resolve import "./reportAiService"`。

- [ ] **步骤 3：编写实现**

创建 `src/main/service/report/reportAiService.ts`：

```ts
import { aiNarrativeSchema, type ReportAiNarrative, type ReportBase } from '../../../shared/types/report'
import { aiConfigService } from '../ai/aiConfigService'
import type { ChatMessage } from '../ai/deepseekClient'
import { logger } from '../../utils/logger'
import { newRequestId, type AILogContext } from '../../utils/aiLogger'

export type ReportModelCaller = (messages: ChatMessage[]) => Promise<string>

const SYSTEM_PROMPT = `你是个人财务分析师，为月度财务报告撰写结论文案。要求：全部中文；只输出 JSON；数字必须来自用户提供的数据，不得编造；语气客观、具体、可执行。`

const DIM_NAMES = ['储蓄能力', '支出控制', '消费结构', '消费稳定', '记账习惯'] as const

/** 从模型输出中截取 JSON 主体（容忍 ```json 围栏与前后解释文字） */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return body.trim()
  return body.slice(start, end + 1).trim()
}

function fallback(): ReportAiNarrative {
  return {
    overview: '本月分析生成失败，仅展示数据报表。',
    changeFromLastMonth: '',
    insights: [],
    suggestions: [],
    scoreDims: [],
    score: 0,
    failed: true,
  }
}

export class ReportAiService {
  private callModel: ReportModelCaller

  constructor(callModel: ReportModelCaller) {
    this.callModel = callModel
  }

  private buildPrompt(base: ReportBase): string {
    const payload = {
      月份: base.yearMonth,
      收支: base.summary,
      上月: base.prevSummary,
      近6月: base.monthly6,
      本年累计: base.ytd,
      支出分类: base.categories.map((c) => ({ 分类: c.name, 金额: c.amount, 占比: c.percent, 笔数: c.count, 上月金额: c.prev })),
      收入结构: base.incomeStructure.map((c) => ({ 分类: c.name, 金额: c.amount, 占比: c.percent })),
      大额支出: base.topEntries,
      记账行为: base.bookStats,
    }
    return `请根据以下 ${base.yearMonth} 统计数据生成报告文案。

${JSON.stringify(payload, null, 2)}

评分要求：scoreDims 必须恰好 5 项，name 依次为 ${DIM_NAMES.join('、')}；value/prev 为 0-100 的整数；score 为总分（0-100）。
- 储蓄能力：储蓄率越高分越高
- 支出控制：支出环比下降、无异常大额则分高
- 消费结构：分类集中度合理、必要支出占比高则分高
- 消费稳定：每日支出波动越小分越高
- 记账习惯：活跃天数、连续记账天数越多分越高

返回 JSON 结构：
{"overview":"150 字以内月度概述","changeFromLastMonth":"与上月对比一句话，含具体百分比","insights":["发现1","发现2"],"suggestions":[{"text":"建议","prio":"high 或 mid"}],"scoreDims":[{"name":"储蓄能力","value":90,"prev":85}],"score":85}
只返回 JSON，不要任何其他文字。`
  }

  /** 生成文案；失败重试 1 次，仍失败返回降级结构 */
  async buildNarrative(base: ReportBase): Promise<ReportAiNarrative> {
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: this.buildPrompt(base) },
    ]

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const text = await this.callModel(messages)
        const parsed = aiNarrativeSchema.safeParse(JSON.parse(extractJson(text)))
        if (parsed.success) {
          return { ...parsed.data, failed: false }
        }
        logger.warn(`[ReportAI] 第 ${attempt} 次返回结构非法: ${parsed.error.issues[0]?.message ?? '未知'}`)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        logger.warn(`[ReportAI] 第 ${attempt} 次生成失败: ${msg}`)
      }
    }
    return fallback()
  }
}

/** 生产环境实例：DeepSeek 非流式调用 + 30 秒超时 */
export function createReportAiService(): ReportAiService {
  return new ReportAiService(async (messages) => {
    const client = aiConfigService.createClient()
    if (!client) throw new Error('未配置 API Key')
    const ctx: AILogContext = { requestId: newRequestId() }
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI 文案生成超时')), 30000),
    )
    return Promise.race([client.chat(messages, 0.3, ctx), timeout])
  })
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`pnpm test src/main/service/report/reportAiService.test.ts`
预期：PASS，5 个用例通过（注意超时定时器不会阻塞退出，vitest 会自动清理）。

- [ ] **步骤 5：Commit**

```powershell
git add src/main/service/report/reportAiService.ts src/main/service/report/reportAiService.test.ts
git commit -m "feat: 新增报表 AI 文案生成与降级策略"
```

---

## 任务 6：AI 工具扩展

**文件：**
- 修改：`src/main/service/ai/aiToolService.ts:30-120`（工具定义数组末尾）、`:122-132`（executeTool）、文件末尾（私有方法）

- [ ] **步骤 1：注册两个工具定义**

在 `getToolDefs()` 返回数组的 `compare_months` 项之后追加：

```ts
      {
        type: 'function',
        function: {
          name: 'get_monthly_summaries',
          description: '批量获取最近 N 个月的收支汇总，并返回结束月所在年份的 YTD 累计。适用于：分析近半年趋势、计算年度累计储蓄率。',
          parameters: {
            type: 'object',
            properties: {
              endYM: { type: 'string', description: '结束月份 YYYY-MM' },
              months: { type: 'integer', description: '向前包含的月份数，默认 6' },
            },
            required: ['endYM'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'compare_category_breakdown',
          description: '按分类对比两个月的支出金额，服务端已算好上月同分类金额，适用于分析某个具体分类的环比变化。',
          parameters: {
            type: 'object',
            properties: {
              currentYM: { type: 'string', description: '当前月份 YYYY-MM' },
              prevYM: { type: 'string', description: '对比月份 YYYY-MM' },
            },
            required: ['currentYM', 'prevYM'],
          },
        },
      },
```

- [ ] **步骤 2：接入执行分支**

在 `executeTool` 的 `switch` 中，`compare_months` 分支之后追加：

```ts
      case 'get_monthly_summaries':
        return JSON.stringify(
          new ReportDataService(this.ledgerId).getMonthlySummaries(
            args.endYM as string,
            (args.months as number) || 6,
          ),
        )
      case 'compare_category_breakdown':
        return JSON.stringify(
          new ReportDataService(this.ledgerId).getCategoryComparison(
            args.currentYM as string,
            args.prevYM as string,
          ),
        )
```

在文件顶部 import 区追加：

```ts
import { ReportDataService } from '../report/reportDataService'
```

- [ ] **步骤 3：验证**

运行：`pnpm test`
预期：PASS，已有测试全部通过（新增分支不破坏既有逻辑）。

手工核对：`pnpm dev` 启动后进入 AI 助手，提问「近半年收支趋势」，观察控制台出现 `[AI Tool] 执行 get_monthly_summaries` 日志。

- [ ] **步骤 4：Commit**

```powershell
git add src/main/service/ai/aiToolService.ts
git commit -m "feat: AI 工具新增批量月度汇总与分类环比"
```

---

## 任务 7：共享样式、格式化与通用页壳

**文件：**
- 创建：`src/renderer/src/components/report/report.css`
- 创建：`src/renderer/src/components/report/reportFormat.ts`
- 创建：`src/renderer/src/components/report/ReportPage.vue`
- 创建：`src/renderer/src/components/report/sections/CoverPage.vue`

- [ ] **步骤 1：迁移样式**

新建 `src/renderer/src/components/report/report.css`，把 `report-template-ultra.html` 第 24~270 行的样式整体复制过来，然后只做以下三处改动：

1. 删除 `.toolbar` 相关的 L34~43（工具栏只在静态 demo 里用）。
2. `* { margin: 0; padding: 0; box-sizing: border-box; }` 改为 `.report-doc * { margin: 0; padding: 0; box-sizing: border-box; }`，避免污染主应用。
3. `body { font-family: ...; background: #E4E7ED; -webkit-print-color-adjust: exact; }` 改为：

```css
.report-doc {
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  color: var(--text-1);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

4. 在文件末尾追加预览与页码相关的补充规则：

```css
/* 主应用预览：页与页之间留白 */
.report-doc .page { margin: 0 auto 18px; }
.report-doc .page:last-child { margin-bottom: 0; }
```

> 保留原文件的 `:root` 变量与 `@page { size: A4; margin: 0 }`，注意 `@media print` 里删除 `.toolbar { display: none }` 一行。

- [ ] **步骤 2：创建格式化与派生工具**

创建 `src/renderer/src/components/report/reportFormat.ts`：

```ts
import type { ReportCategory, ReportDailyPoint, ReportData } from '@shared/types/report'

/** 金额：1,234.5 */
export function fmtMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** 整数金额：1,234 */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('zh-CN')
}

export function fmtPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

/** 2026-10-01 ~ 2026-10-31 · 日常账本 → 2026 年 10 月 · 日常账本 */
export function fmtPeriodLabel(yearMonth: string, ledgerName: string): string {
  const [y, m] = yearMonth.split('-')
  return `${y} 年 ${Number(m)} 月 · ${ledgerName}`
}

/** 环比增长率（%），上月为 0 时返回 null */
export function growthRate(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null
  return Math.round(((cur - prev) / prev) * 1000) / 10
}

/** 前 N 类合计占支出比 */
export function topShare(categories: ReportCategory[], n: number): number {
  return Math.round(categories.slice(0, n).reduce((s, c) => s + c.percent, 0) * 10) / 10
}

/** 工作日/周末日均支出 */
export function weekendStats(daily: ReportDailyPoint[]): { weekdayAvg: number; weekendAvg: number } {
  const weekday = daily.filter((d) => !d.weekend)
  const weekend = daily.filter((d) => d.weekend)
  const avg = (rows: ReportDailyPoint[]) =>
    rows.length ? Math.round((rows.reduce((s, d) => s + d.expense, 0) / rows.length) * 10) / 10 : 0
  return { weekdayAvg: avg(weekday), weekendAvg: avg(weekend) }
}

/** 第 2 页亮点（固定 3 条以内） */
export function buildHighlights(data: ReportData): string[] {
  const out: string[] = []
  if (data.summary.savingsRate >= 30) {
    out.push(`储蓄率 ${fmtPercent(data.summary.savingsRate)}，本月结余 ¥${fmtMoney(data.summary.balance)}`)
  }
  const top = data.categories[0]
  if (top) {
    const g = growthRate(top.amount, top.prev)
    if (g !== null && g <= 0) out.push(`${top.name}环比下降 ${Math.abs(g)}%，主要支出来源得到控制`)
    else out.push(`${top.name}为最大支出分类，共 ¥${fmtMoney(top.amount)}（${fmtPercent(top.percent)}）`)
  }
  if (data.bookStats.activeDays >= 20) out.push(`本月 ${data.bookStats.activeDays} 天有记账，月末连续 ${data.bookStats.streak} 天`)
  return out.slice(0, 3)
}

/** 第 2 页风险（固定 3 条以内） */
export function buildRisks(data: ReportData): string[] {
  const out: string[] = []
  const top = data.categories[0]
  if (top && top.percent >= 35) out.push(`${top.name}占比 ${fmtPercent(top.percent)}，结构偏集中`)
  if (data.summary.expense > data.summary.income && data.summary.income > 0) {
    out.push('本月支出超过收入，出现负结余')
  }
  const g = growthRate(data.summary.expense, data.prevSummary.expense)
  if (g !== null && g > 10) out.push(`总支出环比上升 ${g}%，需关注增长来源`)
  if (data.bookStats.maxDayExpense > 0) {
    const share = Math.round((data.bookStats.maxDayExpense / data.summary.expense) * 1000) / 10
    if (share >= 15) out.push(`${data.bookStats.maxDayDate} 单日支出 ¥${fmtMoney(data.bookStats.maxDayExpense)}，占全月 ${fmtPercent(share)}`)
  }
  return out.slice(0, 3)
}
```

- [ ] **步骤 3：创建通用页壳**

创建 `src/renderer/src/components/report/ReportPage.vue`：

```vue
<template>
  <div class="page">
    <header class="page-head">
      <div class="ph-brand"><span class="dot"></span>个人记账 <span class="sub">月度财务报告</span></div>
      <div class="ph-period">{{ periodLabel }}</div>
    </header>
    <slot />
    <div class="page-footer">
      <span>个人记账 · {{ yearMonth }} 月度财务报告 · AI 辅助生成</span>
      <span>第 {{ pageNo }} 页 / 共 {{ total }} 页</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  yearMonth: string
  periodLabel: string
  pageNo: number
  total: number
}>()
</script>
```

- [ ] **步骤 4：创建封面**

创建 `src/renderer/src/components/report/sections/CoverPage.vue`。模板以 `report-template-ultra.html` 第 282~343 行为蓝本逐行移植（保留全部 class 与装饰 div），仅做以下数据绑定替换：

| 模板中的硬编码 | 替换为 |
|---|---|
| `2026 年 10 月` | `{{ coverLabel }}`，`const coverLabel = computed(() => fmtPeriodLabel(data.yearMonth, '').replace(/ · $/, ''))`，实际直接用 `` `${y} 年 ${m} 月` `` |
| 账本名 `日常账本` | `{{ data.ledgerName }}` |
| 结余 ¥9,283.5 | `¥{{ fmtMoney(data.summary.balance) }}` |
| 储蓄率 50.2% | `{{ fmtPercent(data.summary.savingsRate) }}` |
| 收入 ¥18,500.0 | `¥{{ fmtMoney(data.summary.income) }}` |
| 支出 ¥9,216.5 | `¥{{ fmtMoney(data.summary.expense) }}` |
| YTD 三项 | `data.ytd.income` / `data.ytd.expense` / `data.ytd.savingsRate` |
| 报告编号 `NO. 2026-010` | `NO. {{ data.yearMonth }}` |
| 生成时间 | `{{ data.generatedAt }}` |

脚本部分：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ReportData } from '@shared/types/report'
import { fmtMoney, fmtPercent } from '../reportFormat'

const props = defineProps<{ data: ReportData }>()
const ymd = computed(() => {
  const [y, m] = props.data.yearMonth.split('-')
  return `${y} 年 ${Number(m)} 月`
})
</script>
```

> 封面的 `.page.cover` 自带 `padding: 0`，不要套用 `ReportPage`。

- [ ] **步骤 5：验证无语法错误**

运行：`pnpm build`
预期：BUILD 成功，没有 `Could not resolve` 或 CSS 解析错误。

- [ ] **步骤 6：Commit**

```powershell
git add src/renderer/src/components/report/report.css src/renderer/src/components/report/reportFormat.ts src/renderer/src/components/report/ReportPage.vue src/renderer/src/components/report/sections/CoverPage.vue
git commit -m "feat: 新增报表共享样式与封面页组件"
```

---

## 任务 8：图表组件

**文件：**
- 创建：`src/renderer/src/components/report/charts/useReportChart.ts`
- 创建：`charts/Trend6Chart.vue`、`ParetoChart.vue`、`CompareChart.vue`、`DailyChart.vue`、`RadarChart.vue`

- [ ] **步骤 1：创建图表挂载与就绪等待**

创建 `src/renderer/src/components/report/charts/useReportChart.ts`：

```ts
import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

const mounted = new Set<echarts.ECharts>()

/**
 * 报表图表统一挂载逻辑。
 * 打印三要素：animation: false（否则首次打印可能空白）、devicePixelRatio: 3（清晰度）、渲染完成回执。
 */
export function useReportChart(
  el: Ref<HTMLElement | undefined>,
  data: Ref<unknown>,
  build: () => EChartsOption,
): { render: () => Promise<void> } {
  let chart: echarts.ECharts | null = null

  async function render(): Promise<void> {
    await nextTick()
    if (!el.value) return
    if (!chart) {
      chart = echarts.init(el.value, undefined, { renderer: 'canvas', devicePixelRatio: 3 })
      mounted.add(chart)
    }
    chart.setOption(build(), true)
  }

  onMounted(render)
  watch(data, render, { deep: true })
  onBeforeUnmount(() => {
    if (!chart) return
    mounted.delete(chart)
    chart.dispose()
    chart = null
  })

  return { render }
}

/** 等待全部图表完成绘制（打印前调用）；timeoutMs 为单图兜底超时 */
export async function waitChartsRendered(timeoutMs = 800): Promise<void> {
  await nextTick()
  const charts = [...mounted]
  await Promise.all(
    charts.map(
      (chart) =>
        new Promise<void>((resolve) => {
          let done = false
          const finish = (): void => {
            if (done) return
            done = true
            resolve()
          }
          chart.on('finished', finish)
          setTimeout(finish, timeoutMs)
        }),
    ),
  )
  await new Promise((r) => setTimeout(r, 200))
}
```

- [ ] **步骤 2：创建近 6 月趋势图**

创建 `charts/Trend6Chart.vue`：

```vue
<template>
  <div ref="el" class="chart-box" style="height: 215px"></div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import type { ReportMonthlyPoint } from '@shared/types/report'
import { useReportChart } from './useReportChart'

const props = defineProps<{ points: ReportMonthlyPoint[] }>()
const el = toRef<HTMLDivElement | null>(null) as unknown as import('vue').Ref<HTMLElement | undefined>

const { render } = useReportChart(el, toRef(props, 'points'), () => ({
  animation: false,
  grid: { left: 46, right: 46, top: 42, bottom: 28 },
  tooltip: { trigger: 'axis' },
  legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10.5, color: '#606266' } },
  xAxis: {
    type: 'category',
    data: props.points.map((p) => p.ym),
    axisLine: { lineStyle: { color: '#EBEEF5' } },
    axisTick: { show: false },
    axisLabel: { fontSize: 10.5, color: '#909399' },
  },
  yAxis: [
    {
      type: 'value',
      name: '金额',
      nameTextStyle: { fontSize: 9.5, color: '#909399' },
      splitLine: { lineStyle: { color: '#F2F4F8' } },
      axisLabel: { fontSize: 10, color: '#909399' },
    },
    {
      type: 'value',
      name: '储蓄率%',
      nameTextStyle: { fontSize: 9.5, color: '#909399' },
      splitLine: { show: false },
      axisLabel: { fontSize: 10, color: '#909399' },
    },
  ],
  series: [
    {
      name: '收入',
      type: 'bar',
      barWidth: 14,
      itemStyle: { color: '#67C23A', borderRadius: [3, 3, 0, 0] },
      data: props.points.map((p) => p.income),
    },
    {
      name: '支出',
      type: 'bar',
      barWidth: 14,
      itemStyle: { color: '#FF8C00', borderRadius: [3, 3, 0, 0] },
      data: props.points.map((p) => p.expense),
    },
    {
      name: '储蓄率',
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      symbolSize: 5,
      lineStyle: { width: 2, color: '#409EFF' },
      itemStyle: { color: '#409EFF' },
      data: props.points.map((p) => p.savingsRate),
    },
  ],
}))

defineExpose({ render })
</script>
```

> 其余 4 个图表结构相同：`<div ref="el" class="chart-box" style="height: Npx">` + `useReportChart(el, toRef(props, 'data'), () => option)` + `defineExpose({ render })`。每个图表**必须**带 `animation: false`。

- [ ] **步骤 3：创建帕累托图**

创建 `charts/ParetoChart.vue`，props 为 `{ categories: ReportCategory[] }`，option 关键点（照抄 Ultra `chart-pareto` 配置）：

```ts
const cumArr = (() => {
  let acc = 0
  return props.categories.map((c) => {
    acc += c.percent
    return Math.round(acc * 10) / 10
  })
})()
const crossIdx = cumArr.findIndex((v) => v >= 80)
```

- 柱：`data: props.categories.map(c => c.amount)`，颜色 `#FF8C00`，`barWidth: 26`。
- 折线：`yAxisIndex: 1`，`data: cumArr`，`symbolSize: 5`，颜色 `#409EFF`，标签只标 `dataIndex === 0 || dataIndex === crossIdx || dataIndex === cumArr.length - 1` 三个点。
- 图例 `top: 0, left: 0`，`grid.top: 58`。
- `markLine` 标注 80% 水平线，`yAxis` 右侧 `max: 100`、`axisLabel.formatter: '{value}%'`。

- [ ] **步骤 4：创建分类环比图**

创建 `charts/CompareChart.vue`，props 为 `{ categories: ReportCategory[] }`，取前 6 类：

```ts
const top6 = props.categories.slice(0, 6)
xAxis.data = top6.map((c) => c.name)
series = [
  { name: '本月', type: 'bar', barWidth: 12, itemStyle: { color: '#FF8C00', borderRadius: [3,3,0,0] }, data: top6.map((c) => c.amount) },
  { name: '上月', type: 'bar', barWidth: 12, itemStyle: { color: '#C8D0DA', borderRadius: [3,3,0,0] }, data: top6.map((c) => c.prev) },
]
```

- [ ] **步骤 5：创建每日走势图**

创建 `charts/DailyChart.vue`，props 为 `{ daily: ReportDailyPoint[] }`：

```ts
xAxis.data = props.daily.map((d) => String(d.day))
series = [{
  name: '日支出',
  type: 'line',
  smooth: true,
  symbolSize: 4,
  lineStyle: { width: 2, color: '#FF8C00' },
  itemStyle: { color: '#FF8C00' },
  areaStyle: { color: 'rgba(255,140,0,.12)' },
  data: props.daily.map((d) => d.expense),
  markPoint: {
    symbolSize: 38,
    symbol: 'pin',
    itemStyle: { color: '#E67E00' },
    label: {
      show: true,
      position: 'top',
      distance: 6,
      fontSize: 10,
      fontWeight: 600,
      color: '#E67E00',
      formatter: (p: { value: number }) => '¥' + Math.round(p.value).toLocaleString(),
      backgroundColor: 'rgba(255,255,255,.92)',
      padding: [2, 5],
      borderRadius: 3,
      borderColor: '#FFDDB0',
      borderWidth: 1,
    },
    data: [{ type: 'max', name: '峰值' }],
  },
}]
```

- [ ] **步骤 6：创建雷达图**

创建 `charts/RadarChart.vue`，props 为 `{ dims: ReportScoreDim[] }`：

```ts
radar = { indicator: props.dims.map(d => ({ name: d.name, max: 100 })), radius: '66%', center: ['50%','52%'], axisName: { fontSize: 10.5, color: '#606266' } }
series = [{ type: 'radar', data: [
  { name: '本月', value: props.dims.map(d => d.value), itemStyle: { color: '#FF8C00' }, areaStyle: { color: 'rgba(255,140,0,.18)' } },
  { name: '上月', value: props.dims.map(d => d.prev), itemStyle: { color: '#A0CFFF' }, areaStyle: { color: 'rgba(64,158,255,.10)' } },
], symbolSize: 4 }]
```

- [ ] **步骤 7：Commit**

```powershell
git add src/renderer/src/components/report/charts
git commit -m "feat: 新增报表图表组件与打印就绪等待"
```

---

## 任务 9：执行摘要页与收支总览页

**文件：**
- 创建：`src/renderer/src/components/report/sections/ExecSummaryPage.vue`
- 创建：`src/renderer/src/components/report/sections/CashflowPage.vue`
- 创建：`src/renderer/src/components/report/sections/BudgetSection.vue`

- [ ] **步骤 1：执行摘要页（移植 Ultra 第 345~400 行）**

创建 `ExecSummaryPage.vue`：外层用 `ReportPage`，`page-no="2"`；把 Ultra 第 351~396 行的内容放进默认插槽，保留全部 class。数据绑定：

- `.hero-tag` 文本固定 `本月核心结论`（**必须使用 `hero-tag` 类名，不要再使用 `.tag`**，否则会因全局 `.tag { width:19px }` 竖排）。
- 概述段落：`{{ data.ai.overview }}`。
- 环比句：`{{ data.ai.changeFromLastMonth }}`，`ai.failed` 为 true 时整块以 `v-if` 隐藏。
- 亮点列表：`v-for="item in highlights"`，结构 `<li><i></i><span>{{ item }}</span></li>`。
- 风险列表：`v-for="item in risks"`，结构 `<li><i>!</i><span>{{ item }}</span></li>`，外层 `class="col-card risk"`。
- 关键指标小卡：收入/支出/结余/储蓄率分别绑 `summary` 四个字段，格式用 `fmtMoney` / `fmtPercent`。

脚本：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ReportData } from '@shared/types/report'
import ReportPage from '../ReportPage.vue'
import { buildHighlights, buildRisks, fmtMoney, fmtPercent, fmtPeriodLabel } from '../reportFormat'

const props = defineProps<{ data: ReportData; pageNo: number }>()
const highlights = computed(() => buildHighlights(props.data))
const risks = computed(() => buildRisks(props.data))
const periodLabel = computed(() => fmtPeriodLabel(props.data.yearMonth, props.data.ledgerName))
</script>
```

> `ReportPage` 的 `total` 固定传 `7`。`periodLabel` 在每个页面组件里都按同样方式计算。

- [ ] **步骤 2：预算节（预留、无数据隐藏）**

创建 `BudgetSection.vue`：

```vue
<template>
  <div v-if="data.length" class="sec">
    <div class="sec-title">
      <span class="no">05</span><span class="zh">预算执行</span>
      <span class="en">BUDGET</span><span class="ext">本月预算进度</span>
    </div>
    <div v-for="b in data" :key="b.name" class="budget-row">
      <span class="name">{{ b.name }}</span>
      <span class="track"><i :style="{ width: Math.min(100, (b.amount / b.budget) * 100) + '%' }"></i></span>
      <span class="v">¥{{ fmtMoney(b.amount) }} / ¥{{ fmtMoney(b.budget) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReportBudget } from '@shared/types/report'
import { fmtMoney } from '../reportFormat'

defineProps<{ data: ReportBudget[] }>()
</script>
```

当前 `budgets` 始终为空数组，该节不会渲染，也不占位。

- [ ] **步骤 3：收支总览页（移植 Ultra 第 402~458 行）**

创建 `CashflowPage.vue`：外层 `ReportPage`，`page-no="3"`，插槽内容为 Ultra 第 408~454 行，保留 `.cards` / 收入构成 / `#chart-trend6` 区块顺序，并：

- 四个卡片数字绑 `summary.income`、`summary.expense`、`summary.balance`、`summary.savingsRate`。
- `.sec-title` 的 `.ext` 文案：`对比基准 {{ prevYM }}`（`const prevYM = dayjs(data.yearMonth + '-01').subtract(1,'month').format('YYYY-MM')`；项目已装 dayjs）。
- 收入构成条：`v-for="c in data.incomeStructure"`，宽度 `:style="{ width: c.percent + '%' }"`，标签 `{{ c.name }}`、`{{ fmtPercent(c.percent) }}`。
- 趋势图区块：`<Trend6Chart :points="data.monthly6" />`，图下方插入结论框：

```vue
<div class="chart-concl">
  <span class="k">结论</span>
  <span>{{ trendConclusion }}</span>
</div>
```

```ts
const trendConclusion = computed(() => {
  const list = props.data.monthly6
  if (list.length < 2) return '数据不足，暂无法判断趋势。'
  const last = list[list.length - 1]
  const prev = list[list.length - 2]
  const g = growthRate(last.expense, prev.expense)
  if (g === null) return '上月无支出记录，本月支出为新增支出。'
  return `本月支出较上月${g >= 0 ? '上升' : '下降'} ${Math.abs(g)}%，储蓄率 ${fmtPercent(last.savingsRate)}。`
})
```

- 预算节放在趋势图之后：`<BudgetSection :data="data.budgets" />`。

- [ ] **步骤 4：Commit**

```powershell
git add src/renderer/src/components/report/sections/ExecSummaryPage.vue src/renderer/src/components/report/sections/CashflowPage.vue src/renderer/src/components/report/sections/BudgetSection.vue
git commit -m "feat: 新增报表执行摘要与收支总览页"
```

---

## 任务 10：结构分析页与每日走势页

**文件：**
- 创建：`src/renderer/src/components/report/sections/StructurePage.vue`
- 创建：`src/renderer/src/components/report/sections/DailyPage.vue`

- [ ] **步骤 1：结构分析页（移植 Ultra 第 460~483 行）**

创建 `StructurePage.vue`：外层 `ReportPage`，`page-no="4"`，插槽内容为 Ultra 第 466~479 行（帕累托 + 分类环比），保留所有区块。

- `.sec-title` ext 文案：`前 3 类 ≈ {{ topShare(data.categories, 3) }}% · 帕累托 80/20`。
- 帕累托图：`<ParetoChart :categories="data.categories" />`，下接结论框，`k` 为「结论」：

```ts
const paretoConclusion = computed(() => {
  const list = props.data.categories
  if (!list.length) return '本月无支出记录。'
  const first = list[0]
  const share3 = topShare(list, 3)
  return `${first.name}以 ${fmtPercent(first.percent)} 居首，前三类合计 ${fmtPercent(share3)}；${share3 >= 80 ? '支出高度集中，优先优化头部两三类即可见效。' : '支出相对分散，建议按分类逐个设定上限。'}`
})
```

- 环比图：`<CompareChart :categories="data.categories" />`，结论框文案取支出环比最大的分类：

```ts
const compareConclusion = computed(() => {
  const list = props.data.categories.filter((c) => c.prev > 0)
  if (!list.length) return '上月无同分类支出可对比。'
  const sorted = [...list].sort((a, b) => Math.abs(b.amount - b.prev) - Math.abs(a.amount - a.prev))
  const c = sorted[0]
  const g = growthRate(c.amount, c.prev)
  return `变化最大的是${c.name}，本月 ¥${fmtMoney(c.amount)}，上月 ¥${fmtMoney(c.prev)}（${g! >= 0 ? '+' : ''}${g}%）。`
})
```

- [ ] **步骤 2：每日走势页（移植 Ultra 第 485~512 行）**

创建 `DailyPage.vue`：外层 `ReportPage`，`page-no="5"`，插槽内容为 Ultra 第 491~507 行，保留「每日收支走势 / 消费习惯画像 / 大额支出 TOP 5」三个区块。

- 每日图：`<DailyChart :daily="data.daily" />` + 结论框：

```ts
const dailyConclusion = computed(() => {
  const s = weekendStats(props.data.daily)
  const peak = props.data.bookStats
  if (!props.data.summary.count) return '本月无交易记录。'
  const ratio = s.weekdayAvg > 0 ? Math.round((s.weekendAvg / s.weekdayAvg) * 100) : 0
  return `周末日均支出 ¥${fmtMoney(s.weekendAvg)}，为工作日的 ${ratio}%；峰值出现在 ${peak.maxDayDate}（¥${fmtMoney(peak.maxDayExpense)}）。`
})
```

- 消费习惯画像：保留 Ultra 的工作日/周末对比内容，数值绑 `weekendStats(data.daily)`，`记账天数` 绑 `data.bookStats.activeDays`，`连续记账` 绑 `data.bookStats.streak`，`日均笔数` 绑 `data.bookStats.avgPerDay`。
- TOP 5 表格：`v-for="(e, i) in data.topEntries"`，列依次为 `{{ i + 1 }}`、`{{ e.date }}`、`{{ e.title }}`、`{{ e.category }}`、`¥{{ fmtMoney(e.amount) }}`。

- [ ] **步骤 3：Commit**

```powershell
git add src/renderer/src/components/report/sections/StructurePage.vue src/renderer/src/components/report/sections/DailyPage.vue
git commit -m "feat: 新增报表结构分析与每日走势页"
```

---

## 任务 11：AI 洞察页与建议页

**文件：**
- 创建：`src/renderer/src/components/report/sections/InsightsPage.vue`
- 创建：`src/renderer/src/components/report/sections/ClosingPage.vue`

- [ ] **步骤 1：AI 洞察页（移植 Ultra 第 514~537 行）**

创建 `InsightsPage.vue`：外层 `ReportPage`，`page-no="6"`，插槽内容为 Ultra 第 520~533 行。

- AI 概述：`{{ data.ai.overview }}`；洞察列表：`v-for="(t, i) in data.ai.insights"`，序号沿用 Ultra 的数字徽章 class，文本 `{{ t }}`。
- 评分圆环：中心数字 `{{ data.ai.score }}`，环形进度用 Ultra 的评分环 class，`--p` 变量设为 `data.ai.score`。
- 维度条：`v-for="(d, i) in data.ai.scoreDims"`：

```vue
<div class="dim-row" v-for="(d, i) in data.ai.scoreDims" :key="d.name">
  <span class="name">{{ d.name }}</span>
  <span class="track"><i class="fill" :class="{ blue: i % 2 === 1 }" :style="{ width: d.value + '%' }"></i></span>
  <span class="v">{{ d.value }}<span class="d" :class="d.value >= d.prev ? 'up' : 'down'">{{ d.value >= d.prev ? '+' : '' }}{{ d.value - d.prev }}</span></span>
</div>
```

- 雷达图：`<RadarChart :dims="data.ai.scoreDims" />`。
- `data.ai.failed === true` 时，整个「AI 分析与洞察」区块替换为：

```vue
<div class="ai-overview">本月 AI 文案生成失败（可能是未配置 API Key 或网络异常），数据报表部分不受影响。</div>
```

评分与雷达图上方的 `.ext` 文案：`综合 {{ data.ai.score }} / 100 · 本月 vs 上月`；`failed` 时隐藏该 sec。

- [ ] **步骤 2：建议页（移植 Ultra 第 539~566 行）**

创建 `ClosingPage.vue`：外层 `ReportPage`，`page-no="7"`，插槽内容为 Ultra 第 545~562 行。

- 建议列表：

```vue
<ul class="sugg-list">
  <li v-for="(s, i) in data.ai.suggestions" :key="i" :class="s.prio">
    <span class="idx">{{ String(i + 1).padStart(2, '0') }}</span>
    <span class="txt">{{ s.text }}</span>
    <span class="lv">{{ s.prio === 'high' ? '优先' : '一般' }}</span>
  </li>
</ul>
```

> `.sugg-list li` 的样式沿用 Ultra 中已有的 `li.high` / `li.mid` 结构；若 Ultra 的类名不同（例如 `.p-high`），以 Ultra 实际类名为准，只把「优先级」文本改为计算值。

- 结语块：保留 Ultra `.closing` 结构与文案，`<b>` 中的关键数字绑 `fmtPercent(data.summary.savingsRate)`。
- 附录行（`.appendix .ap-row`）依次绑定：

| 行 | 值 |
|---|---|
| 数据期间 | `{{ data.period }}` |
| 账本 | `{{ data.ledgerName }}` |
| 交易笔数 | `本月 {{ data.summary.count }} 笔 · 上月 {{ data.prevSummary.count }} 笔` |
| 生成时间 | `{{ data.generatedAt }}` |
| 分析引擎 | `DeepSeek（AI 文案）· 本地 SQLite（统计）` |

- `ai.failed` 时建议列表显示单条固定文案：`本月 AI 建议生成失败，请检查 API Key 配置后重新生成报告。`

- [ ] **步骤 3：Commit**

```powershell
git add src/renderer/src/components/report/sections/InsightsPage.vue src/renderer/src/components/report/sections/ClosingPage.vue
git commit -m "feat: 新增报表 AI 洞察与建议页"
```

---

## 任务 12：报表文档拼装与打印页入口

**文件：**
- 创建：`src/renderer/src/components/report/ReportDocument.vue`
- 创建：`src/renderer/report-print.html`
- 创建：`src/renderer/report-print/main.ts`
- 创建：`src/renderer/report-print/PrintRoot.vue`
- 修改：`electron.vite.config.ts:17-43`
- 修改：`tsconfig.web.json:9`、`tsconfig.web.json:15-22`
- 修改：`tsconfig.node.json:2-17`

- [ ] **步骤 1：创建 ReportDocument.vue**

```vue
<template>
  <div class="report-doc">
    <CoverPage :data="data" />
    <ExecSummaryPage :data="data" />
    <CashflowPage :data="data" />
    <StructurePage :data="data" />
    <DailyPage :data="data" />
    <InsightsPage :data="data" />
    <ClosingPage :data="data" />
  </div>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import type { ReportData } from '@shared/types/report'
import './report.css'
import { waitChartsRendered } from './charts/useReportChart'
import CoverPage from './sections/CoverPage.vue'
import ExecSummaryPage from './sections/ExecSummaryPage.vue'
import CashflowPage from './sections/CashflowPage.vue'
import StructurePage from './sections/StructurePage.vue'
import DailyPage from './sections/DailyPage.vue'
import InsightsPage from './sections/InsightsPage.vue'
import ClosingPage from './sections/ClosingPage.vue'

defineProps<{ data: ReportData }>()

/** 打印前调用：等 Vue 更新 → 等 ECharts 渲染完成 → 等字体就绪 */
async function waitRendered(): Promise<void> {
  await nextTick()
  await waitChartsRendered(800)
  await document.fonts.ready
}

defineExpose({ waitRendered })
</script>
```

- [ ] **步骤 2：创建打印页 HTML 入口**

创建 `src/renderer/report-print.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>月度报表打印</title>
    <style>
      html, body { margin: 0; padding: 0; background: #fff; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./report-print/main.ts"></script>
  </body>
</html>
```

- [ ] **步骤 3：创建打印页挂载脚本**

创建 `src/renderer/report-print/main.ts`：

```ts
import { createApp } from 'vue'
import PrintRoot from './PrintRoot.vue'

createApp(PrintRoot).mount('#app')
```

- [ ] **步骤 4：创建打印页根组件**

创建 `src/renderer/report-print/PrintRoot.vue`。数据用「拉取模型」：页面加载后主动向主进程要数据，避免主进程 `did-finish-load` 与渲染进程监听的时序竞争。

```vue
<template>
  <div v-if="data" class="print-root">
    <ReportDocument ref="docRef" :data="data" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { ReportData } from '@shared/types/report'
import ReportDocument from '@/components/report/ReportDocument.vue'

const data = ref<ReportData | null>(null)
const docRef = ref<InstanceType<typeof ReportDocument> | null>(null)

onMounted(async () => {
  const res = await window.reportAPI.getPrintData()
  if (!res || res.code !== 0 || !res.data) return
  data.value = res.data as ReportData
  await nextTick()
  await docRef.value?.waitRendered()
  window.reportAPI.printReady()
})
</script>

<style>
  html,
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
</style>
```

> 此处 `window.reportAPI` 的类型声明要到任务 14 才补齐，因此本任务阶段编辑器会显示红线；`pnpm build` 走 esbuild 不做类型检查，不影响产物验证。

- [ ] **步骤 5：配置 vite 多入口与 `@shared` 别名**

修改 `electron.vite.config.ts` 的 `renderer` 段：

```ts
  renderer: {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: 'src/auto-imports.d.ts'
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts'
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          'report-print': resolve(__dirname, 'src/renderer/report-print.html')
        }
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/styles/variables.scss" as *;`,
          api: 'modern-compiler'
        }
      }
    }
  }
```

> 注意：`report-print.html` 不要放在 `src/renderer/src/` 下，否则会被 `src/**/*.vue` 的 tsconfig include 扫到，且与主入口的 `src/main.ts` 混淆。

- [ ] **步骤 6：调整 tsconfig 以允许引用 shared**

`tsconfig.web.json`：`rootDir` 改为 `"./src"`，`paths` 增加 `@shared`，`include` 增加 shared：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "composite": true,
    "skipLibCheck": true,
    "outDir": "./out",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/renderer/src/*"],
      "@shared/*": ["./src/shared/*"]
    },
    "jsx": "preserve",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": [
    "src/renderer/src/**/*.ts",
    "src/renderer/src/**/*.vue",
    "src/renderer/src/**/*.d.ts",
    "src/shared/**/*.ts"
  ]
}
```

`tsconfig.node.json`：在 `compilerOptions` 中增加（main 端实际用相对路径引用，这里只为 IDE 解析）：

```json
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["./src/shared/*"]
    },
```

- [ ] **步骤 7：构建验证多入口产物**

运行：

```powershell
pnpm build
Test-Path out/renderer/report-print.html
Test-Path out/renderer/index.html
```

预期：两条 `Test-Path` 均输出 `True`；构建过程无 `Could not resolve "@shared/types/report"` 报错。

- [ ] **步骤 8：Commit**

```powershell
git add src/renderer/report-print.html src/renderer/report-print src/renderer/src/components/report/ReportDocument.vue electron.vite.config.ts tsconfig.web.json tsconfig.node.json
git commit -m "feat: 新增报表文档组件与独立打印页入口"
```

---

## 任务 13：PDF 导出服务

**文件：**
- 创建：`src/main/service/report/reportExportService.ts`

- [ ] **步骤 1：创建导出服务**

创建 `src/main/service/report/reportExportService.ts`：

```ts
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { logger } from '../../utils/logger'
import type { ReportData } from '../../../shared/types/report'

/** 打印页启动后主动拉取的数据（拉取模型，避免加载完成时序竞争） */
let pendingData: ReportData | null = null
/** 导出互斥：避免并发开多个隐藏窗口 */
let exporting = false

const READY_TIMEOUT_MS = 15_000

export function getPendingPrintData(): ReportData | null {
  return pendingData
}

export interface ExportResult {
  canceled: boolean
  filePath?: string
}

function loadPrintPage(win: BrowserWindow): Promise<void> {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  return new Promise((resolve, reject) => {
    win.webContents.once('did-fail-load', (_e, code, desc) => reject(new Error(`打印页加载失败: ${code} ${desc}`)))
    win.webContents.once('did-finish-load', () => resolve())
    if (devUrl) {
      void win.loadURL(`${devUrl}/report-print.html`)
    } else {
      void win.loadFile(path.join(__dirname, '../renderer/report-print.html'))
    }
  })
}

function waitPrintReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ipcMain.removeListener('report:print-ready', onReady)
      reject(new Error('打印页渲染超时（15 秒）'))
    }, READY_TIMEOUT_MS)
    const onReady = (): void => {
      clearTimeout(timer)
      resolve()
    }
    ipcMain.once('report:print-ready', onReady)
  })
}

/** 导出月度报表 PDF：隐藏窗口渲染打印页 → 等待就绪回执 → printToPDF → 保存对话框 → 落盘 */
export async function exportReportPdf(data: ReportData, defaultName: string): Promise<ExportResult> {
  if (exporting) throw new Error('已有导出任务在进行中')
  exporting = true
  pendingData = data

  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  try {
    // 先注册监听再加载，避免回执早于监听
    const ready = waitPrintReady()
    await loadPrintPage(win)
    await ready

    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true
    })

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存月度报表',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return { canceled: true }

    await fs.writeFile(filePath, pdf)
    logger.info(`[报表] PDF 已导出: ${filePath} (${pdf.length} 字节)`)
    return { canceled: false, filePath }
  } finally {
    exporting = false
    pendingData = null
    if (!win.isDestroyed()) win.destroy()
  }
}
```

> Electron 的 `printToPDF` 没有 Puppeteer 的 `marginType` / `format` 选项：页边距靠 `margins` + `preferCSSPageSize`，纸张尺寸靠 `pageSize: 'A4'`。`preferCSSPageSize: true` 会让 `@page { size: A4; margin: 0 }` 生效。

- [ ] **步骤 2：类型检查**

运行：

```powershell
npx tsc -p tsconfig.node.json --noEmit --composite false
```

预期：无输出（无类型错误）。若报 `Cannot find module '../../../shared/types/report'`，说明任务 2 的 shared 文件未创建或路径层级算错。

- [ ] **步骤 3：Commit**

```powershell
git add src/main/service/report/reportExportService.ts
git commit -m "feat: 新增报表 PDF 导出服务"
```

---

## 任务 14：报表 IPC 与 preload 桥接

**文件：**
- 创建：`src/main/controller/reportController.ts`
- 修改：`src/main/index.ts:4-8`、`src/main/index.ts:188-193`
- 修改：`src/preload/index.ts:177-199`
- 修改：`src/preload/index.d.ts:22-31`、`src/preload/index.d.ts:194-210`
- 修改：`src/renderer/src/env.d.ts:28-36`、`src/renderer/src/env.d.ts:200-210`

- [ ] **步骤 1：创建报表控制器**

创建 `src/main/controller/reportController.ts`：

```ts
import { ipcMain } from 'electron'
import { ReportDataService } from '../service/report/reportDataService'
import { createReportAiService } from '../service/report/reportAiService'
import { exportReportPdf, getPendingPrintData } from '../service/report/reportExportService'
import { logger } from '../utils/logger'
import type { ReportData } from '../../../shared/types/report'

/** 确定性统计走 SQL，解读文案走 AI，合并为完整 ReportData */
async function buildReport(yearMonth: string, ledgerId: number): Promise<ReportData> {
  const base = new ReportDataService(ledgerId).buildBase(yearMonth)
  const ai = await createReportAiService().buildNarrative(base)
  return { ...base, ai }
}

export function registerReportController(): void {
  ipcMain.handle('report:generate', async (_event, params: { yearMonth: string; ledgerId: number }) => {
    const { yearMonth, ledgerId } = params
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      return { code: -1, data: null, msg: '月份格式应为 YYYY-MM' }
    }
    if (!Number.isInteger(ledgerId) || ledgerId <= 0) {
      return { code: -1, data: null, msg: '账本 ID 非法' }
    }
    try {
      const data = await buildReport(yearMonth, ledgerId)
      return { code: 0, data, msg: 'ok' }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[报表] 生成失败: ${msg}`)
      return { code: -1, data: null, msg: `生成失败: ${msg}` }
    }
  })

  /** data 由渲染层传入时直接复用预览结果，避免重复调用 AI */
  ipcMain.handle(
    'report:export',
    async (_event, params: { yearMonth: string; ledgerId: number; data?: ReportData }) => {
      const { yearMonth, ledgerId, data: cached } = params
      if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
        return { code: -1, data: null, msg: '月份格式应为 YYYY-MM' }
      }
      try {
        const data = cached ?? (await buildReport(yearMonth, ledgerId))
        const result = await exportReportPdf(data, `月度报表_${yearMonth}.pdf`)
        return { code: 0, data: result, msg: 'ok' }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        logger.error(`[报表] 导出失败: ${msg}`)
        return { code: -1, data: null, msg: `导出失败: ${msg}` }
      }
    }
  )

  /** 打印页启动后拉取待渲染数据 */
  ipcMain.handle('report:print-data', () => {
    return { code: 0, data: getPendingPrintData(), msg: 'ok' }
  })
}
```

- [ ] **步骤 2：在主进程注册控制器**

修改 `src/main/index.ts`：在 import 区加一行

```ts
import { registerReportController } from './controller/reportController'
```

在 `registerSettingsController()` 之后加一行：

```ts
  registerReportController()
```

- [ ] **步骤 3：preload 暴露 reportAPI**

修改 `src/preload/index.ts`，在 `settingsAPI` 的 `exposeInMainWorld` 之前插入：

```ts
contextBridge.exposeInMainWorld('reportAPI', {
  /** 生成报表数据（含 AI 文案） */
  generate: (params: { yearMonth: string; ledgerId: number }) =>
    ipcRenderer.invoke('report:generate', params),

  /** 导出 PDF；传 data 时复用预览结果，不重复调用 AI */
  exportPdf: (params: { yearMonth: string; ledgerId: number; data?: unknown }) =>
    ipcRenderer.invoke('report:export', params),

  /** 打印页：拉取待渲染数据 */
  getPrintData: () => ipcRenderer.invoke('report:print-data'),

  /** 打印页：通知主进程「已渲染完成」 */
  printReady: () => { ipcRenderer.send('report:print-ready') }
})
```

- [ ] **步骤 4：补充类型声明**

`src/preload/index.d.ts`：在 `interface SettingsAPI` 之后新增，并在 `declare global` 的 `Window` 中加入 `reportAPI: ReportAPI`：

```ts
interface ReportAPI {
  generate(params: { yearMonth: string; ledgerId: number }): Promise<ApiResponse<unknown>>
  exportPdf(params: { yearMonth: string; ledgerId: number; data?: unknown }): Promise<ApiResponse<{ canceled: boolean; filePath?: string }>>
  getPrintData(): Promise<ApiResponse<unknown>>
  printReady(): void
}
```

`src/renderer/src/env.d.ts`：同样在 `declare global` 的 `Window` 中加入 `reportAPI: ReportAPI`，并在文件末尾（`interface SettingsAPI` 之后）新增同一份 `ReportAPI` 接口定义。

- [ ] **步骤 5：类型检查**

运行：

```powershell
npx tsc -p tsconfig.node.json --noEmit --composite false
pnpm build
```

预期：两条命令均无类型错误；`pnpm build` 成功产出 `out/main/index.js`。

- [ ] **步骤 6：Commit**

```powershell
git add src/main/controller/reportController.ts src/main/index.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/env.d.ts
git commit -m "feat: 新增报表生成与导出 IPC 及 preload 桥接"
```

---

## 任务 15：主应用报表页与导航

**文件：**
- 创建：`src/renderer/src/views/ReportView/index.vue`
- 修改：`src/renderer/src/App.vue:61-68`（viewLoaders）、`src/renderer/src/App.vue:70-75`（defineAsyncComponent）、`src/renderer/src/App.vue:81-107`（navItems）、`src/renderer/src/App.vue:42-47`（模板 v-if）、`src/renderer/src/App.vue:127-134`（后台预加载）

- [ ] **步骤 1：创建 ReportView**

创建 `src/renderer/src/views/ReportView/index.vue`：

```vue
<template>
  <div class="report-view">
    <div class="report-toolbar">
      <div class="tb-left">
        <span class="tb-title">月度财务报表</span>
        <el-date-picker
          v-model="yearMonth"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择月份"
          :clearable="false"
          style="width: 140px"
        />
        <el-button type="primary" :loading="loading" @click="generate">生成报表</el-button>
        <el-button :disabled="!data" :loading="exporting" @click="exportPdf">导出 PDF</el-button>
      </div>
      <div class="tb-right">
        <span class="tb-hint">预览缩放</span>
        <el-slider v-model="zoomPercent" :min="40" :max="110" :step="5" style="width: 140px" />
        <span class="tb-zoom">{{ zoomPercent }}%</span>
      </div>
    </div>

    <div class="report-stage">
      <div v-if="data" class="report-zoom" :style="{ zoom: zoomPercent / 100 }">
        <ReportDocument :data="data" />
      </div>
      <el-empty v-else description="选择月份后点击「生成报表」" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import type { ReportData } from '@shared/types/report'
import { useLedgerStore } from '@/stores/ledgerStore'
import ReportDocument from '@/components/report/ReportDocument.vue'

const ledgerStore = useLedgerStore()
const yearMonth = ref(dayjs().format('YYYY-MM'))
const loading = ref(false)
const exporting = ref(false)
const data = ref<ReportData | null>(null)
const zoomPercent = ref(70)

async function generate(): Promise<void> {
  loading.value = true
  try {
    const res = await window.reportAPI.generate({
      yearMonth: yearMonth.value,
      ledgerId: ledgerStore.currentId.value
    })
    if (res.code !== 0) {
      ElMessage.error(res.msg)
      return
    }
    data.value = res.data as ReportData
  } finally {
    loading.value = false
  }
}

async function exportPdf(): Promise<void> {
  exporting.value = true
  try {
    const res = await window.reportAPI.exportPdf({
      yearMonth: yearMonth.value,
      ledgerId: ledgerStore.currentId.value,
      data: data.value ?? undefined
    })
    if (res.code !== 0) {
      ElMessage.error(res.msg)
      return
    }
    if (res.data?.canceled) return
    ElMessage.success(`已导出：${res.data?.filePath ?? ''}`)
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped lang="scss">
.report-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #E4E7ED;
}

.report-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid $color-border-light;
  flex: none;
}

.tb-left,
.tb-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tb-title {
  font-size: 15px;
  font-weight: 600;
  color: $color-text-primary;
}

.tb-hint,
.tb-zoom {
  font-size: 12px;
  color: $color-text-muted;
}

.report-stage {
  flex: 1;
  overflow: auto;
  padding: 24px 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.report-zoom {
  flex: none;
}
</style>
```

> `.report-zoom` 用 CSS `zoom` 而非 `transform: scale()`：`zoom` 会改变布局尺寸，滚动区域高度才正确；`transform` 会留下原始尺寸的空白。

- [ ] **步骤 2：App.vue 增加导航与视图**

在 `viewLoaders` 中增加：

```ts
  ReportView: () => import('./views/ReportView/index.vue'),
```

在 `defineAsyncComponent` 区增加：

```ts
const ReportView = defineAsyncComponent(viewLoaders.ReportView)
```

在模板的 `StatisticsView` 之后增加：

```vue
            <ReportView v-if="activeNav === 'report'" />
```

在 `navItems` 的 `statistics` 之后插入：

```ts
  {
    key: 'report',
    label: '月度报表',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>'
  },
```

在 `onMounted` 的后台预加载列表中加入：

```ts
    viewLoaders.ReportView()
```

- [ ] **步骤 3：类型检查与构建**

运行：

```powershell
pnpm build
```

预期：构建成功，无 `Failed to resolve import "@/components/report/ReportDocument.vue"` 报错。若报 shared 类型无法解析，回到任务 12 步骤 6 检查 `tsconfig.web.json` 的 `rootDir` 与 `include`。

- [ ] **步骤 4：Commit**

```powershell
git add src/renderer/src/views/ReportView/index.vue src/renderer/src/App.vue
git commit -m "feat: 新增月度报表页面与侧栏入口"
```

---

## 任务 16：端到端验证

**文件：** 无新增（纯验证，发现问题回到对应任务修复）

- [ ] **步骤 1：开发模式启动**

运行：

```powershell
pnpm dev
```

预期：应用启动，侧栏出现第 5 个图标（月度报表），主窗口无白屏。

- [ ] **步骤 2：生成与预览**

操作：点击「月度报表」→ 选择有数据的月份（如 `2026-01`）→ 点击「生成报表」。

预期：
- 生成期间按钮 loading，完成后出现 7 页文档；
- 页面顺序：封面 → 执行摘要 → 收支总览 → 结构分析 → 每日走势 → AI 洞察 → 建议与附录；
- 每页高度为 A4 比例，页脚页码 01/07 ~ 07/07；
- 拖动缩放滑块，预览等比缩放且滚动高度同步变化。

- [ ] **步骤 3：逐页内容核对**

| 页 | 检查点 |
|---|---|
| P1 | 期号 `VOL.n` 与「2026 年第 n 期」；YTD 累计收入/支出/储蓄率非空；封面色块深色渐变正常 |
| P2 | 核心结论非竖排；亮点前缀为 `+`、风险前缀为 `!`，文字与图标水平对齐不换行 |
| P3 | 近 6 月趋势图：支出柱 + 收入线 + 储蓄率右轴，三条图例齐全；`图表结论` 框有文字 |
| P4 | 帕累托图例在左上不遮挡 100% 标签；分类表存在「累计占比」列；环比结论框非空 |
| P5 | 每日走势峰值标注在图钉上方且文字完整（不被裁剪）；工作日/周末画像有数值；TOP5 为 5 行 |
| P6 | 雷达图五维正常；评分圆环中心数字与右侧分数一致；维度条进度与数值匹配 |
| P7 | 建议列表每条带优先级徽章；附录 5 行齐全（数据期间/账本/笔数/生成时间/分析引擎） |

- [ ] **步骤 4：导出 PDF**

操作：点击「导出 PDF」→ 在保存对话框选择桌面 → 保存 → 打开生成的 PDF。

预期：
- 保存对话框默认文件名为 `月度报表_YYYY-MM.pdf`；
- 生成的 PDF 恰好 7 页，无空白页、无内容被横向裁切；
- 图表在 PDF 中清晰（不是模糊位图感），柱状图/折线图颜色正常；
- 中文无乱码，字体为微软雅黑；
- 封面为满版深色（背景色被打印，不是白底）；
- 页脚页码连续。

- [ ] **步骤 5：AI 降级验证**

操作：进入「设置」清空 API Key → 回到报表页 → 重新生成。

预期：报表仍能生成；P6「AI 分析与洞察」显示失败提示文案，评分与雷达图区域隐藏；P7 建议列表显示单条固定失败文案；其余页数据正常。验证后恢复 API Key。

- [ ] **步骤 6：并发导出保护**

操作：快速连续点击两次「导出 PDF」。

预期：第二次调用返回错误提示「导出失败: 已有导出任务在进行中」，不出现多个保存对话框叠加。

- [ ] **步骤 7：生产构建路径核对**

运行：

```powershell
pnpm build
Test-Path out/renderer/report-print.html
```

预期：输出 `True`。再运行 `pnpm preview`，重复步骤 2 与步骤 4，确认生产模式下（走 `loadFile` 分支）导出同样成功。

- [ ] **步骤 8：Commit（仅在步骤 2-7 发现问题并修复时执行）**

```powershell
git add -A
git commit -m "fix: 修复报表预览与导出的端到端问题"
```

---

## 自检

**1. 规格覆盖度**

| 规格要求 | 对应任务 |
|---|---|
| 主应用新增独立「月度报表」页 + 生成/导出按钮 | 任务 15 |
| 7 页 Ultra 版式（封面/摘要/总览/结构/每日/洞察/建议） | 任务 11~12 |
| 预算节预留但不展示 | 任务 9（`BudgetSection` v-if 隐藏）、任务 4（`budgets: []`） |
| 确定性统计归代码、解读归 AI | 任务 3、4、5 |
| AI 实时调用 + 一次非流式 + zod 校验 + 重试 1 次 + 降级 | 任务 2、5 |
| 只导出 PDF，Word 留待下期 | 任务 13、16 |
| 独立打印页 `report-print.html`，仅 Vue + ECharts | 任务 12 |
| 隐藏窗口 + `report:print-ready` 15 秒超时 | 任务 13 |
| `printToPDF` A4 / 打印背景 / 零边距 / `preferCSSPageSize` | 任务 13 |
| ECharts `animation:false` + `devicePixelRatio:3` + 渲染回执 | 任务 8、13 |
| 复用预览数据导出，避免重复调用 AI | 任务 14（`data?` 参数） |
| 并发导出保护 | 任务 13 |
| AI 工具补两个数据能力 | 任务 6 |
| 评分维度「预算执行」改为「记账习惯」 | 任务 5（固定 5 维） |

结论：无遗漏章节。

**2. 占位符扫描**

已全文检索「待定 / TODO / 后续实现 / 补充细节 / 添加适当的错误处理 / 类似任务 N」：无命中。所有代码步骤均给出可直接粘贴的完整实现，所有验证步骤均有可执行命令与预期输出。

**3. 类型一致性**

| 符号 | 定义处 | 使用处 | 一致性 |
|---|---|---|---|
| `ReportDataService(ledgerId).buildBase(yearMonth)` | 任务 4 | 任务 14 | ✅ |
| `createReportAiService().buildNarrative(base)` | 任务 5 | 任务 14 | ✅ |
| `exportReportPdf(data, defaultName)` | 任务 13 | 任务 14 | ✅ |
| `getPendingPrintData()` | 任务 13 | 任务 14 | ✅ |
| `ReportDocument` `defineExpose({ waitRendered })` | 任务 12 | 任务 12（PrintRoot） | ✅ |
| `window.reportAPI.getPrintData / printReady` | 任务 14 | 任务 12（PrintRoot） | ✅ |
| `waitChartsRendered(800)` | 任务 8 | 任务 12 | ✅ |
| `ReportData` 路径 `@shared/types/report`（renderer）/ `../../../shared/types/report`（main） | 任务 2 | 任务 12、13、14、15 | ✅ |

**4. Commit 语言**

已确认项目历史为中文 Conventional Commits（`feat: 新增报表 AI 洞察与建议页` 等）。本计划全部 16 条 commit message 均为 `type: 中文描述` 格式，一致。

---

## 执行交接

计划已完成并保存到 `docs/superpowers/plans/2026-11-10-report-export.md`。两种执行方式：

**1. 子代理驱动（推荐）** —— 每个任务调度一个新的子代理，任务间进行审查，快速迭代。必需子技能：`superpowers:subagent-driven-development`。

**2. 内联执行** —— 在当前会话中使用 `executing-plans` 执行任务，批量执行并设有检查点。必需子技能：`superpowers:executing-plans`。
