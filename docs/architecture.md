# 项目架构说明书

> 面向接手开发者：10 分钟理解整个项目的代码组织、调用链路和设计决策。

---

## 一、架构全景图

```
┌──────────────────────────────────────────────────────────────────┐
│                      渲染进程 (Renderer)                          │
│  ┌────────────────────┐  ┌──────────────────────────────────┐   │
│  │  App.vue            │  │  views/UserList.vue              │   │
│  │  ├─ TitleBar.vue    │  │  ├─ el-table (列表展示)          │   │
│  │  └─ <router-view>   │  │  ├─ el-pagination (分页)        │   │
│  │                     │  │  ├─ UserDialog.vue (弹窗)        │   │
│  │                     │  │  └─ stores/userStore.ts (Pinia)  │   │
│  └────────────────────┘  └──────────────┬───────────────────┘   │
│                                          │ window.userAPI.xxx()  │
└──────────────────────────────────────────┼────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │    预加载脚本 (Preload)                      │
                    │  contextBridge.exposeInMainWorld('userAPI')  │
                    │  12 个安全 API → ipcRenderer.invoke()        │
                    └──────────────────────┼──────────────────────┘
                                           │
┌──────────────────────────────────────────┼────────────────────────┐
│                         主进程 (Main)                              │
│                                                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │ index.ts         │  │ controller/     │  │ service/         │  │
│  │ 启动入口          │  │ userController  │  │ userService.ts   │  │
│  │                 │  │                 │  │                  │  │
│  │ ① initFileTransport │ ipcMain.handle │  │ 参数校验 ✅       │  │
│  │ ② DbManager.init │  │ ('user:list')  │  │ 事务包装          │  │
│  │ ③ registerIPC    │  │ ('user:create')│  │ 统一返回格式      │  │
│  │ ④ splash 窗口     │  │ ('user:update')│  │ {code,data,msg}  │  │
│  │ ⑤ main 窗口       │  │ ('user:delete')│  └────────┬─────────┘  │
│  │                 │  │ ('notification')│           │            │
│  │ 窗口控制 IPC     │  │ ('window:*')   │           │            │
│  │ 单实例锁         │  └────────┬────────┘           │            │
│  └─────────────────┘           │                    │            │
│                                 │                    │            │
│                      ┌──────────┴────────────────────┘            │
│                      │  repository/userRepository.ts              │
│                      │  原生 SQL 语句（无业务逻辑）                  │
│                      └──────────┬────────────────────┘            │
│                                 │                                  │
│                      ┌──────────┴────────────────────┐            │
│                      │  db/database.ts               │            │
│                      │  单例连接 | WAL 模式           │            │
│                      │  p-queue 串行写队列            │            │
│                      │  run() | get() | all()        │            │
│                      └──────────┬────────────────────┘            │
│                                 │                                  │
│                      ┌──────────┴────────────────────┐            │
│                      │  better-sqlite3                │            │
│                      │  data.db (userData 目录)       │            │
│                      └───────────────────────────────┘            │
└────────────────────────────────────────────────────────────────────┘
```

**核心原则**：
- 渲染进程永远不碰数据库、文件系统、Node API
- 所有数据交互走 `window.userAPI → IPC → 主进程四层`
- 写入操作走 p-queue 串行队列，增改操作用事务包裹

---

## 二、目录树 + 职责标注

```
electron-01/
├── package.json                      # 依赖 + 脚本 + type:module
├── electron.vite.config.ts           # Vite 三通道构建配置
├── electron-builder.yml              # 打包配置（exe/dmg/NSIS）
├── tsconfig.json                     # TS 根配置（引用 node/web）
├── tsconfig.node.json                # 主进程 + preload TS 配置
├── tsconfig.web.json                 # 渲染进程 TS 配置
├── .npmrc                            # pnpm + Electron 国内镜像
│
├── src/
│   ├── main/                         # ═══ 主进程 ═══
│   │   ├── index.ts                  # 启动入口：日志→DB→IPC→splash→主窗口→单实例锁
│   │   ├── db/
│   │   │   └── database.ts           # ① DB 底层：单例连接、WAL 模式、建表、p-queue 写队列
│   │   ├── repository/
│   │   │   └── userRepository.ts     # ② 仓储层：user 表原生 SQL（insert/select/update/delete）
│   │   ├── service/
│   │   │   └── userService.ts        # ③ 业务层：参数校验、事务包裹、统一 {code,data,msg}
│   │   ├── controller/
│   │   │   └── userController.ts     # ④ 控制器层：ipcMain.handle 注册 + try-catch
│   │   └── utils/
│   │       └── logger.ts             # winston 日志：控制台 + 文件（延迟初始化）
│   │
│   ├── preload/                      # ═══ 预加载桥接 ═══
│   │   ├── index.ts                  # contextBridge 暴露 12 个安全 API
│   │   └── index.d.ts               # 类型声明（供编辑器智能提示，实际不参与编译）
│   │
│   └── renderer/                     # ═══ 渲染进程 ═══
│       ├── index.html                # HTML 入口（挂载 #app）
│       ├── splash.html               # 启动动画屏（纯 HTML+CSS，无框架依赖）
│       └── src/
│           ├── main.ts               # Vue3 启动：注册 ElementPlus + Pinia
│           ├── App.vue               # 根组件：TitleBar + UserList + Ctrl+Shift+I 快捷键
│           ├── env.d.ts              # 类型声明：*.vue 模块 + Window.userAPI
│           ├── stores/
│           │   └── userStore.ts      # Pinia Store：列表状态 + CRUD 方法 + 分页/搜索
│           ├── components/
│           │   ├── TitleBar.vue      # 自定义窗口标题栏（无边框窗口的拖拽区）
│           │   └── UserDialog.vue    # 新增/编辑弹窗（表单 + Element Plus 校验）
│           └── views/
│               └── UserList.vue      # 列表主页：表格 + 搜索 + 分页 + 通知测试按钮
│
├── build/
│   ├── icon.ico                      # Windows 应用图标
│   └── icon.icns                     # macOS 应用图标
│
└── docs/
    ├── architecture.md               # 📄 本文档：架构说明书
    ├── dev-guide.md                  # 📄 二次开发指南
    ├── electron-basics.md            # 📄 Electron 核心概念
    ├── electron-knowledge.md         # 📄 Electron 知识点手册
    └── electron-faq.md               # 📄 踩坑记录
```

