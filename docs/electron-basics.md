# Electron 核心概念

> 面向 Electron 新手，用本项目的实际代码解释 Electron 开发中最关键的概念。读完能建立正确的心智模型。

---

## 一、Electron 到底是什么

Electron 是一个打包工具链，把 **Chromium（浏览器内核）** + **Node.js** 缝合在一起，让你能用 HTML / CSS / JavaScript 写桌面应用。

一句话理解：你在 Chrome 里打开 `index.html` 看到的是网页，Electron 把它变成一个 `.exe` 文件，同时还能调操作系统的 API（读写文件、弹通知、创建窗口）。

```
Electron 应用 = Chromium（负责界面渲染） + Node.js（负责系统能力）
```

这意味着你写的代码天然跨平台——同一套代码在 Windows / macOS / Linux 上都能跑。

---

## 二、三进程模型

Electron 把应用拆成三个互相隔离的 JS 运行环境。理解这个模型是开发 Electron 的第一步。

```
┌──────────────────────────────────────────────────────────────┐
│                       三进程模型                               │
│                                                              │
│  ┌─────────────────┐          ┌──────────────────────────┐  │
│  │  渲染进程         │   IPC    │  主进程 (Main)            │  │
│  │  (Renderer)      │◄────────►│                          │  │
│  │                 │          │                          │  │
│  │  ✅ DOM/CSS/JS   │          │  ✅ Node.js 全部 API      │  │
│  │  ✅ Vue/React    │          │  ✅ 文件读写 (fs)         │  │
│  │  ✅ Element Plus │          │  ✅ 系统调用 (os)         │  │
│  │                 │          │  ✅ 原生模块 (SQLite)      │  │
│  │  ❌ fs.readFile  │          │  ✅ 创建窗口/托盘          │  │
│  │  ❌ 系统对话框   │          │                          │  │
│  │  ❌ SQLite       │          │  ❌ DOM 操作              │  │
│  └────────┬────────┘          └──────────────────────────┘  │
│           │                                                  │
│           │ contextBridge.exposeInMainWorld()                │
│           │                                                  │
│  ┌────────┴────────┐                                        │
│  │  预加载 (Preload) │                                       │
│  │                 │                                        │
│  │  ✅ Node.js API  │  ← 它跑在渲染进程里，但有 Node 权限       │
│  │  ✅ ipcRenderer  │  ← 唯一的 IPC 通信能力                  │
│  │  ✅ contextBridge│  ← 唯一能往渲染进程"放东西"的途径         │
│  └─────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
```

**类比**：
- 主进程 = 后厨（什么都能做，但客人看不到）
- 渲染进程 = 餐厅（客人只能看到这里）
- Preload = 传菜口（后厨做好菜，通过传菜口给客人）

### 为什么不能直接在 Vue 里 `require('fs')`？

两句话解释：
1. **安全**：如果网页能读文件，那 XSS 攻击就能偷你硬盘
2. **隔离**：Electron 强制 `contextIsolation: true`（默认），渲染进程的 JS 环境里根本没有 `require` 和 Node 模块

在本项目中，你永远不能在 `.vue` 文件里写 `import fs from 'fs'`。所有需要 Node 能力的操作，必须：
```
Vue 组件 → window.userAPI.xxx() → preload → IPC → 主进程
```

---

## 三、contextBridge 安全模型

`contextBridge.exposeInMainWorld()` 是 preload 脚本的核心 API。它在一个安全的上下文中，向渲染进程的 `window` 对象上挂载方法。

```ts
// src/preload/index.ts — 真实代码
contextBridge.exposeInMainWorld('userAPI', {
  getUserList: (params) => ipcRenderer.invoke('user:list', params),
})
```

渲染进程里的调用方式：
```ts
// src/renderer/src/stores/userStore.ts — 真实代码
const res = await window.userAPI.getUserList({ page: 1 })
```

**没有暴露的 API，渲染进程永远访问不到。** 这就是安全白名单模型。

---

## 四、IPC 双模式

IPC（Inter-Process Communication）是主进程和渲染进程之间唯一的通信方式。

### 模式一：请求-响应（invoke / handle）

