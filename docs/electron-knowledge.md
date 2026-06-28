# Electron 知识点手册

> 以本项目的实际实现为线索，梳理 Electron 开发中的关键概念和 API。

---

## 一、进程模型：为什么 Electron 有三个"环境"

Electron 的应用跑在三个不同的 JS 环境里，它们权限不同、互不直接通信：

```
┌─────────────────┐          ┌──────────────────┐
│  渲染进程        │  IPC     │  主进程           │
│  (Renderer)     │◄────────►│  (Main)          │
│                 │          │                  │
│  能做什么：       │          │  能做什么：        │
│  DOM / CSS / JS │          │  Node.js / 文件   │
│  Vue / React    │          │  系统调用 / 原生模块 │
│                 │          │  创建窗口 / 托盘   │
│  不能做什么：     │          │                  │
│  读写文件        │          │  不能做什么：       │
│  调系统 API      │          │  操作 DOM         │
└─────────────────┘          └──────────────────┘
        ▲
        │ contextBridge.exposeInMainWorld
        │
┌─────────────────┐
│  预加载脚本       │
│  (Preload)      │
│                 │
│  唯一的桥梁       │
│  运行在渲染进程    │
│  但有 Node API   │
└─────────────────┘
```

**为什么要这么设计？**

安全。如果渲染进程能直接调 Node.js，那网页里的 XSS 攻击就能删你文件。preload 就像一个安检口——只放行你主动暴露的 API，其余全部拦截。

**实际体感**：写代码时最常踩的坑就是"这个 API 应该在哪个进程调用？"。一个简单的判断法则——需要操作系统能力（弹通知、读文件、创建窗口）→ 主进程；操作界面（按钮点击、列表渲染）→ 渲染进程；两者之间的沟通 → preload。

---

## 二、安全桥接：preload 是怎么工作的

### 2.1 三件套

```ts
// ① preload — 定义"白名单"
contextBridge.exposeInMainWorld('userAPI', {
  getUserList: (params) => ipcRenderer.invoke('user:list', params),
})

// ② main — 注册"处理函数"
ipcMain.handle('user:list', async (_event, params) => {
  return service.getUserList(params)
})

// ③ renderer — 像调用普通 JS 一样
const res = await window.userAPI.getUserList({ page: 1 })
```

**整个调用链是异步的**（`invoke` → `handle` 本质是 Promise），不用担心阻塞 UI。

### 2.2 两种 IPC 模式

| 模式 | 方向 | API | 使用场景 |
|------|------|-----|---------|
| 请求-响应 | 渲染 → 主 | `ipcRenderer.invoke` + `ipcMain.handle` | 查数据、调接口 |
| 单向推送 | 主 → 渲染 | `win.webContents.send` + `ipcRenderer.on` | 状态变化通知 |

"请求-响应"像 HTTP 请求——你问我答，有来有回。适合 90% 的场景。

"单向推送"像 WebSocket——主进程主动通知渲染进程。典型场景：窗口最大化/还原了，主进程告诉渲染进程换个图标。

```ts
// 主进程 — 窗口状态变了，推给渲染进程
mainWindow.on('maximize', () => {
  mainWindow.webContents.send('window:maximizeChange', true)
})

// preload — 暴露监听方法
onMaximizeChange: (cb) => ipcRenderer.on('window:maximizeChange', (_e, state) => cb(state))
```

### 2.3 TypeScript 类型怎么配

渲染进程本来不知道 `window` 上有 `userAPI`，需要手动声明：

```ts
// src/renderer/src/env.d.ts
interface UserAPI {
  getUserList(params: ListParams): Promise<ApiResponse<PaginatedResult>>
  minimize(): Promise<void>
}

declare global {
  interface Window {
    userAPI: UserAPI
  }
}

export {}  // 这一行很容易漏，但漏了 declare global 就不生效
```

**为什么需要 `export {}`？** TypeScript 里，不含 `import/export` 的 `.d.ts` 文件被当作"全局脚本"，`declare global` 在脚本中表现不一致。加上 `export {}` 把它变成"模块"，`declare global` 就正常工作了。

---

## 三、窗口管理：从原生到完全定制

### 3.1 两个"无边框"的区别

Electron 提供了两种去掉系统标题栏的方式，容易搞混：

| 配置 | 效果 | 位置 |
|------|------|------|
| `frame: false` | 去掉整个窗口边框（标题栏 + 三按钮 + 可拖拽边缘） | BrowserWindow 选项 |
| `autoHideMenuBar: true` | 只隐藏顶部菜单栏（File/Edit...），按 Alt 弹出 | BrowserWindow 选项 |