---

## 三、启动全流程

```
app.whenReady()
│
├─ ① initFileTransport()               ← 初始化 winston 文件日志传输
│
├─ ② DbManager.getInstance().init()     ← 创建 SQLite 连接 + WAL 模式 + CREATE TABLE
│      ├─ 开发环境：data.dev.db
│      └─ 打包后：data.db（从安装目录自动迁移旧数据）
│
├─ ③ registerUserController()          ← 注册 5 个 user:xxx IPC + 注册主窗口 IPC
│      ├─ ipcMain.handle('user:list')      → service.getUserList()
│      ├─ ipcMain.handle('user:create')    → service.createUser()
│      ├─ ipcMain.handle('user:update')    → service.updateUser()
│      ├─ ipcMain.handle('user:delete')    → service.deleteUser()
│      └─ ipcMain.handle('user:getById')   → service.getUserById()
│
├─ ④ ipcMain.handle('notification:show')  ← 系统通知 IPC
├─ ⑤ ipcMain.handle('window:*')          ← 最小化/最大化/关闭/DevTools
│
├─ ⑥ createSplashWindow()              ← 400×280 无边框置顶窗口，显示 splash.html
│      └─ skipTaskbar + alwaysOnTop + 纯 CSS 动画
│
├─ ⑦ createWindow()                    ← 主窗口后台加载（show: false）
│      ├─ frame: false（无边框） + autoHideMenuBar
│      ├─ webPreferences → preload: '../preload/index.mjs'
│      ├─ 开发：loadURL(ELECTRON_RENDERER_URL)
│      ├─ 打包：loadFile('out/renderer/index.html')
│      │
│      └─ ready-to-show 事件
│           └─ 至少等 5.5 秒（min splash 时长）
│                ├─ splashWindow.close()
│                └─ mainWindow.show()   ← 用户看到主界面
│
└─ ⑧ 注册生命周期
      ├─ app.on('activate') → macOS dock 重建窗口
      ├─ app.on('second-instance') → 单实例锁，拉到前台
      ├─ app.on('window-all-closed') → 非 macOS 退出
      └─ app.on('before-quit') → 日志清理
```

---

## 四、全部 IPC 通道一览

### 用户数据（请求-响应）

| 通道名 | 方向 | 参数 | 返回值 | 用途 |
|--------|------|------|--------|------|
| `user:list` | 渲染→主 | `{searchName?, page?, pageSize?}` | `{code, data: {list, total}, msg}` | 分页+模糊搜索 |
| `user:getById` | 渲染→主 | `id: number` | `{code, data: userRow, msg}` | 单条查询 |
| `user:create` | 渲染→主 | `{name, phone, address}` | `{code, data: null, msg}` | 新增（事务） |
| `user:update` | 渲染→主 | `id, {name, phone, address}` | `{code, data: null, msg}` | 编辑（事务） |
| `user:delete` | 渲染→主 | `id: number` | `{code, data: null, msg}` | 删除（串行队列） |

### 系统能力（请求-响应）

| 通道名 | 方向 | 参数 | 用途 |
|--------|------|------|------|
| `notification:show` | 渲染→主 | `title, body` | 发送系统通知 |
| `window:minimize` | 渲染→主 | 无 | 最小化窗口 |
| `window:maximize` | 渲染→主 | 无 | 最大化/还原 |
| `window:close` | 渲染→主 | 无 | 关闭窗口 |
| `window:isMaximized` | 渲染→主 | 无 | 查询最大化状态 |
| `window:toggleDevTools` | 渲染→主 | 无 | 切换开发者工具 |

