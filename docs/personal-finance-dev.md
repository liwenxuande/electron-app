# 个人记账模块 — 开发文档

## 1. 架构概览

本模块在项目既有四层架构上扩展，严格遵循 db → repository → service → controller 的分层规范。

```
渲染进程 (Vue3 + ECharts)       预加载 (preload)              主进程 (main)
┌──────────────────────────┐   contextBridge    ┌──────────────────────────────────┐
│  Views/                   │─── ipcRenderer ──►│ ④ controller                     │
│   TransactionList.vue     │   .invoke()       │    transactionController.ts      │
│   StatisticsView.vue      │                   │    categoryController.ts         │
│                           │                   │                                  │
│  Components/              │                   │ ③ service                        │
│   TransactionDialog.vue   │                   │    transactionService.ts         │
│   CsvImportDialog.vue     │                   │    categoryService.ts            │
│   CategoryTable.vue       │                   │                                  │
│                           │                   │ ② repository                     │
│  Stores/                  │                   │    transactionRepository.ts      │
│   transactionStore.ts     │                   │    categoryRepository.ts         │
│   categoryStore.ts        │                   │                                  │
│                           │                   │ ① db                             │
│                           │                   │    database.ts (单例+WAL+队列)   │
└──────────────────────────┘                   └──────────────────────────────────┘
```

## 2. 文件索引

### 2.1 新增文件

| # | 文件路径 | 层 | 职责 |
|---|---------|---|------|
| 1 | `src/main/repository/categoryRepository.ts` | Repository | 分类表 CRUD + 按类型查询 + 按名称查找 |
| 2 | `src/main/repository/transactionRepository.ts` | Repository | 交易表 CRUD + 分页筛选 + 月度统计 + 每日统计 + 分类统计 |
| 3 | `src/main/service/categoryService.ts` | Service | 分类参数校验 + 事务包裹 + 统一返回格式 |
| 4 | `src/main/service/transactionService.ts` | Service | 交易校验 + 事务 + CSV 解析导入 |
| 5 | `src/main/controller/categoryController.ts` | Controller | 分类 IPC 注册 (4 个通道) |
| 6 | `src/main/controller/transactionController.ts` | Controller | 交易 IPC 注册 (8 个通道) |
| 7 | `src/renderer/src/stores/categoryStore.ts` | Store | 分类状态管理 (Pinia) |
| 8 | `src/renderer/src/stores/transactionStore.ts` | Store | 交易状态管理 + 筛选 + 统计 (Pinia) |
| 9 | `src/renderer/src/views/TransactionList.vue` | View | 交易列表主页（统计卡片+筛选+列表+分页） |
| 10 | `src/renderer/src/views/StatisticsView.vue` | View | 数据统计页（折线图+饼图） |
| 11 | `src/renderer/src/components/TransactionDialog.vue` | Component | 新增/编辑交易弹窗 |
| 12 | `src/renderer/src/components/CsvImportDialog.vue` | Component | CSV 导入弹窗 |
| 13 | `src/renderer/src/components/CategoryTable.vue` | Component | 分类管理表格子组件 |

### 2.2 修改文件

| 文件路径 | 改动说明 |
|---------|---------|
| `src/main/db/database.ts` | 新增 `category` / `transactions` 建表 + 16 条预置分类 + 旧表名自动迁移 |
| `src/main/index.ts` | 注册 `transactionController`、`categoryController` |
| `src/preload/index.ts` | 新增 `categoryAPI` / `transactionAPI` 桥接 |
| `src/preload/index.d.ts` | 新增类型声明 |
| `src/renderer/src/main.ts` | 注册 ECharts 组件和图表模块 |
| `src/renderer/src/App.vue` | 新增左侧导航（记账管理/数据统计/人员管理） |
| `src/renderer/src/env.d.ts` | 补充新 API 类型声明 |
| `package.json` | 新增 `echarts`、`vue-echarts` 依赖 |

## 3. 数据库设计

