# 统计分析页面改进设计

**日期：** 2026-07-27  
**状态：** 待评审

---

## 1. 背景

当前 `StatisticsView.vue` 存在以下问题：
1. 月/年选择器使用自定义下拉而不用 Element Plus 组件
2. 默认周期为"季度"，且颗粒度可以大于周期范围（如月视图可选"月"颗粒度）
3. 缺少记账笔数统计
4. 分类消费排行不显示各分类笔数，缺少单笔消费排行
5. 分类排行不可交互，无法查看分类明细

---

## 2. 周期选择器改造

### 2.1 组件对照

| 周期 | 当前实现 | 改为 |
|------|---------|------|
| 月 | `<el-select>` 年月下拉 | `<el-date-picker type="month"` |
| 年 | `<el-select>` 年份下拉 | `<el-date-picker type="year"` |
| 季度 | `<el-select>` Q1-Q4 下拉 | 自定义 `QuarterPicker` 组件 |
| 自定义 | `<el-date-picker type="daterange">` | 不变 |

### 2.2 QuarterPicker 组件

自封装组件，交互：
- 年份显示 + 左右箭头切换年份
- 四个按钮：一季度 ~ 四季度
- 样式与现有 `.stats-period-toggle` 风格一致
- 绑定值格式：`YYYY-QN`（如 `2026-Q3`）

### 2.3 默认值

默认周期从"季度"改为 **"月"**，默认月份为当前月。

---

## 3. 颗粒度联动限制

颗粒度根据当前周期的覆盖范围动态限制，不可超过整体范围：

| 周期 | 可用颗粒度 |
|------|-----------|
| 月 | 仅"日" |
| 季 | "日"、"月" |
| 年 | "日"、"月"、"季" |
| 全部 | "日"、"月"、"季" |
| 自定义 ≤31天 | 仅"日" |
| 自定义 ≤366天 | "日"、"月" |
| 自定义 >366天 | "日"、"月"、"季" |

切换周期时，若当前颗粒度不在可用列表中，自动重置为最小的可用颗粒度。

---

## 4. KPI 行扩展

从 4 个卡片扩为 5 个：

| 卡片 | 标签 | 数值 | 说明 |
|------|------|------|------|
| 支出 | 随周期动态变化 | 总支出 | 原 `kpiExpenseLabel` 移至此 |
| 收入 | 随周期动态变化 | 总收入 | 原 `kpiIncomeLabel` 移至此 |
| 日均 | 日均消费 | 日均金额 | 不变 |
| 储蓄率 | 储蓄率 | 百分比 | 不变 |
| **新增：笔数** | 记账笔数 | 总笔数 | 统计范围内所有交易数量 |

---

## 5. 排行区改造

### 5.1 布局

排行区改为左右两栏：

- **左栏：分类消费排行**（已有），每行新增显示笔数
- **右栏：单笔排行**（新增），支出 top 10 + 收入 top 10

### 5.2 分类消费排行改进

在现有排行基础上，每行增加"X笔"的文字显示：

```
 1 [图标] 餐饮   ¥1,200.50  12笔  ████████▌  35%
```

### 5.3 单笔排行（新增）

支出和收入分别排行，各 top 10：

```
单笔支出排行
 1  ¥1,500.00  购物  2026-07-15
 2  ¥890.00    餐饮  2026-07-20
 ...

单笔收入排行
 1  ¥15,000.00  工资  2026-07-01
 2  ¥3,000.00   兼职  2026-07-10
 ...
```

每行显示：排名、金额、分类名、日期。

---

## 6. 分类明细弹框

### 6.1 触发方式

点击分类消费排行中任意一行 → 弹出明细弹框。

### 6.2 弹框结构

- Teleport 到 body + modal-overlay 结构（参照 `TransactionDialog.vue`）
- 宽度 560px
- 表格列：日期、金额、描述、备注
- 底部汇总：共 X 笔，合计 ¥XXX.XX
- 数据 > 15 条时，表体可滚动（max-height 限制）
- 关闭方式：右上角 X 按钮、底部关闭按钮、点击遮罩层

### 6.3 数据获取

调用 `window.transactionAPI.getTransactionList`，传入分类 ID 和当前时间范围，不分页，一次性获取该分类所有交易。

---

## 7. 数据层变更

### 7.1 后端

**A. 统计接口增强**

`StatsData` 类型新增字段：
```ts
interface StatsData {
  dailyStats: DailyStat[]
  expenseCategoryStats: CategoryStat[]
  incomeCategoryStats: CategoryStat[]
  transactionCount: number               // 新增：总笔数
}

interface CategoryStat {
  category_id: number
  category_name: string
  type: string
  total: number
  count: number  // 新增：该分类的交易笔数
}
```

`getCategoryStats` SQL 改为同时查 total 和 count：
```sql
SELECT t.category_id, c.name as category_name, t.type,
       SUM(t.amount) as total,
       COUNT(*) as count
FROM transactions t
LEFT JOIN category c ON t.category_id = c.id
WHERE ...
GROUP BY t.category_id
ORDER BY total DESC
```

**B. 单笔排行接口（新增）**

新增 `getTopTransactions` 方法，返回支出和收入各 top 10 的单笔交易：

```ts
interface TopTransactions {
  expenseTop: TransactionRow[]   // 支出 top 10，按金额降序
  incomeTop: TransactionRow[]    // 收入 top 10，按金额降序
}
```

SQL：
```sql
SELECT * FROM transactions
WHERE trans_date >= ? AND trans_date <= ? AND type = 'expense' AND ledger_id = ?
ORDER BY amount DESC LIMIT 10
```

### 7.2 前端

排行榜数据结构扩展：
```ts
interface RankItem {
  name: string
  total: number
  count: number   // 新增
  pct: number
  iconBg: string
  iconColor: string
}
```

---

## 8. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/renderer/src/views/StatisticsView.vue` | 修改 | 主要改造 |
| `src/renderer/src/components/QuarterPicker.vue` | 新增 | 季度选择器 |
| `src/renderer/src/components/CategoryDetailDialog.vue` | 新增 | 分类明细弹框 |
| `src/main/repository/transactionRepository.ts` | 修改 | getStats 返回 count 和 transactionCount，新增 getTopTransactions |
| `src/main/service/transactionService.ts` | 修改 | 传递新字段，新增 getTopTransactions |
| `src/main/controller/transactionController.ts` | 修改 | 新增路由 |
| `src/preload/index.ts` + `index.d.ts` | 修改 | 新增 API 暴露 |
| `src/renderer/src/env.d.ts` | 修改 | StatsData / CategoryStat 类型更新 |