### 状态推送（主→渲染）

| 通道名 | 方向 | 推送内容 | 用途 |
|--------|------|----------|------|
| `window:maximizeChange` | 主→渲染 | `boolean` | 最大化状态变化通知 |

---

## 五、完整调用链示例：「新增人员」

```
UserList.vue                    userStore.ts                 preload/index.ts
  │                                │                            │
  │ 点击「新增人员」                 │                            │
  │ 打开 UserDialog                 │                            │
  │                                │                            │
  │ 填写表单 → 点击「确认新增」       │                            │
  │   ├─ el-form.validate() 前端校验 │                            │
  │   └─ UserDialog.handleSubmit() │                            │
  │        └─ store.createUser() ──►│                            │
  │                                 │ window.userAPI             │
  │                                 │   .createUser(data) ──────►│ ipcRenderer.invoke
  │                                 │                            │   ('user:create', data)
  │                                 │                            │
  │                                 │                            │
  ═══════════════════════════════════════════════════ IPC 边界 ══
                                                               │
                            controller/userController.ts        │
                              │                                 │
                              │ ipcMain.handle('user:create')   │
                              │   ├─ try-catch                  │
                              │   └─ service.createUser(data)   │
                              │                                 │
                            service/userService.ts              │
                              │                                 │
                              │ ① validateUserInput(data)       │
                              │     name 非空 ≤50               │
                              │     phone 正则 1[3-9]\d{9}     │
                              │     address 非空 ≤200           │
                              │     └─ 校验失败 → return fail() │
                              │                                 │
                              │ ② dbManager.transaction(() => { │
                              │      repository.insert(...)     │
                              │    })                           │
                              │                                 │
                            repository/userRepository.ts        │
                              │                                 │
                              │ INSERT INTO user (name, phone,  │
                              │   address, create_time)         │
                              │ VALUES (?, ?, ?, ?)             │
                              │                                 │
                            db/database.ts                      │
                              │                                 │
                              │ writeQueue.add(() => {          │
                              │   db.prepare(sql).run(...params) │
                              │ })                              │
                              │ └─ 串行执行，避免 database lock │
                              │                                 │
                            better-sqlite3                      │
                              │                                 │
                              │ WAL 模式写入 data.db            │
                              └─ 返回 RunResult                 │
                              │                                 │
                              │ ← 事务提交成功                   │
                              │                                 │
                            service → return success()          │
                            controller → return {code:0,...}    │
                              │                                 │
  ═══════════════════════════════════════════════════ IPC 边界 ══
                              │                                 │
                              ◄── ipcRenderer.invoke 结果 ──────│
                                                              │
                                 ◄── Promise resolve ───────────│
                                                              │
  ◄── store.createUser() 返回 ─────│                            │
       └─ code===0                  │                            │
          ├─ ElMessage.success()    │                            │
          ├─ dialogVisible = false  │                            │
          └─ store.fetchUserList()  │                            │
```

---

## 六、关键设计决策

### 1. 数据库路径 → `userData` 而非安装目录

| 方案 | 优点 | 缺点 |
|------|------|------|
| 安装目录 | 用户可见、好备份 | **NSIS 升级时可能被清空**，写 Program Files 可能没权限 |
| **userData（已采用）** | **升级不丢数据**，跨用户隔离 | 路径隐蔽 |

开发/生产用不同文件名隔离：开发 `data.dev.db`，打包后 `data.db`。启动时自动从安装目录迁移旧数据到 userData。

### 2. WAL 模式 + p-queue 串行写

SQLite 默认的 rollback journal 模式下，写操作会锁住整个数据库。WAL（Write-Ahead Logging）允许多个读操作与写操作并发执行。

再加上 `p-queue` 串行写队列（concurrency=1），从应用层面彻底杜绝并发写冲突。增改操作包裹在 `better-sqlite3 transaction` 中，保证原子性。

### 3. 四层分层

```
controller  →  IPC 注册 + 异常捕获（不写业务逻辑）
service     →  参数校验 + 事务 + 格式化返回（不写 SQL）
repository  →  原生 SQL 语句（不写校验和事务）
db          →  连接管理 + 通用 run/get/all（不写表名）
```

每层只做自己该做的事，改动一张表不会波及无关层级。

### 4. 单实例锁

`app.requestSingleInstanceLock()` 确保应用只有一个进程运行。二次启动时第一个实例收到 `second-instance` 事件，将已有窗口拉到前台。

### 5. 无边框窗口（frame: false）

去掉了 Windows 原生标题栏，用 Vue 组件 `TitleBar.vue` 自定义。拖拽区域用 `-webkit-app-region: drag`，按钮用 `no-drag`。窗口控制（最小化/最大化/关闭）全部走 IPC → 主进程执行。
