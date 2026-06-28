# Electron 本地人员管理 CRUD 桌面应用 —— 完整实施计划

## 1. 概述

基于 **Electron + electron-vite + Vue3 + Element Plus + better-sqlite3** 构建一套简易本地人员管理桌面应用，实现新增、查询、编辑、删除四大功能。严格遵循 **db → repository → service → controller** 四层后端分层架构，IPC 通信全走 contextBridge 安全桥接。

---

## 2. 当前状态分析

- 工作目录 `f:\project\pc_app\electron-01\` 为空目录，从零搭建。
- 无现有代码、配置、或约定可参考。
- Windows 环境，需注意 better-sqlite3 原生模块编译兼容问题。
- 完整从 scratch 生成全部文件。

---

## 3. 目标目录结构

```
electron-01/
├── package.json                         # 依赖 + 脚本
├── electron-builder.yml                 # 打包配置
├── tsconfig.json                        # 根 TS 配置
├── tsconfig.node.json                   # 主进程 TS 配置
├── tsconfig.web.json                    # 渲染进程 TS 配置
├── electron.vite.config.ts              # electron-vite 构建配置
├── src/
│   ├── main/
│   │   ├── index.ts                     # ⭐ 主进程入口：创建窗口 + 注册所有IPC + 初始化DB
│   │   ├── db/
│   │   │   └── database.ts              # ① DB底层：单例连接、建表、WAL、通用CRUD、p-queue写队列
│   │   ├── repository/
│   │   │   └── userRepository.ts        # ② 仓储层：User表原生SQL（insert/selectById/selectList/update/delete）
│   │   ├── service/
│   │   │   └── userService.ts           # ③ 业务层：参数校验、事务包装、格式化、writeQueue入队
│   │   ├── controller/
│   │   │   └── userController.ts        # ④ 控制器层：ipcMain.handle注册、异常捕获、统一返回
│   │   └── utils/
│   │       └── logger.ts                # winston日志模块
│   ├── preload/
│   │   ├── index.ts                     # contextBridge暴露安全API
│   │   └── index.d.ts                   # API类型声明
│   └── renderer/
│       ├── index.html                   # HTML入口
│       └── src/
│           ├── main.ts                  # Vue3应用入口
│           ├── App.vue                  # 根组件
│           ├── env.d.ts                 # 渲染进程类型声明
│           ├── stores/
│           │   └── userStore.ts         # Pinia Store：用户列表、分页、CRUD封装
│           ├── components/
│           │   └── UserDialog.vue       # 新增/编辑弹窗组件
│           └── views/
│               └── UserList.vue         # 列表主页面：表格+搜索+分页
```

---

## 4. 文件编写计划（按顺序）

### 4.1 package.json

- **name**: `electron-crud-app`
- **main**: `./out/main/index.js`（electron-vite 编译产物目录）
- **scripts**: dev / build / preview / postinstall
- **dependencies**: electron, better-sqlite3, p-queue, dayjs, winston, electron-rebuild
- **devDependencies**: electron-vite, @vitejs/plugin-vue, vue, element-plus, pinia, typescript, electron-builder, @types/better-sqlite3 等

### 4.2 构建配置文件

- `electron-builder.yml`: 标准 electron-builder 配置，exe/nsis 目标
- `tsconfig.json / tsconfig.node.json / tsconfig.web.json`: 标准三件套
- `electron.vite.config.ts`: 区分 main/preload/renderer 三通道

### 4.3 主进程 (src/main/)

#### 4.3.1 `src/main/utils/logger.ts`
- winston 创建 logger 实例
- 输出到控制台 + 本地文件 `logs/app.log`

#### 4.3.2 `src/main/db/database.ts` —— ① DB底层
- **类**: `Database`（单例模式, `static getInstance()`）
- **初始化方法**: `init()`
  - 创建 `better-sqlite3` 连接（路径: `app.getPath('userData')/data.db`）
  - 执行 `PRAGMA journal_mode=WAL;` 开启 WAL
  - 执行建表 SQL: `CREATE TABLE IF NOT EXISTS user (...)`
- **写队列**: 使用 `p-queue` 实例（concurrency=1）串行化所有写入操作
- **通用方法**:
  - `run(sql, params)` → 走 writeQueue
  - `get(sql, params)` → 只读查询
  - `all(sql, params)` → 只读查询多行
  - `transaction(fn)` → 事务包装（走 writeQueue）
- **连接**: 全局唯一单例 instance

#### 4.3.3 `src/main/repository/userRepository.ts` —— ② 仓储层
- `insert(name, phone, address, createTime)`: `INSERT INTO user (...) VALUES (...)`
- `selectById(id)`: `SELECT * FROM user WHERE id = ?`
- `selectList(searchName, page, pageSize)`: 分页 + 模糊搜索 LIKE，返回 `{list, total}`
- `update(id, name, phone, address)`: `UPDATE user SET ... WHERE id = ?`
- `deleteById(id)`: `DELETE FROM user WHERE id = ?`

#### 4.3.4 `src/main/service/userService.ts` —— ③ 业务层
- **参数校验函数**: `validateUserInput(data)` → 检查 name 非空且长度 ≤50, phone 格式 `1[3-9]\d{9}`, address 非空且长度 ≤200
- **写操作**:
  - `createUser(data)` → 校验 → 事务 { insert }
  - `updateUser(data)` → 校验 → 先查存在性 → 事务 { update }
  - `deleteUser(id)` → 先查存在性 → delete
- **读操作**:
  - `getUserList(params)` → selectList
  - `getUserById(id)` → selectById
- **统一返回**: `{code: 0|-1, data: any, msg: string}`
- 所有写入操作通过 `Database.writeQueue.add()` 入队

#### 4.3.5 `src/main/controller/userController.ts` —— ④ 控制器层
- 函数 `registerUserController()`:
  - `ipcMain.handle('user:list', async (_event, params) => {...})`
  - `ipcMain.handle('user:create', async (_event, data) => {...})`
  - `ipcMain.handle('user:update', async (_event, data) => {...})`
  - `ipcMain.handle('user:delete', async (_event, id) => {...})`
- 每个 handle 内 try-catch，调用 Service，统一包装返回

#### 4.3.6 `src/main/index.ts` —— 主入口
- `app.whenReady()`:
  1. `Database.getInstance().init()` 初始化DB
  2. `registerUserController()` 注册IPC
  3. 创建 BrowserWindow（加载 dev/preview URL）
- 窗口关闭、macOS activate 等标准处理

### 4.4 预加载 (src/preload/)

#### 4.4.1 `src/preload/index.ts`
- `contextBridge.exposeInMainWorld('userAPI', {...})`:
  - `getUserList(params): Promise<...>`
  - `createUser(data): Promise<...>`
  - `updateUser(data): Promise<...>`
  - `deleteUser(id): Promise<...>`
- 每个方法内部调用 `ipcRenderer.invoke('user:xxx', ...)`

#### 4.4.2 `src/preload/index.d.ts`
- 声明 `window.userAPI` 类型

### 4.5 渲染进程 (src/renderer/)

#### 4.5.1 `src/renderer/index.html`
- 标准 HTML5 模板，`<div id="app">` 挂载点

#### 4.5.2 `src/renderer/src/main.ts`
- `createApp(App).use(ElementPlus).use(createPinia()).mount('#app')`

#### 4.5.3 `src/renderer/src/App.vue`
- 根组件，直接渲染 `<UserList />`

#### 4.5.4 `src/renderer/src/env.d.ts`
- 声明 `*.vue` 模块类型
- 引入 `window.userAPI` 类型

#### 4.5.5 `src/renderer/src/stores/userStore.ts` —— Pinia Store
- **state**: `list[]`, `total`, `currentPage`, `pageSize`, `searchName`, `loading`
- **actions**:
  - `fetchUserList()` → 调用 `window.userAPI.getUserList()`
  - `createUser(data)` → 调用 `window.userAPI.createUser()`
  - `updateUser(data)` → 调用 `window.userAPI.updateUser()`
  - `deleteUser(id)` → 调用 `window.userAPI.deleteUser()`
- 前端参数校验（element-plus 表单 rules）

#### 4.5.6 `src/renderer/src/views/UserList.vue` —— 列表页面
- Element Plus `<el-table>` 展示数据（id, name, phone, address, createTime）
- `<el-pagination>` 分页组件
- 搜索框 + 搜索按钮（模糊搜索姓名）
- "新增"按钮 → 打开 UserDialog（mode='create'）
- "编辑"按钮 → 打开 UserDialog（mode='edit', 传入row数据）
- "删除"按钮 → `ElMessageBox.confirm` 二次确认 → 调用删除
- 操作列在表格最右侧

#### 4.5.7 `src/renderer/src/components/UserDialog.vue` —— 新增/编辑弹窗
- `<el-dialog>` 弹窗
- `<el-form>` 含 name(姓名)、phone(手机号)、address(地址) 三个字段
- 表单校验: name必填≤50, phone必填正则, address必填≤200
- Props: `visible: boolean, mode: 'create'|'edit', editData: object | null`
- Emits: `update:visible`, `success`

---

## 5. 数据流 & IPC 通信流程

```
渲染进程 (Vue3)                 预加载                        主进程
UserList.vue           preload/index.ts         main/index.ts
    |                       |                       |
    |-- userAPI.getList() ->|-- ipcRenderer.invoke ->|-- ipcMain.handle('user:list')
    |                       |     ('user:list')      |       |
    |                       |                       |    controller
    |                       |                       |       |
    |                       |                       |    service
    |                       |                       |       |
    |                       |                       |    repository
    |                       |                       |       |
    |                       |                       |    database (better-sqlite3)
    |<-- Promise<result> ---|<-- result ------------|<------|