像 HTTP 请求一样——你问我答，有来有回。占 90% 的使用场景。

```
渲染进程                                    主进程
ipcRenderer.invoke('user:list', params) →  ipcMain.handle('user:list', handler)
   │                                          │
   │  Promise 等待...                           │ 执行查询
   │                                          │ return {code:0, data, msg}
   │◄─────── Promise resolve ────────────────│
```

**代码对照**：

```ts
// preload（发起方）
getUserList: (params) => ipcRenderer.invoke('user:list', params)

// main（处理方）
ipcMain.handle('user:list', async (_event, params) => {
  return service.getUserList(params)  // 统一返回 {code, data, msg}
})

// renderer（调用方）
const res = await window.userAPI.getUserList({ page: 1 })
// res = { code: 0, data: { list: [...], total: 10 }, msg: '查询成功' }
```

**invoke/handle 本质**：一个 Promise 管道。渲染进程发起请求，主进程异步处理并返回结果。

### 模式二：单向推送（send / on）

主进程主动通知渲染进程，不需要渲染进程先请求。典型场景：窗口状态变化了，主进程告诉渲染进程。

```
主进程                                    渲染进程
mainWindow.on('maximize', () => {
  win.webContents.send(                    ipcRenderer.on(
    'window:maximizeChange', true)   →       'window:maximizeChange',
   })                                        (_e, state) => { ... }
                                            )
```

**在本项目中的使用**：

```ts
// main/index.ts — 主进程：窗口最大化时推送
mainWindow.on('maximize', () => {
  mainWindow?.webContents.send('window:maximizeChange', true)
})

// preload/index.ts — 暴露监听方法
onMaximizeChange: (cb) => ipcRenderer.on('window:maximizeChange', (_e, state) => cb(state))

// TitleBar.vue — 渲染进程：收到推送后切换图标
window.userAPI.onMaximizeChange((state: boolean) => {
  isMaximized.value = state
})
```

### 两种模式对比

| | invoke/handle | send/on |
|------|------|------|
| 方向 | 渲染 → 主（请求-响应） | 主 → 渲染（单向推送） |
| 返回值 | 有（Promise） | 无 |
| 适用 | 查询数据、执行操作 | 状态变化通知 |
| 本项目示例 | `user:list`、`window:minimize` | `window:maximizeChange` |

---

## 五、`package.json` 的 `type: module` 坑

本项目 `package.json` 设了 `"type": "module"`。这带来的一个后果是：

- electron-vite 把 preload 编译成 `.mjs`（ESM 格式）
- 主进程里引用 preload 必须写 `.mjs` 扩展名

```ts
// ❌ 错误：找不到文件
preload: path.join(__dirname, '../preload/index.js')

// ✅ 正确
preload: path.join(__dirname, '../preload/index.mjs')
```

这是 Electron + electron-vite 新手最常见的坑之一。记着：**`type: module` 时 preload 路径用 .mjs**。

---

## 六、better-sqlite3 编译

### 为什么它需要编译？

`better-sqlite3` 是一个用 C++ 写的 Node.js 原生模块。它不是纯 JS，需要编译成对应平台和 Node 版本的二进制文件。

### electron-rebuild 做了什么？

普通 `npm install` 时，better-sqlite3 编译目标是你系统的 Node.js 版本。但 Electron 内嵌了**自己的** Node.js 版本——这两个版本的 Node 可能不一样。

`electron-rebuild` 就是用 Electron 内嵌的 Node 版本重新编译原生模块，生成匹配的二进制文件。

```bash
pnpm electron-rebuild -f -w better-sqlite3
```

**不编译会怎样？** 启动时报类似 `The module was compiled against a different Node.js version` 的错误。

---

## 七、electron-builder 打包原理

### 它会区分 dependencies 和 devDependencies

```
package.json
├── dependencies  → 打包进 asar
│   ├── better-sqlite3  ✅ 主进程 import，需要打包
│   ├── dayjs           ✅ 主进程 import，需要打包
│   └── p-queue         ✅ 主进程 import，需要打包
│
└── devDependencies → 不打包（已被 Vite 编译到 out/）
    ├── vue             → 已编译到 out/renderer/
    ├── element-plus    → 已编译到 out/renderer/
    └── typescript      → 纯工具，不需要
```