### 3.1 建表 SQL

```sql
-- category 分类表
CREATE TABLE IF NOT EXISTS category (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('income','expense')),
    icon       TEXT    DEFAULT '',
    sort_order INTEGER DEFAULT 0
);

-- transactions 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT    NOT NULL CHECK(type IN ('income','expense')),
    amount          REAL    NOT NULL,
    category_id     INTEGER NOT NULL,
    trans_date      TEXT    NOT NULL,
    description     TEXT    DEFAULT '',
    payment_method  TEXT    DEFAULT '',
    create_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    update_time     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (category_id) REFERENCES category(id)
);
```

### 3.2 初始数据（16 条预置分类）

```sql
INSERT INTO category (name, type, icon, sort_order) VALUES
('餐饮',   'expense', 'food',           1),
('交通',   'expense', 'transport',       2),
('购物',   'expense', 'shopping',        3),
('住房',   'expense', 'house',           4),
('娱乐',   'expense', 'entertainment',   5),
('医疗',   'expense', 'medical',         6),
('教育',   'expense', 'education',       7),
('通讯',   'expense', 'communication',   8),
('日用',   'expense', 'daily',           9),
('其他支出','expense', 'other-expense',   10),
('工资',   'income',  'salary',          1),
('奖金',   'income',  'bonus',           2),
('兼职',   'income',  'parttime',        3),
('理财',   'income',  'investment',      4),
('红包',   'income',  'redpacket',       5),
('其他收入','income',  'other-income',    6);
```

### 3.3 表名迁移逻辑

`transaction` 是 SQL 保留关键字，实际表名使用 `transactions`。数据库初始化时自动检测并迁移旧表：

```ts
const oldTable = db.prepare(
  "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='transaction'"
).get() as { count: number }

if (oldTable.count > 0) {
  db.exec('ALTER TABLE "transaction" RENAME TO transactions')
  logger.info('数据库迁移：旧表 "transaction" 已重命名为 transactions')
}
```

## 4. IPC 通道设计

### 4.1 Category 相关

| 通道名称 | 方向 | 参数 | 返回 |
|---------|------|------|------|
| `category:list` | renderer→main | `type?: string` | `ApiResponse<CategoryRow[]>` |
| `category:create` | renderer→main | `name, type, icon?, sortOrder?` | `ApiResponse<null>` |
| `category:update` | renderer→main | `id, name, icon, sortOrder` | `ApiResponse<null>` |
| `category:delete` | renderer→main | `id` | `ApiResponse<null>` |

### 4.2 Transaction 相关

| 通道名称 | 方向 | 参数 | 返回 |
|---------|------|------|------|
| `transaction:list` | renderer→main | `{ type?, categoryId?, startDate?, endDate?, keyword?, page?, pageSize? }` | `ApiResponse<PaginatedTransactions>` |
| `transaction:getById` | renderer→main | `id` | `ApiResponse<TransactionRow>` |
| `transaction:create` | renderer→main | `{ type, amount, categoryId, transDate, description?, paymentMethod? }` | `ApiResponse<null>` |
| `transaction:update` | renderer→main | `id, { ... }` | `ApiResponse<null>` |
| `transaction:delete` | renderer→main | `id` | `ApiResponse<null>` |
| `transaction:monthlyStats` | renderer→main | `yearMonth (YYYY-MM)` | `ApiResponse<{totalIncome, totalExpense}>` |
| `transaction:stats` | renderer→main | `startDate, endDate` | `ApiResponse<{dailyStats, expenseCategoryStats, incomeCategoryStats}>` |
| `transaction:importCsv` | renderer→main | `csvText: string` | `ApiResponse<{successCount, failCount, errors[]}>` |

### 4.3 Preload 暴露

渲染进程通过以下方式调用：

```ts
// 交易相关
window.transactionAPI.getTransactionList(params)
window.transactionAPI.getStats(startDate, endDate)
window.transactionAPI.importCsv(csvText)

// 分类相关
window.categoryAPI.getCategoryList(type?)
window.categoryAPI.createCategory(name, type)
```