`frame: false` 是最彻底的——连窗口标题栏一起消失。代价是：窗口不能拖拽了、不能调大小了、关闭按钮也没了。这些全部需要你自己用 HTML/CSS 实现。

### 3.2 用 CSS 实现窗口拖拽

```css
.title-bar {
  -webkit-app-region: drag;   /* 整个标题栏区域都可以拖 */
}

.title-bar button {
  -webkit-app-region: no-drag; /* 按钮要排除，否则点不动 */
}
```

`-webkit-app-region` 是 Chromium 专有属性，Electron 专用。整个 Web 平台只有 Electron 支持它。

### 3.3 窗口控制的三层通信

点标题栏上的最小化按钮，背后发生了什么：

```
Vue 按钮 @click
  → handleMinimize()
    → window.userAPI.minimize()          // preload 桥接
      → ipcRenderer.invoke('window:minimize')  // IPC
        → ipcMain.handle → mainWindow.minimize()  // 主进程执行
```

看起来绕了很远，但这正是 Electron 安全模型的要求——渲染进程没有权限操作窗口，必须通过主进程。

### 3.4 最大化/还原的图标切换

最大化时应该显示"还原"图标（两个方框），非最大化时显示"最大化"图标（一个方框）。问题是怎么知道窗口当前状态：

```ts
// 初始化时主动查一次
isMaximized.value = await window.userAPI.isMaximized()

// 之后靠主进程推送——因为用户也可能双击标题栏最大化
window.userAPI.onMaximizeChange((state: boolean) => {
  isMaximized.value = state
})
```

这里用了前面说的"单向推送"模式——状态变化由主进程发起，不需要渲染进程轮询。

### 3.5 模拟 Aero Snap：最大化窗口拖拽还原

Windows 原生的行为：当窗口最大化时，拖标题栏会让窗口还原并跟着鼠标走。但 `frame: false` 后这个行为丢失了。

思路：监听 `will-move` 事件，在窗口移动前判断是否最大化，如果是就还原并重新定位。

```ts
mainWindow.on('will-move', () => {
  if (!mainWindow.isMaximized()) return

  const cursor = screen.getCursorScreenPoint()           // 鼠标在哪
  const display = screen.getDisplayMatching({ ...cursor, width: 1, height: 1 })
  const bounds = mainWindow.getNormalBounds()            // 还原后多大
  const ratioX = cursor.x / display.workAreaSize.width   // 鼠标在屏幕的位置比例

  mainWindow.unmaximize()
  mainWindow.setBounds({
    x: Math.round(cursor.x - bounds.width * ratioX),     // 保持鼠标在窗内同样位置
    y: cursor.y - 20,                                     // 标题栏偏移
    width: bounds.width,
    height: bounds.height
  })
})
```

核心技巧是 `ratioX`——最大化时窗口铺满屏幕，鼠标在屏幕上 X=800 的位置（屏幕宽 1920，比例 0.42）。还原后窗口宽 1100，鼠标就该在窗口内 X=1100×0.42≈462 处。这样鼠标在窗口上的"手感"保持一致。

---

## 四、启动体验：Splash Screen

### 4.1 为什么要做 Splash

Electron 应用冷启动时，从进程创建到页面渲染完成有几百毫秒的白屏。加一个启动动画让过渡更"像一个正经的桌面软件"。

### 4.2 双窗口策略

```
app.whenReady()
  ├─ createSplashWindow()    ① 先弹小窗（400×280，置顶，无边框）
  ├─ createMainWindow()      ② 主窗口后台加载（show: false）
  │
  └─ mainWindow.once('ready-to-show')
       ├─ 等至少 1.5 秒
       ├─ splashWindow.close()
       └─ mainWindow.show()  ③ 主窗口亮相
```

关键配置：

| splash 窗口 | 作用 |
|---|---|
| `skipTaskbar: true` | 不显示在任务栏，防止用户误点 |
| `alwaysOnTop: true` | 始终在最前，避免被其他窗口遮挡 |
| `frame: false` | 无边框，纯内容展示 |
| `resizable: false` | 不需要缩放 |

`splash.html` 建议纯 HTML + CSS 动画，不引入 Vue/Vite——加载一个 3KB 的 HTML 比启动整个 Vite dev server 快得多。

---

## 五、系统通知

### 5.1 调用链

和窗口控制一样的四层模式：Vue → preload → IPC → 主进程 `new Notification()`。

**为什么要经过主进程？** 浏览器的 Notification API 在 Electron 里也能用，但主进程的 Notification 更稳定，且能正确关联到应用图标和标识。

