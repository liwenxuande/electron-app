# 个人记账 (Personal Finance) — Code Wiki

> 基于 Electron 42 + Vue 3 + Element Plus + better-sqlite3 的桌面个人记账应用。

---

## 目录

- [1. 项目概览](#1-项目概览)
- [2. 技术栈](#2-技术栈)
- [3. 项目结构](#3-项目结构)
- [4. 整体架构](#4-整体架构)
  - [4.1 三进程模型](#41-三进程模型)
  - [4.2 主进程四层架构](#42-主进程四层架构)
  - [4.3 数据流](#43-数据流)
- [5. 主进程 (Main Process)](#5-主进程-main-process)
  - [5.1 入口 index.ts](#51-入口-indexts)
  - [5.2 数据库层 db/database.ts](#52-数据库层-dbdatadostypes)
  - [5.3 类型定义 types.ts](#53-类型定义-typests)
  - [5.4 Repository 仓储层](#54-repository-仓储层)
  - [5.5 Service 业务层](#55-service-业务层)
  - [5.6 Controller 控制器层](#56-controller-控制器层)
  - [5.7 日志工具 utils/logger.ts](#57-日志工具-utilsloggerts)
- [6. Preload 预加载层](#6-preload-预加载层)
  - [6.1 桥接脚本 index.ts](#61-桥接脚本-indexts)
  - [6.2 类型声明 index.d.ts](#62-类型声明-indexdts)
- [7. 渲染进程 (Renderer Process)](#7-渲染进程-renderer-process)
  - [7.1 入口 main.ts](#71-入口-maints)
  - [7.2 根组件 App.vue](#72-根组件-appvue)
  - [7.3 Pinia 状态管理](#73-pinia-状态管理)
  - [7.4 页面视图 (Views)](#74-页面视图-views)
  - [7.5 通用组件 (Components)](#75-通用组件-components)
- [8. 数据库设计](#8-数据库设计)
  - [8.1 数据表结构](#81-数据表结构)
  - [8.2 ER 关系图](#82-er-关系图)
  - [8.3 预置数据](#83-预置数据)
- [9. IPC 通信协议](#9-ipc-通信协议)
- [10. 构建与打包](#10-构建与打包)
  - [10.1 开发环境](#101-开发环境)
  - [10.2 构建产物](#102-构建产物)
  - [10.3 打包配置](#103-打包配置)
- [11. 运行方式](#11-运行方式)

---

## 1. 项目概览

**个人记账**是一款桌面端个人财务管理应用，核心功能包括：

| 功能模块 | 说明 |
|---------|------|
| 仪表盘 (Dashboard) | 本月收支 KPI 卡片、最近账单列表、消费分布环形图、快捷操作入口 |
| 账单明细 (Transactions) | 多维度筛选（类型/分类/日期/关键词/账本）、分页表格、新增/编辑/删除 |
| 统计分析 (Statistics) | 时间段/颗粒度切换、ECharts 收支趋势折线图、分类占比饼图、消费排行 |
| 账本管理 (Ledgers) | 多账本 CRUD、默认账本保护、账本切换器、每本统计概览 |
| 分类管理 (Categories) | 收入/支出分类 Tab 切换、行内编辑、增删操作 |
| CSV 导入 | 文件选择、数据预览、智能列映射、自动创建新分类 |
| 用户管理 (Users) | 人员 CRUD、分页搜索（注：此模块已从主导航移除，保留为内部功能） |
| 自定义标题栏 | 无边框窗口、最小化/关闭按钮、拖拽移动 |
| 启动动画 (Splash) | 带 Logo 脉动动画的启动屏，主窗口就绪后关闭 |
| 日志系统 | winston 控制台 + 文件双输出，自动滚动（5MB × 5 份） |

---

## 2. 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 运行框架 | Electron | ^42.4.1 |
| 构建工具 | electron-vite | ^6.0.0-beta.1 |
| 数据库 | better-sqlite3 | ^12.11.1 |
| 写队列 | p-queue | ^8.1.0 |
| 前端框架 | Vue 3 (Composition API + `<script setup>`) | ^3.5.13 |
| UI 组件库 | Element Plus (中文) | ^2.9.7 |
| 图标库 | @element-plus/icons-vue | ^2.3.2 |
| 状态管理 | Pinia | ^2.3.1 |
| 图表库 | ECharts 6 + vue-echarts | ^6.1.0 / ^8.0.1 |
| 时间处理 | dayjs | ^1.11.13 |
| 日志 | winston | ^3.17.0 |
| 打包 | electron-builder | ^26.15.3 |
| 语言 | TypeScript | ^5.7.3 |

---

## 3. 项目结构

```
electron-01/
├── package.json                     # 项目配置、脚本、依赖
├── electron.vite.config.ts          # electron-vite 三进程构建配置
├── electron-builder.yml             # 打包配置（Windows NSIS / macOS DMG）
├── tsconfig.json                    # TS 根配置（引用 node + web）
├── tsconfig.node.json               # 主进程 + preload TS 配置
├── tsconfig.web.json                # 渲染进程 TS 配置
├── .npmrc                           # npm 镜像配置
├── build/                           # 打包资源
│   ├── icon.ico                     # Windows 图标
│   └── icon.icns                    # macOS 图标
├── src/
│   ├── main/                        # ========== 主进程 ==========
│   │   ├── index.ts                 # 入口：生命周期、窗口创建、IPC 注册
│   │   ├── types.ts                 # 共享类型（ApiResponse）
│   │   ├── db/
│   │   │   └── database.ts          # ① DB 底层：单例、WAL、建表、写队列
│   │   ├── repository/              # ② 仓储层：纯 SQL 操作
│   │   │   ├── userRepository.ts
│   │   │   ├── categoryRepository.ts
│   │   │   ├── transactionRepository.ts
│   │   │   └── ledgerRepository.ts
│   │   ├── service/                 # ③ 业务层：校验、事务、返回格式化
│   │   │   ├── userService.ts
│   │   │   ├── categoryService.ts
│   │   │   ├── transactionService.ts
│   │   │   └── ledgerService.ts
│   │   ├── controller/              # ④ 控制器层：IPC handle 注册
│   │   │   ├── userController.ts
│   │   │   ├── categoryController.ts
│   │   │   ├── transactionController.ts
│   │   │   └── ledgerController.ts
│   │   └── utils/
│   │       └── logger.ts            # winston 日志模块
│   ├── preload/                     # ========== 预加载层 ==========
│   │   ├── index.ts                 # contextBridge 暴露安全 API
│   │   └── index.d.ts               # API 类型声明
│   └── renderer/                    # ========== 渲染进程 ==========
│       ├── index.html               # 主页面入口
│       ├── splash.html              # 启动动画页面
│       ├── public/                  # 静态资源
│       │   ├── app-background.jpg   # 应用背景图
│       │   └── dashboard-hero.jpg   # 仪表盘插图
│       └── src/
│           ├── main.ts              # Vue 应用入口
│           ├── App.vue              # 根组件（侧边栏 + 内容区）
│           ├── env.d.ts             # Vue SFC 类型声明
│           ├── stores/              # Pinia 状态管理
│           │   ├── userStore.ts
│           │   ├── categoryStore.ts
│           │   ├── transactionStore.ts
│           │   └── ledgerStore.ts
│           ├── views/               # 页面视图
│           │   ├── DashboardView.vue
│           │   ├── TransactionList.vue
│           │   ├── StatisticsView.vue
│           │   ├── LedgerManager.vue
│           │   └── UserList.vue
│           └── components/          # 通用组件
│               ├── TitleBar.vue
│               ├── BookSwitcher.vue
│               ├── TransactionDialog.vue
│               ├── CsvImportDialog.vue
│               ├── CategoryManagerDialog.vue
│               ├── CategoryTable.vue
│               └── UserDialog.vue
├── docs/                            # 项目文档
├── release/                         # 打包输出目录
└── test.csv                         # CSV 导入测试文件
```

---

## 4. 整体架构

### 4.1 三进程模型

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Electron 应用                                  │
│                                                                              │
│  ┌──────────────────┐   preload (contextBridge)   ┌───────────────────────┐ │
│  │   主进程 (Main)   │ ◄═══════════════════════►  │  渲染进程 (Renderer)  │ │
│  │                   │     ipcMain.handle          │                       │ │
│  │  • 数据库操作      │     ipcRenderer.invoke      │  • Vue 3 应用         │ │
│  │  • 文件系统        │                             │  • Element Plus UI    │ │
│  │  • 系统通知        │                             │  • ECharts 图表       │ │
│  │  • 窗口管理        │                             │  • Pinia 状态管理     │ │
│  └──────────────────┘                             └───────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **主进程 (Main)**: 运行 Node.js 环境，负责数据库、文件系统、系统 API 调用
- **预加载层 (Preload)**: 通过 `contextBridge` 向渲染进程暴露有限安全 API
- **渲染进程 (Renderer)**: 运行 Vue 3 应用，无法直接访问 Node.js API

### 4.2 主进程四层架构

```
渲染进程 (Vue3)              预加载 (preload)              主进程 (main)
┌─────────────────┐    contextBridge     ┌──────────────────────────────┐
│   Views/*.vue   │ ─── ipcRenderer ───► │ ④ controller (IPC注册)      │
│   Components/   │    .invoke()         │ ③ service   (校验+事务)      │
│   stores/       │                      │ ② repository (原生SQL)       │
└─────────────────┘                      │ ① db        (单例+WAL+队列)  │
                                         └──────────────────────────────┘
```

| 层级 | 目录 | 职责 | 设计原则 |
|------|------|------|---------|
| ① db 底层 | `src/main/db/database.ts` | SQLite 连接管理、WAL 模式、建表、p-queue 串行写队列 | 全局单例 |
| ② repository 仓储层 | `src/main/repository/` | 编写原生 SQL，不做业务逻辑 | 依赖注入 DbManager |
| ③ service 业务层 | `src/main/service/` | 参数校验、事务包装、统一 `{code, data, msg}` 返回格式 | 依赖注入 Repository + DbManager |
| ④ controller 控制器层 | `src/main/controller/` | 注册 `ipcMain.handle` 通道，连接渲染进程与 Service | 统一异常捕获 |

### 4.3 数据流

以"新增一笔记账"为例：

```
1. 用户在 TransactionDialog.vue 点击"确认记账"
2. Vue 组件调用 transactionStore.createTransaction(data)
3. Store 通过 window.transactionAPI.createTransaction(data) 发起 IPC
4. preload/index.ts 中 ipcRenderer.invoke('transaction:create', data)
5. 主进程 transactionController.ts 收到请求，调用 service.create(data)
6. service/transactionService.ts 执行参数校验 → dbManager.transaction() 事务写入
7. repository/transactionRepository.ts 执行 INSERT SQL
8. db/database.ts 通过 p-queue 串行写入 SQLite
9. 返回 ApiResponse { code: 0, data: null, msg: '新增成功' }
10. 渲染进程收到响应，刷新列表，显示成功提示
```

---

## 5. 主进程 (Main Process)

### 5.1 入口 index.ts

**文件**: [src/main/index.ts](file:///f:/project/pc_app/electron-01/src/main/index.ts)

**启动顺序**: 初始化数据库 → 注册 IPC 控制器 → 创建渲染窗口

**关键逻辑**:

| 功能 | 说明 |
|------|------|
| Windows 中文乱码修复 | `chcp 65001` + stdout/stderr UTF-8 编码 |
| 应用命名 | `app.setName('个人记账')` + Windows AppUserModelId |
| 单实例锁 | `app.requestSingleInstanceLock()` 防止重复打开 |
| 数据库初始化 | 数据文件存放于 `userData`，生产/开发隔离 |
| 旧数据迁移 | 检测安装目录旧 db 并自动复制到 userData |
| 启动动画 | 400×280 无边框橙色 splash 窗口，至少展示 1.5 秒 |
| 主窗口 | 1100×700 无边框窗口，自定义标题栏 |
| 窗口控制 IPC | minimize / maximize / close / isMaximized / toggleDevTools |
| 最大化状态同步 | maximize/unmaximize 事件通知渲染进程切换图标 |
| 外部链接 | `setWindowOpenHandler` 打开系统浏览器 |

**关键函数**:

```typescript
createSplashWindow(): void  // 创建启动动画窗口
createWindow(): void         // 创建主窗口，注册窗口控制 IPC
```

### 5.2 数据库层 db/database.ts

**文件**: [src/main/db/database.ts](file:///f:/project/pc_app/electron-01/src/main/db/database.ts)

**设计模式**: 全局单例 + 串行写队列

**DbManager 类关键成员**:

| 成员 | 类型 | 说明 |
|------|------|------|
| `instance` | `static DbManager \| null` | 单例实例 |
| `db` | `Database.Database \| null` | better-sqlite3 连接 |
| `writeQueue` | `PQueue` (concurrency=1) | 串行写队列，防止 database is locked |

**关键方法**:

| 方法 | 签名 | 说明 |
|------|------|------|
| `getInstance()` | `static getInstance(): DbManager` | 获取全局单例 |
| `init(dbPath)` | `init(dbPath: string): void` | 创建连接、开启 WAL、建表、预置数据、数据迁移 |
| `getDb()` | `getDb(): Database.Database` | 获取数据库实例（确保已初始化） |
| `run(sql, params)` | `async run(sql, params): Promise<RunResult>` | 写操作（进串行队列） |
| `get<T>(sql, params)` | `get<T>(sql, params): T \| undefined` | 查询单行（只读，不走队列） |
| `all<T>(sql, params)` | `all<T>(sql, params): T[]` | 查询多行（只读，不走队列） |
| `transaction(fn)` | `async transaction<T>(fn): Promise<T>` | 事务包装（进串行队列） |

**数据库迁移**:
- 将旧表名 `"transaction"`（SQL 保留字）重命名为 `transactions`
- 为 transactions 表添加 `ledger_id` 字段

### 5.3 类型定义 types.ts

**文件**: [src/main/types.ts](file:///f:/project/pc_app/electron-01/src/main/types.ts)

```typescript
interface ApiResponse<T = unknown> {
  code: number    // 0 成功, -1 失败
  data: T
  msg: string
}
```

所有 Service 层统一使用此返回格式。

### 5.4 Repository 仓储层

#### 5.4.1 UserRepository

**文件**: [src/main/repository/userRepository.ts](file:///f:/project/pc_app/electron-01/src/main/repository/userRepository.ts)

| 方法 | 说明 |
|------|------|
| `insert(name, phone, address, createTime)` | 新增用户 |
| `selectById(id)` | 根据 ID 查询 |
| `selectList(searchName, page, pageSize)` | 分页 + 模糊搜索 |
| `update(id, name, phone, address)` | 更新用户 |
| `deleteById(id)` | 删除用户 |

#### 5.4.2 CategoryRepository

**文件**: [src/main/repository/categoryRepository.ts](file:///f:/project/pc_app/electron-01/src/main/repository/categoryRepository.ts)

| 方法 | 说明 |
|------|------|
| `selectAll()` | 查询全部分类（按 type + sort_order 排序） |
| `selectByType(type)` | 按类型筛选分类 |
| `selectById(id)` | 根据 ID 查询 |
| `insert(name, type, icon, sortOrder)` | 新增分类 |
| `update(id, name, icon, sortOrder)` | 更新分类 |
| `deleteById(id)` | 删除分类 |
| `findByName(name, type)` | 按名称+类型查找（用于去重和 CSV 导入） |

#### 5.4.3 TransactionRepository

**文件**: [src/main/repository/transactionRepository.ts](file:///f:/project/pc_app/electron-01/src/main/repository/transactionRepository.ts)

| 方法 | 说明 |
|------|------|
| `selectList(filter, page, pageSize)` | 多条件分页查询（JOIN category + ledger） |
| `selectById(id)` | 根据 ID 查询（含分类名和账本名） |
| `insert(...)` | 新增记账记录 |
| `update(...)` | 更新记账记录 |
| `deleteById(id)` | 删除记账记录 |
| `getMonthlyStats(yearMonth)` | 月度收支汇总 |
| `getDailyStats(filter)` | 按日聚合收支趋势 |
| `getCategoryStats(filter, type)` | 按分类聚合消费/收入占比 |

**关键接口**:

```typescript
interface TransactionFilter {
  type?: 'income' | 'expense'
  categoryId?: number
  ledgerId?: number
  startDate?: string
  endDate?: string
  keyword?: string
}
```

#### 5.4.4 LedgerRepository

**文件**: [src/main/repository/ledgerRepository.ts](file:///f:/project/pc_app/electron-01/src/main/repository/ledgerRepository.ts)

| 方法 | 说明 |
|------|------|
| `selectAll()` | 查询全部账本 |
| `selectById(id)` | 根据 ID 查询 |
| `insert(name, description)` | 新增账本 |
| `update(id, name, description)` | 更新账本 |
| `deleteById(id)` | 删除账本 |

### 5.5 Service 业务层

#### 5.5.1 UserService

**文件**: [src/main/service/userService.ts](file:///f:/project/pc_app/electron-01/src/main/service/userService.ts)

| 方法 | 说明 |
|------|------|
| `validateUserInput(data)` | 参数校验：姓名/手机号/地址 |
| `createUser(input)` | 新增用户（事务包裹） |
| `updateUser(id, input)` | 编辑用户（存在性检查 + 事务） |
| `deleteUser(id)` | 删除用户（存在性检查） |
| `getUserList(params)` | 分页查询 |
| `getUserById(id)` | 根据 ID 查询 |

**校验规则**:
- 姓名：非空，不超过 50 字符
- 手机号：`/^1[3-9]\d{9}$/`（11 位，1 开头）
- 地址：非空，不超过 200 字符

#### 5.5.2 CategoryService

**文件**: [src/main/service/categoryService.ts](file:///f:/project/pc_app/electron-01/src/main/service/categoryService.ts)

| 方法 | 说明 |
|------|------|
| `getAllCategories()` | 查询全部 |
| `getCategoriesByType(type)` | 按类型查询 |
| `createCategory(name, type, icon, sortOrder)` | 新增（检查重名） |
| `updateCategory(id, name, icon, sortOrder)` | 更新（存在性检查） |
| `deleteCategory(id)` | 删除（外键约束保护） |

**特殊处理**: 删除分类时若存在外键约束失败，返回友好提示"该分类下有交易记录，无法删除"。

#### 5.5.3 TransactionService

**文件**: [src/main/service/transactionService.ts](file:///f:/project/pc_app/electron-01/src/main/service/transactionService.ts)

| 方法 | 说明 |
|------|------|
| `validateInput(data)` | 参数校验：类型/金额/分类/账本/日期 |
| `create(data)` | 新增记账（事务） |
| `update(id, data)` | 更新记账（事务 + 存在性检查） |
| `delete(id)` | 删除记账 |
| `getList(params)` | 多条件分页查询 |
| `getById(id)` | 根据 ID 查询 |
| `getMonthlyStats(yearMonth)` | 月度统计 |
| `getStats(startDate, endDate, ...)` | 时间段统计（日趋势 + 分类占比） |
| `importCsv(csvText, ledgerId)` | CSV 智能导入 |

**CSV 导入逻辑**:
- 自动识别列头：日期/时间、类型、分类、金额、备注
- 支持中文和英文列名
- 无类型列时通过金额正负推断（正=收入，负=支出）
- 日期格式自动标准化（`/` → `-`，补齐前导零）
- 不存在的分类自动创建
- 整个导入在事务中执行
- 使用 `parseCsvLine()` 支持带引号的 CSV 字段

**校验规则**:
- 类型：必须为 `income` 或 `expense`
- 金额：大于 0
- 分类/账本/日期：必填
- 日期格式：`YYYY-MM-DD`

#### 5.5.4 LedgerService

**文件**: [src/main/service/ledgerService.ts](file:///f:/project/pc_app/electron-01/src/main/service/ledgerService.ts)

| 方法 | 说明 |
|------|------|
| `getAllLedgers()` | 查询全部账本 |
| `createLedger(name, description)` | 新增账本 |
| `updateLedger(id, name, description)` | 更新账本 |
| `deleteLedger(id)` | 删除账本（id=1 默认账本不可删除） |

### 5.6 日志工具 utils/logger.ts

**文件**: [src/main/utils/logger.ts](file:///f:/project/pc_app/electron-01/src/main/utils/logger.ts)

基于 winston 的日志模块，同时输出到控制台和本地文件。

| 导出 | 说明 |
|------|------|
| `logger` | winston Logger 实例（控制台立即可用） |
| `initFileTransport()` | 延迟初始化文件日志（需在 `app.whenReady()` 后调用） |

**配置**:
- 级别: `info`
- 格式: `[YYYY-MM-DD HH:mm:ss] [LEVEL] message`
- 文件: `userData/logs/app.log`，最大 5MB，保留 5 份

---

## 6. Preload 预加载层

### 6.1 桥接脚本 index.ts

**文件**: [src/preload/index.ts](file:///f:/project/pc_app/electron-01/src/preload/index.ts)

通过 `contextBridge.exposeInMainWorld` 向渲染进程暴露 4 个 API 对象：

| API 对象 | IPC 通道前缀 | 功能 |
|----------|-------------|------|
| `window.userAPI` | `user:*` / `window:*` / `notification:*` | 用户 CRUD、窗口控制、系统通知 |
| `window.categoryAPI` | `category:*` | 分类 CRUD |
| `window.transactionAPI` | `transaction:*` | 记账 CRUD、统计、CSV 导入 |
| `window.ledgerAPI` | `ledger:*` | 账本 CRUD |

**窗口控制 API** (挂在 `userAPI` 上):

| 方法 | 说明 |
|------|------|
| `minimize()` | 最小化窗口 |
| `maximize()` | 最大化/还原切换 |
| `close()` | 关闭窗口 |
| `isMaximized()` | 查询是否最大化 |
| `onMaximizeChange(callback)` | 监听最大化状态变化 |
| `toggleDevTools()` | 切换开发者工具 |

### 6.2 类型声明 index.d.ts

**文件**: [src/preload/index.d.ts](file:///f:/project/pc_app/electron-01/src/preload/index.d.ts)

为渲染进程提供完整的 TypeScript 类型支持，定义了所有 API 接口和数据结构：

```typescript
interface Window {
  userAPI: UserAPI
  categoryAPI: CategoryAPI
  transactionAPI: TransactionAPI
  ledgerAPI: LedgerAPI
}
```

**关键数据接口**:

| 接口 | 说明 |
|------|------|
| `ApiResponse<T>` | 统一返回格式 `{ code, data, msg }` |
| `UserRow` | 用户数据行 |
| `CategoryRow` | 分类数据行 (type: 'income' \| 'expense') |
| `TransactionRow2` | 交易数据行（含 category_name, ledger_name） |
| `LedgerRow` | 账本数据行 |
| `MonthlyStats` | 月度统计 `{ totalIncome, totalExpense }` |
| `DailyStat` | 每日统计 `{ date, income, expense }` |
| `CategoryStat` | 分类统计 `{ category_id, category_name, type, total }` |
| `StatsData` | 统计汇总 `{ dailyStats, expenseCategoryStats, incomeCategoryStats }` |
| `CsvImportResult` | CSV 导入结果 `{ successCount, failCount, skipCount, errors }` |

---

## 7. 渲染进程 (Renderer Process)

### 7.1 入口 main.ts

**文件**: [src/renderer/src/main.ts](file:///f:/project/pc_app/electron-01/src/renderer/src/main.ts)

**初始化流程**:
1. 注册 ECharts 组件（CanvasRenderer, LineChart, PieChart, Grid/Tooltip/Legend）
2. 创建 Vue 应用
3. 注册全局组件 `v-chart` (vue-echarts)
4. 安装 Element Plus（中文语言包 `zh-cn`）
5. 安装 Pinia
6. 注入 Element Plus 主题色 CSS 变量（橙色主题 `#FF8C00`）

**主题色 CSS 变量**:
```css
--el-color-primary: #FF8C00;
--el-color-primary-light-3: #FFB85C;
--el-color-primary-dark-2: #E07800;
```

### 7.2 根组件 App.vue

**文件**: [src/renderer/src/App.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/App.vue)

**布局结构**:
```
┌─────────────────────────────────────────┐
│  Sidebar (88px) │  Main Area            │
│  ┌───────────┐ │  ┌───────────────────┐ │
│  │ Logo      │ │  │ TitleBar          │ │
│  │           │ │  ├───────────────────┤ │
│  │ 导航:     │ │  │ Content           │ │
│  │ · 仪表盘  │ │  │ (v-if 切换)       │ │
│  │ · 账单明细│ │  │                   │ │
│  │ · 统计分析│ │  │                   │ │
│  │ · 账本管理│ │  │                   │ │
│  │           │ │  │                   │ │
│  │ ──────── │ │  └───────────────────┘ │
│  │ 设置     │ │                        │
│  └───────────┘ │                        │
└─────────────────────────────────────────┘
```

**导航项** (`navItems`):

| key | 标签 | 图标 |
|-----|------|------|
| `dashboard` | 仪表盘 | 四宫格 |
| `transactions` | 账单明细 | 文档 |
| `statistics` | 统计分析 | 柱状图 |
| `ledger` | 账本管理 | 书本 |

**特殊行为**:
- 使用 `v-if` 切换视图（非 `v-show`，切换时重新挂载）
- `onAddRecord`: 切换到账单明细页并打开新建弹窗
- `onImportCsv`: 切换到账单明细页并打开 CSV 导入弹窗
- `Ctrl+Shift+I`: 打开开发者工具

### 7.3 Pinia 状态管理

#### 7.3.1 userStore

**文件**: [src/renderer/src/stores/userStore.ts](file:///f:/project/pc_app/electron-01/src/renderer/src/stores/userStore.ts)

| 状态 | 类型 | 说明 |
|------|------|------|
| `list` | `UserRow[]` | 用户列表 |
| `total` | `number` | 总条数 |
| `currentPage` | `number` | 当前页码 |
| `pageSize` | `number` | 每页条数 (10) |
| `searchName` | `string` | 搜索关键字 |
| `loading` | `boolean` | 加载状态 |

| 操作 | 说明 |
|------|------|
| `fetchUserList()` | 查询用户列表 |
| `createUser(data)` | 新增用户 |
| `updateUser(id, data)` | 编辑用户 |
| `deleteUser(id)` | 删除用户 |
| `search(keyword)` | 搜索（重置到第一页） |
| `goPage(page)` | 切换页码 |

#### 7.3.2 categoryStore

**文件**: [src/renderer/src/stores/categoryStore.ts](file:///f:/project/pc_app/electron-01/src/renderer/src/stores/categoryStore.ts)

| 状态 | 类型 | 说明 |
|------|------|------|
| `list` | `CategoryRow[]` | 全部分类 |
| `expenseCategories` | `CategoryRow[]` | 支出分类 |
| `incomeCategories` | `CategoryRow[]` | 收入分类 |
| `loading` | `boolean` | 加载状态 |

| 操作 | 说明 |
|------|------|
| `fetchAllCategories()` | 查询并拆分收入/支出分类 |
| `createCategory(name, type, icon?)` | 新增分类 |
| `updateCategory(id, name, icon, sortOrder)` | 编辑分类 |
| `deleteCategory(id)` | 删除分类 |

#### 7.3.3 transactionStore

**文件**: [src/renderer/src/stores/transactionStore.ts](file:///f:/project/pc_app/electron-01/src/renderer/src/stores/transactionStore.ts)

| 状态 | 类型 | 说明 |
|------|------|------|
| `list` | `TransactionRow[]` | 记录列表 |
| `total` | `number` | 总条数 |
| `currentPage` | `number` | 当前页 |
| `pageSize` | `number` | 每页条数 (20) |
| `loading` | `boolean` | 加载状态 |
| `filter` | `reactive` | 多维度筛选条件 |
| `monthlyStats` | `MonthlyStats` | 月度收支统计 |

**filter 对象**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `'' \| 'income' \| 'expense'` | 收支类型 |
| `categoryId` | `number \| undefined` | 分类筛选 |
| `ledgerId` | `number \| undefined` | 账本筛选 |
| `startDate` | `string` | 起始日期 |
| `endDate` | `string` | 结束日期 |
| `keyword` | `string` | 关键词搜索 |

| 操作 | 说明 |
|------|------|
| `fetchList()` | 查询列表（带筛选） |
| `createTransaction(data)` | 新增（成功后自动刷新列表+统计） |
| `updateTransaction(id, data)` | 编辑 |
| `deleteTransaction(id)` | 删除 |
| `fetchMonthlyStats(yearMonth?)` | 查询月度统计 |
| `search()` | 重置到第一页并查询 |
| `setLedgerId(id)` | 设置账本筛选并查询 |
| `goPage(page)` | 切换页码 |
| `importCsv(csvText, ledgerId?)` | CSV 导入 |
| `resetFilter()` | 重置所有筛选条件 |

#### 7.3.4 ledgerStore

**文件**: [src/renderer/src/stores/ledgerStore.ts](file:///f:/project/pc_app/electron-01/src/renderer/src/stores/ledgerStore.ts)

| 状态 | 类型 | 说明 |
|------|------|------|
| `list` | `LedgerRow[]` | 账本列表 |
| `currentId` | `number` | 当前选中账本 ID（默认 1） |

| 操作 | 说明 |
|------|------|
| `fetchList()` | 查询全部账本 |
| `setCurrentId(id)` | 切换当前账本 |

### 7.4 页面视图 (Views)

#### 7.4.1 DashboardView — 仪表盘

**文件**: [src/renderer/src/views/DashboardView.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/views/DashboardView.vue)

**布局**:
- Header: 标题 + BookSwitcher + "记一笔"按钮
- KPI 行: 4 张卡片（本月支出 / 本月收入 / 本月结余 / 储蓄率）
- 主区域: 最近账单列表 + 消费分布环形图
- 快捷操作: 4 个快捷按钮（快速记账 / 账单分析 / 账本管理 / 导入账单）

**数据获取**:
- 月度统计通过 `transactionStore.fetchMonthlyStats()`
- 最近 6 条交易通过 `getTransactionList({ page: 1, pageSize: 6, ledgerId })`
- 消费分布通过 `getStats()` 获取 expenseCategoryStats（取前 5 项）
- 监听 `ledgerStore.currentId` 变化自动刷新

**计算属性**:
- `savingsRate`: 储蓄率 = (收入 - 支出) / 收入 × 100
- `expensePieDonut`: SVG 环形图路径数据
- `expensePieLegend`: 图例数据

#### 7.4.2 TransactionList — 账单明细

**文件**: [src/renderer/src/views/TransactionList.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/views/TransactionList.vue)

**布局**:
- Header: 标题 + BookSwitcher + 操作按钮（导入 CSV / 分类管理 / 记一笔）
- Summary Bar: 支出 / 收入 / 笔数汇总
- Filter Bar: 日期选择 + 类型切换 + 搜索框 + 分类标签行
- Table: Element Plus 表格 + 分页

**筛选功能**:
- 类型切换: 全部 / 支出 / 收入（按钮组）
- 日期筛选: `el-date-picker`
- 分类筛选: 药丸标签行（横向滚动，支持鼠标滚轮）
- 关键词搜索: 300ms 防抖

**表格列**:

| 列 | 宽度 | 说明 |
|----|------|------|
| 日期 | 100px | 格式化为 MM-DD |
| 分类 | 140px | 彩色标签 |
| 描述 | min-120px | 溢出省略 |
| 金额 | 130px | 右对齐，收入绿色/支出黑色 |
| 操作 | 110px | 编辑/删除按钮 |

**分页**: 自定义分页组件，显示页码窗口（当前 ± 3 页）

**暴露方法** (供父组件调用):
```typescript
defineExpose({
  openCreateDialog(),  // 打开新建弹窗
  openCsvImport()      // 打开 CSV 导入弹窗
})
```

#### 7.4.3 StatisticsView — 统计分析

**文件**: [src/renderer/src/views/StatisticsView.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/views/StatisticsView.vue)

**时间段切换器**:

| 选项 | 默认颗粒度 | 选择器 |
|------|----------|--------|
| 全部 | 月 | 无 |
| 月 | 日 | 月份选择 |
| 季 | 月 | 季度选择 |
| 年 | 月 | 年份选择 |
| 自定义 | 日 | 日期范围选择 |

**颗粒度切换**: 日 / 月 / 季（控制折线图 X 轴聚合粒度）

**KPI 卡片**: 4 张（平均支出 / 平均收入 / 日均消费 / 储蓄率）

**图表**:
- ECharts 折线图: 收支趋势（双线 + 渐变面积填充）
- ECharts 饼图: 消费分类占比（环形 + 图例 + 中心金额）
- 分类消费排行: 列表 + 进度条 + 百分比

#### 7.4.4 LedgerManager — 账本管理

**文件**: [src/renderer/src/views/LedgerManager.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/views/LedgerManager.vue)

**布局**:
- 默认账本卡片（id=1）: 大卡片展示名称/描述/统计，编辑按钮
- 其他账本: 两列网格布局，每本显示名称/描述/笔数/月消费
- 创建新账本: 虚线边框卡片
- 右键菜单: 编辑/删除（Teleport 到 body）
- 创建/编辑弹窗: Teleport + Modal

**特殊逻辑**:
- 默认账本 (id=1) 不可删除
- 每个账本独立查询统计数据（笔数 + 月消费额）
- TransitionGroup 卡片动画

#### 7.4.5 UserList — 用户管理

**文件**: [src/renderer/src/views/UserList.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/views/UserList.vue)

> 注：此页面已从主导航中移除，保留为内部功能模块。

功能: 搜索 + CRUD 表格 + 分页 + 系统通知测试按钮。

### 7.5 通用组件 (Components)

#### 7.5.1 TitleBar — 自定义标题栏

**文件**: [src/renderer/src/components/TitleBar.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/components/TitleBar.vue)

无边框窗口的标题栏，包含最小化和关闭按钮。支持 `-webkit-app-region: drag` 拖拽移动窗口。

#### 7.5.2 BookSwitcher — 账本切换器

**文件**: [src/renderer/src/components/BookSwitcher.vue](file:///f:/project/pc_app/electron-01/src/renderer/src/components/BookSwitcher.vue)

内联下拉切换器，显示当前账本名，点击弹出账本列表。使用 Teleport 渲染下拉面板，支持选中状态标记。

#### 7.5.3 TransactionDialog — 记账弹窗

**文件**: [src/renderer/src/components/TransactionDialog.vue](file:///f:\project\pc_app\electron-01\src\renderer\src\components\TransactionDialog.vue)

**Props**: `visible`, `mode` ('create' | 'edit'), `editData`

**表单字段**:

| 字段 | 组件 | 说明 |
|------|------|------|
| 类型 | 按钮组 | 支出（红色）/ 收入（绿色） |
| 金额 | 自定义输入 | ¥ 前缀，限制 0~999999.99，自动格式化 2 位小数 |
| 分类 | el-select | 根据类型动态切换收入/支出分类列表 |
| 描述 | input | 文本输入 |
| 日期 | el-date-picker | 默认当天 |
| 备注 | textarea | 可选 |

**编辑模式**: 打开时自动回显数据；新建模式自动聚焦金额输入框。

#### 7.5.4 CsvImportDialog — CSV 导入弹窗

**文件**: [src/renderer/src/components/CsvImportDialog.vue](file:///f:\project\pc_app\electron-01\src\renderer\src\components\CsvImportDialog.vue)

**流程**: 选择文件 → 解析预览（前 5 条） → 确认导入 → 显示结果

支持 el-upload 组件选择 `.csv` 文件，前端解析并预览，调用后端 `importCsv` 接口完成导入。

#### 7.5.5 CategoryManagerDialog — 分类管理弹窗

**文件**: [src/renderer/src/components/CategoryManagerDialog.vue](file:///f:\project\pc_app\electron-01\src\renderer\src\components\CategoryManagerDialog.vue)

**功能**:
- Tab 切换: 支出分类 / 收入分类
- 分类列表: 行内编辑模式（点击编辑图标切换为 input）
- 底部添加: 输入框 + 添加按钮
- 每行: 彩色圆点 + 名称 + 编辑/删除操作

#### 7.5.6 CategoryTable — 分类表格

**文件**: [src/renderer/src/components/CategoryTable.vue](file:///f:\project\pc_app\electron-01\src\renderer\src\components\CategoryTable.vue)

简单的分类展示表格组件（Element Plus el-table），显示名称和编辑/删除操作列。目前未在主流程中使用（被 CategoryManagerDialog 替代）。

#### 7.5.7 UserDialog — 用户弹窗

**文件**: [src/renderer/src/components/UserDialog.vue](file:///f:\project\pc_app\electron-01\src\renderer\src\components\UserDialog.vue)

Element Plus el-dialog + el-form，包含姓名/手机号/地址字段，前端 FormRules 校验 + 后端 Service 层二次校验。

---

## 8. 数据库设计

### 8.1 数据表结构

#### user — 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | 主键 |
| `name` | TEXT | NOT NULL | 姓名 |
| `phone` | TEXT | NOT NULL | 手机号 |
| `address` | TEXT | NOT NULL | 地址 |
| `create_time` | TEXT | NOT NULL, DEFAULT localdatetime | 创建时间 |

#### category — 分类表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | 主键 |
| `name` | TEXT | NOT NULL | 分类名称 |
| `type` | TEXT | NOT NULL, CHECK('income'/'expense') | 收入/支出 |
| `icon` | TEXT | DEFAULT '' | 图标标识 |
| `sort_order` | INTEGER | DEFAULT 0 | 排序权重 |

#### ledger — 账本表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | 主键 |
| `name` | TEXT | NOT NULL | 账本名称 |
| `description` | TEXT | DEFAULT '' | 描述 |
| `create_time` | TEXT | NOT NULL, DEFAULT localdatetime | 创建时间 |

#### transactions — 记账记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PK, AUTOINCREMENT | 主键 |
| `type` | TEXT | NOT NULL, CHECK('income'/'expense') | 收入/支出 |
| `amount` | REAL | NOT NULL | 金额 |
| `category_id` | INTEGER | NOT NULL, FK → category(id) | 分类 |
| `ledger_id` | INTEGER | NOT NULL, DEFAULT 1, FK → ledger(id) | 账本 |
| `trans_date` | TEXT | NOT NULL | 交易日期 |
| `description` | TEXT | DEFAULT '' | 描述 |
| `payment_method` | TEXT | DEFAULT '' | 支付方式 |
| `create_time` | TEXT | NOT NULL, DEFAULT localdatetime | 创建时间 |
| `update_time` | TEXT | NOT NULL, DEFAULT localdatetime | 更新时间 |

### 8.2 ER 关系图

```
┌──────────┐       ┌────────────────┐       ┌──────────┐
│  ledger   │       │  transactions  │       │ category  │
├──────────┤       ├────────────────┤       ├──────────┤
│ id (PK)  │◄──────│ ledger_id (FK) │       │ id (PK)  │
│ name     │       │ id (PK)        │──────►│ name     │
│ desc     │       │ type           │  FK   │ type     │
│ create   │       │ amount         │       │ icon     │
└──────────┘       │ category_id(FK)│       │ sort_order│
                   │ trans_date     │       └──────────┘
                   │ description    │
                   │ payment_method │
                   │ create_time    │
                   │ update_time    │
                   └────────────────┘
                          │
                   ┌──────────┐
                   │   user    │
                   ├──────────┤
                   │ id (PK)  │
                   │ name     │
                   │ phone    │
                   │ address  │
                   │ create   │
                   └──────────┘
```

> 注：`user` 表与 `transactions` 表无直接外键关联，用户模块为独立的辅助功能。

### 8.3 预置数据

**默认账本**: `id=1, name='默认账本', description='系统默认账本'`（通过 `INSERT OR IGNORE` 确保存在）

**默认分类**（共 16 个，仅在分类表为空时插入）:

| 类型 | 分类名称 | 图标 | 排序 |
|------|---------|------|------|
| 支出 | 餐饮、交通、购物、住房、娱乐、医疗、教育、通讯、日用、其他支出 | food/transport/... | 1-10 |
| 收入 | 工资、奖金、兼职、理财、红包、其他收入 | salary/bonus/... | 1-6 |

---

## 9. IPC 通信协议

所有 IPC 通道使用 `ipcMain.handle` / `ipcRenderer.invoke` 模式（异步 Request-Response）。

### User 模块

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `user:list` | `{ searchName?, page?, pageSize? }` | `{ list, total }` | 分页查询 |
| `user:getById` | `id: number` | `UserRow` | 查询单条 |
| `user:create` | `{ name, phone, address }` | `null` | 新增 |
| `user:update` | `id, { name, phone, address }` | `null` | 编辑 |
| `user:delete` | `id: number` | `null` | 删除 |

### Category 模块

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `category:list` | `type?: string` | `CategoryRow[]` | 查询（可按类型筛选） |
| `category:create` | `name, type, icon?, sortOrder?` | `null` | 新增 |
| `category:update` | `id, name, icon, sortOrder` | `null` | 编辑 |
| `category:delete` | `id: number` | `null` | 删除 |

### Transaction 模块

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `transaction:list` | `ListParams` | `{ list, total }` | 多条件分页查询 |
| `transaction:getById` | `id: number` | `TransactionRow2` | 查询单条 |
| `transaction:create` | `TransactionInput` | `null` | 新增 |
| `transaction:update` | `id, TransactionInput` | `null` | 编辑 |
| `transaction:delete` | `id: number` | `null` | 删除 |
| `transaction:monthlyStats` | `yearMonth: string` | `{ totalIncome, totalExpense }` | 月度统计 |
| `transaction:stats` | `startDate, endDate, categoryId?, ledgerId?, keyword?` | `StatsData` | 时间段统计 |
| `transaction:importCsv` | `csvText: string, ledgerId?: number` | `CsvImportResult` | CSV 导入 |

### Ledger 模块

| 通道 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `ledger:list` | 无 | `LedgerRow[]` | 查询全部 |
| `ledger:create` | `name, description?` | `null` | 新增 |
| `ledger:update` | `id, name, description` | `null` | 编辑 |
| `ledger:delete` | `id: number` | `null` | 删除 |

### Window / System 模块

| 通道 | 说明 |
|------|------|
| `window:minimize` | 最小化 |
| `window:maximize` | 最大化/还原 |
| `window:close` | 关闭 |
| `window:isMaximized` | 查询最大化状态 |
| `window:toggleDevTools` | 切换 DevTools |
| `window:maximizeChange` (主→渲染) | 最大化状态变化通知 |
| `notification:show` | 发送系统通知 |

---

## 10. 构建与打包

### 10.1 开发环境

```bash
# 安装依赖（postinstall 自动编译 better-sqlite3）
npm install

# 启动开发服务器（热更新）
npm run dev
```

`npm run dev` 实际执行: `chcp 65001 > nul && set ELECTRON_DISABLE_SANDBOX=1 && electron-vite dev`

### 10.2 构建产物

```bash
# 构建（不打包）
npm run build

# 预览构建产物
npm run preview
```

**输出目录**:

| 目录 | 说明 |
|------|------|
| `out/main/` | 主进程编译产物 (`index.js`) |
| `out/preload/` | 预加载脚本 (`index.mjs`) |
| `out/renderer/` | 渲染进程产物 (`index.html` + `assets/`) |

### 10.3 打包配置

**文件**: [electron-builder.yml](file:///f:/project/pc_app/electron-01/electron-builder.yml)

| 配置项 | 值 |
|--------|-----|
| appId | `com.electron.personal-finance` |
| productName | `个人记账` |
| buildResources | `build/` |
| output | `release/` |

**Windows**:
- 格式: NSIS 安装包 (x64)
- 非一键安装，允许自定义安装目录
- 图标: `build/icon.ico`
- extraResources: `icon.ico` + `splash.html`

**macOS**:
- 格式: DMG (x64 + arm64)
- 图标: `build/icon.icns`

```bash
# Windows 打包
npm run package:win

# macOS 打包
npm run package:mac
```

打包产物输出到 `release/` 目录。

---

## 11. 运行方式

### 环境要求

- **Node.js** >= 18（推荐 >= 22）
- **C++ 编译工具链**（better-sqlite3 原生编译需要）:
  - Windows: 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)，勾选"使用 C++ 的桌面开发"

### 快速启动

```bash
# 1. 克隆项目
git clone <repo-url>
cd electron-01

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev
```

### 数据存储

数据库文件存放在 Electron `userData` 目录（不受软件升级/卸载影响）:

| 模式 | 文件名 | Windows 路径 |
|------|--------|-------------|
| 开发 | `data.dev.db` | `%APPDATA%/personal-finance/data.dev.db` |
| 生产 | `data.db` | `%APPDATA%/personal-finance/data.db` |

### 常见问题

| 问题 | 解决方案 |
|------|---------|
| better-sqlite3 编译失败 | 安装 Visual Studio Build Tools，勾选 C++ 桌面开发 |
| database is locked | 已内置 WAL + p-queue 解决，检查是否多进程访问同一 db |
| Windows 控制台中文乱码 | 已通过 `chcp 65001` 修复 |
| 应用无法启动 | 检查 `postinstall` 是否执行成功（`electron-builder install-app-deps`） |