## 5. 核心业务逻辑

### 5.1 分页筛选 SQL

使用动态 WHERE 子句拼接，支持多条件组合：

```ts
// repository/transactionRepository.ts
selectList(filter, page, pageSize) {
  const conditions = []
  if (filter.type) conditions.push('t.type = ?')
  if (filter.categoryId) conditions.push('t.category_id = ?')
  if (filter.startDate) conditions.push('t.trans_date >= ?')
  if (filter.endDate) conditions.push('t.trans_date <= ?')
  if (filter.keyword) conditions.push('t.description LIKE ?')
  // ... 拼接后带 JOIN category 分页查询
}
```

### 5.2 每日统计 SQL

```sql
SELECT trans_date as date,
       COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
FROM transactions
WHERE trans_date >= ? AND trans_date <= ?
GROUP BY trans_date
ORDER BY trans_date ASC
```

使用 `SUM(CASE WHEN ...)` 在一条 SQL 中同时汇总收入和支出，避免两次查询。

### 5.3 分类占比统计 SQL

```sql
SELECT t.category_id, c.name as category_name, t.type, SUM(t.amount) as total
FROM transactions t
LEFT JOIN category c ON t.category_id = c.id
WHERE t.trans_date >= ? AND t.trans_date <= ? AND t.type = ?
GROUP BY t.category_id
ORDER BY total DESC
```

### 5.4 CSV 解析算法

手动实现 CSV 解析（不依赖第三方库），支持：
- 逗号分隔
- 双引号转义（`""` 表示一个字面引号）
- 跨平台换行（`\r\n` / `\n`）

```ts
private parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (inQuotes) {
      if (ch === '"') { /* 处理转义 */ }
      else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current); current = '' }
      else current += ch
    }
  }
  result.push(current)
  return result
}
```

### 5.5 CSV 导入流程

```
用户选择文件 → FileReader 读取 → IPC 传 CSV 文本
  → 主进程解析表头（自动识别列映射）
  → 逐行校验（日期格式 / 金额 / 类型）
  → 分类自动匹配或创建
  → 事务批量插入
  → 返回 { successCount, failCount, errors[] }
```

## 6. 前端图表

### 6.1 ECharts 集成

在 `src/renderer/src/main.ts` 中按需引入（Tree-shaking）：

```ts
import ECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])
app.component('v-chart', ECharts)
```

### 6.2 折线图配置

- 红色折线 = 支出（带渐变面积）
- 绿色折线 = 收入（带渐变面积）
- Tooltip 显示当日具体金额
- X 轴日期标签旋转 30° 避免重叠

### 6.3 饼图配置

- 环形饼图（`radius: ['40%', '70%']`）
- 图例在左侧垂直排列
- hover 时显示具体金额和百分比

## 7. 踩坑记录

### 7.1 SQL 保留字表名