### 5.2 Windows 通知的"署名"问题

Windows 的通知系统通过 **AppUserModelId**（AUMID）来识别"这条通知是哪个应用发的"。不设的话默认是 `electron.app.xxx`。

```ts
app.setAppUserModelId('com.electron.crud-app')
```

这个值需要和 `electron-builder.yml` 的 `appId` 一致。安装后，Windows 会把 AUMID 映射到开始菜单快捷方式的显示名称。

**开发 vs 安装的区别**：开发时通知来源始终显示原始 AUMID（`com.electron.crud-app`），因为 Windows 找不到对应的快捷方式。安装后才会显示 `人员管理系统`。这不是 bug，是 Windows 的安全设计。

---

## 六、数据存储：SQLite 在 Electron 里的最佳实践

### 6.1 为什么不用 localStorage

`localStorage` 有 5-10MB 上限，且数据随 Chromium 缓存可能被清除。SQLite 无容量限制，数据独立于浏览器。

### 6.2 技术选型

- **better-sqlite3** 而不是 `sql.js`：better-sqlite3 是原生模块，性能更好，支持 WAL
- **WAL 模式**：Write-Ahead Logging，允许多个读操作和写操作并发
- **p-queue 串行写**：`concurrency: 1` 确保同一时间只有一个写操作

### 6.3 数据库放哪里

这是一个需要权衡的设计决策：

| 方案 | 优点 | 缺点 |
|------|------|------|
| `userData`（`%APPDATA%`） | 标准做法，跨用户隔离 | 路径隐蔽，用户难找到 |
| 安装目录下 | 用户可见，方便备份 | 写 Program Files 可能没权限 |

本项目折中：**打包后放安装目录**（因为 NSIS 允许用户选非保护目录），**开发时放 userData**（隔离测试数据）。

```ts
const dbDir = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'data')   // 安装目录/data/
  : app.getPath('userData')                                 // %APPDATA%
```

`app.isPackaged` 是 Electron 提供的布尔值——开发时 `false`，打包后 `true`。经常用来区分环境。

---

## 七、打包：electron-builder 那些事

### 7.1 它会区分 dependencies 和 devDependencies

这是新手最常犯的错——手动写 `!node_modules` 把需要的包也排除了。electron-builder 自己会读 `package.json`：

- `dependencies` → 打包进 asar（主进程需要 import 的）
- `devDependencies` → 不打包（构建工具、前端框架）

所以 `vue`、`element-plus`、`vite` 放心放 `devDependencies`，它们已经被编译进 `out/` 了。

### 7.2 NSIS 安装器定制

electron-builder 内置了 NSIS 模板，可以在外部补充自定义脚本：

```yaml
nsis:
  include: build/installer.nsh   # 自定义脚本
```

但**不是所有 NSIS 语法都能用**。electron-builder 已经定义了一系列回调函数（`.onInit`、`.onGUIInit`、`.onVerifyInstDir` 等），你在 `nsh` 里不能重复定义。正确的做法是用 **`!macro` 钩子**：

```nsis
!macro customInit      # 安装器初始化时调用
!macro customInstall   # 开始安装文件前调用
```

---

## 八、开发体验：编码和调试

### 8.1 控制台乱码（Windows 专属）

Windows 终端的默认编码是 GBK，Node.js 输出 UTF-8，不匹配就乱码。在主进程里 `chcp 65001` 切换代码页，同时设 `stdout` 编码。

### 8.2 preload 脚本的扩展名问题

`package.json` 有 `"type": "module"` 时，electron-vite 把 preload 编译成 `.mjs`。主进程里引用路径必须写 `.mjs`，不是 `.js`。

### 8.3 无边框窗口的 DevTools

`frame: false` 去掉了原生菜单栏，`Ctrl+Shift+I` 可能不奏效。稳妥做法：自己注册一个 IPC，在渲染进程监听键盘事件，手动调用 `toggleDevTools()`。

---

## 九、升级与发布

| 方式 | 怎么做 | 适合 |
|------|--------|------|
| 手动 | 改 `version` → 重新打包 → 用户下载新安装包覆盖安装 | 内部分发 |
| 自动 | `electron-updater` + GitHub Releases / S3 + 代码签名 | 公网发布 |

手动升级就两步：改版本号、重新 `pnpm package:win`。NSIS 安装器天然支持覆盖旧版本。

自动更新是另一个量级的工程——需要更新服务器、代码签名证书（Windows 每年 $300+）、版本管理策略。小项目通常不急。