**常见错误**：手动在 `electron-builder.yml` 里写 `"!node_modules"`，把 dependencies 里的包也排除了。**不要这么做**，electron-builder 会自动处理。

### asar 是什么

asar 是一种归档格式，把整个 `out/` 和 `node_modules/` 打成一个 `.asar` 大文件。好处：减少文件数、加快加载。electron-builder 默认开启。

### NSIS 安装器

Windows 下 electron-builder 使用 NSIS（Nullsoft Scriptable Install System）生成安装包。支持：
- 选择安装路径
- 创建桌面快捷方式
- 写入注册表
- 覆盖安装旧版本

配置在 `electron-builder.yml` 的 `nsis` 段。

---

## 八、app 生命周期

```ts
// ① 应用启动前：设置标识
app.setAppUserModelId('com.electron.crud-app')  // 必须在 whenReady 之前

// ② 获取单实例锁（也在 whenReady 之前）
if (!app.requestSingleInstanceLock()) process.exit(0)

// ③ 应用就绪：创建窗口、初始化数据库、注册 IPC
app.whenReady().then(() => { /* ... */ })

// ④ 第二个实例启动（单实例锁）
app.on('second-instance', () => { mainWindow?.focus() })

// ⑤ 所有窗口关闭
app.on('window-all-closed', () => {
  // Windows/Linux → 退出
  // macOS → 不退出（保持 dock 图标）
  if (process.platform !== 'darwin') app.quit()
})

// ⑥ macOS dock 图标点击
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ⑦ 退出前清理
app.on('before-quit', () => { logger.info('应用即将退出') })
```

**时序口诀**：`setAppUserModelId` → `requestSingleInstanceLock` → `whenReady` → 创建窗口 → 注册事件。

---

## 九、窗口无边框（frame: false）

设置 `frame: false` 后 Windows 原生标题栏消失。带来的连锁变化：

| 能力 | 有原生标题栏 | frame: false |
|------|:------:|:----:|
| 拖动窗口 | ✅ 自动 | ❌ 需要手动实现 |
| 关闭按钮 | ✅ 系统自带 | ❌ 需要自己画 |
| 最小化按钮 | ✅ 系统自带 | ❌ 需要自己画 |
| 最大化/还原 | ✅ 系统自带 | ❌ 需要自己画 |
| 窗口圆角 | ✅ 系统绘制 | ❌ CSS `border-radius` |
| Ctrl+Shift+I | ✅ | ❌ 需要手动 IPC |

**本项目的解决方案**：`TitleBar.vue` 自定义标题栏。

```css
/* 拖拽区域：整个标题栏都可以拖 */
.title-bar { -webkit-app-region: drag; }

/* 按钮区域：排除拖拽，否则点不动 */
.title-bar button { -webkit-app-region: no-drag; }
```

`-webkit-app-region` 是 Chromium 专有属性，**只在 Electron 里有效**。普通浏览器不认识它。

窗口控制走 IPC 到主进程：

```ts
// TitleBar.vue → preload → main
handleMinimize() → window.userAPI.minimize() → ipcMain.handle('window:minimize') → mainWindow.minimize()
```

---

## 十、本地存储三件套对比

| 方案 | 容量 | 数据类型 | 位置 | 适合 |
|------|------|------|------|------|
| **localStorage** | 5-10MB | 字符串 key-value | Chromium 数据目录 | 配置项、UI 偏好 |
| **electron-store** | 无限制 | JSON | userData 目录 | 复杂配置、用户设置 |
| **SQLite (本项目)** | 无限制 | 结构化表 + SQL | userData 目录 | 业务数据、增删改查、百万级记录 |

**选型建议**：
- 存主题颜色、窗口大小 → `localStorage` 就够了
- 存复杂的用户偏好（嵌套对象）→ `electron-store`
- 存业务数据（人员、订单、库存）→ **SQLite**

本项目选 SQLite 是因为需要分页、搜索、事务、关联查询——这些正是关系数据库的强项。