```

---

## 6. 关键设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 数据库路径 | `app.getPath('userData')/data.db` | 不同环境自动适配 |
| 写队列并发 | p-queue concurrency=1 | 彻底避免 SQLITE_BUSY |
| 事务策略 | 仅增改操作包裹事务 | 查/删为单条语句，不需事务 |
| 参数校验 | 前端 element-plus rules + 后端 service 层双重校验 | 安全冗余 |
| 分页方式 | 前端分页参数传后端，SQL OFFSET/LIMIT | 数据量可控，简单直接 |
| 统一返回 | `{code: 0\|-1, data: any, msg: string}` | code=0成功, code=-1失败 |

---

## 7. 验证步骤

1. `npm install` 安装依赖（注意 better-sqlite3 需原生编译）
2. `npx electron-rebuild -f -w better-sqlite3` 重编译原生模块
3. `npm run dev` 启动开发模式
4. 验证: 窗口打开 → 列表为空 → 新增一条 → 列表显示 → 编辑修改 → 搜索过滤 → 删除确认
5. `npm run build` 打包验证

---

## 8. 常见踩坑

1. **better-sqlite3 编译失败**: 确保安装了 `windows-build-tools` 或 Visual Studio Build Tools + Python
2. **electron-rebuild**: 每次 `npm install` 后可能需要重新执行
3. **electron-vite 路径**: 编译产物在 `out/` 目录，`package.json` 的 `main` 需指向 `./out/main/index.js`
4. **contextBridge 安全**: 渲染进程永远无法访问 `require`，所有 Node API 必须走 preload 桥接

---

## 9. 实施预估

共需创建约 **19 个文件**，按依赖顺序依次编写：

1. 配置文件（package.json, tsconfig, electron-vite.config, electron-builder.yml）
2. 主进程底层（logger → database → repository → service → controller → index）
3. 预加载桥接（preload/index.ts + index.d.ts）
4. 渲染进程（index.html → main.ts → App.vue → store → UserDialog → UserList）