`transaction` 是 SQL 保留关键字，导致 `better-sqlite3` 查询行为异常（某些 SQL 正常、某些失败）。改名为 `transactions` 并添加自动迁移逻辑。详见 [electron-faq.md](./electron-faq.md#20-sql-保留关键字作表名导致查询失败)。

### 7.2 Preload 热更新不生效

修改 `preload/index.ts` 后需重启 Electron 进程才能加载新的桥接脚本。仅刷新渲染进程（浏览器）是不够的，因为 preload 脚本在主进程创建 BrowserWindow 时就注入了。

### 7.3 ECharts 按需引入

全量引入 ECharts 会导致打包体积增加约 1MB。按需引入 `LineChart` + `PieChart` + 必要组件，打包后仅增加约 500KB。

---

## 8. 性能优化方案（待执行）

> 以下优化方案基于 2026-07-09 性能分析报告，按优先级排列。建议分两批执行。

### 方案一：砍掉昂贵 CSS（立竿见影，约 30 分钟）

#### 8.1 删除 14 处卡片/表格的 `backdrop-filter: blur(8px)`

`backdrop-filter` 是浏览器最昂贵的 CSS 属性之一，要求每个元素被光栅化为独立合成层、对背后区域做模糊采样、再重新合成。项目中有 19 处使用，其中 5 处是弹窗遮罩（保留），14 处是卡片/表格等可滚动元素，需要全部删除。

**涉及文件和选择器：**

| 文件 | 选择器 |
|------|--------|
| `DashboardView.vue` | `.dashboard-kpi-card`、`.dashboard-card`、`.dashboard-quick-btn` |
| `TransactionList.vue` | `.txn-outline-btn`、`.txn-summary-bar`、`.txn-filter-bar`、`.txn-table-card` |
| `StatisticsView.vue` | `.stats-period-toggle`、`.stats-kpi-card`、`.stats-chart-card`、`.stats-rank-card` |
| `LedgerManager.vue` | `.ledger-default-card`、`.ledger-card`、`.ledger-card--create`、`.ledger-menu-pop`（blur 12px） |

**改法：** `background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);` → `background: rgba(255,255,255,0.92);`

#### 8.2 删除 `background-blend-mode: soft-light`

`App.vue` 中 `#app-root` 的 `background-blend-mode: soft-light` 让浏览器对全视口每个像素执行混合运算，持续增加 GPU 开销。

**改法：** 删除 `background-blend-mode: soft-light;` 这一行。背景混合效果可在设计阶段预合成。

#### 8.3 减小弹窗 `box-shadow`

所有 `modal-panel` 的 `box-shadow: 0 20px 60px rgba(0,0,0,0.15)` → `box-shadow: 0 8px 24px rgba(0,0,0,0.12)`

**涉及文件：** `TransactionDialog.vue`、`CategoryManagerDialog.vue`、`CsvImportDialog.vue`、`LedgerManager.vue`

#### 8.4 `transition: all` → 指定属性

全局替换 `transition: all 0.15s` → `transition: background-color 0.15s, color 0.15s, border-color 0.15s`

浏览器在每次状态变化时不再检查所有 CSS 属性，减少不必要的样式计算。

### 方案二：数据库优化 + KeepAlive（长期收益，约 1 小时）

#### 8.5 添加数据库索引

`transactions` 表的 `trans_date`、`category_id`、`ledger_id` 列无任何索引，每次筛选都是全表扫描。

**改法：** 在 `database.ts` 的 init 中添加：

```sql
CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(trans_date);
CREATE INDEX IF NOT EXISTS idx_trans_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_trans_ledger ON transactions(ledger_id);
```

#### 8.6 关闭生产环境 SQL 日志

`DbManager` 中每条 SQL 都以 `logger.info` 写入磁盘，高频查询下 I/O 成为瓶颈。

**改法：** `database.ts` 中 `logger.info(\`[SQL] ...\`)` → 仅在开发模式下记录：`if (!app.isPackaged) logger.info(...)`，生产环境不写磁盘。

#### 8.7 App.vue 加 KeepAlive

`App.vue` 中 4 个视图使用 `v-if` 切换，每次切换都销毁重建，重新拉数据、重新挂 ECharts。

**改法：** 用 `<KeepAlive>` 包裹所有视图组件，切换 Tab 秒切不回掉数据。

#### 8.8 合并 StatisticsView 的 watcher

当前 3 个独立 `watch` 监听 `ledgerStore.currentId`、`period`、`selectedYear`，一次操作可能触发多次 `fetchStats()`。

**改法：** 合并为一个 `watch([ledgerStore.currentId, period, selectedYear], () => fetchStats())`，一次操作只触发一次请求。

#### 8.9 LedgerManager 用 count 接口替代 pageSize: 9999

当前为获取某账本交易笔数，请求了 `pageSize: 9999` 的全量数据。

**改法：** 后端新增 `transaction:count` IPC 通道，前端只发 `SELECT COUNT(*)`，不拉全量数据。
