# Electron 开发踩坑笔记

基于本项目（electron-vite 5 + Vue 3 + better-sqlite3 + electron-builder 25）实际开发过程中遇到的所有问题和解决方案。

---

## 1. preload 脚本未加载 → window.xxxAPI undefined

**现象**：渲染进程调用 `window.userAPI.xxx` 报 `Cannot read properties of undefined`。

**原因**：`package.json` 设置了 `"type": "module"`，electron-vite 将 preload 编译为 `.mjs`，但主进程中引用的是 `.js`。

**解决**：`src/main/index.ts` 中 preload 路径改为 `.mjs`：

```ts
// ❌ 错误
preload: path.join(__dirname, '../preload/index.js')

// ✅ 正确
preload: path.join(__dirname, '../preload/index.mjs')
```

---

## 2. 渲染进程 window 类型报错

**现象**：`类型"Window & typeof globalThis"上不存在属性"userAPI"`。

**原因**：`tsconfig.web.json`（renderer）的 `include` 不包含 `src/preload/index.d.ts`。

**解决**：在 `src/renderer/src/env.d.ts` 中直接声明，并加 `export {}` 使其成为模块：

```ts
interface UserAPI {
  getUserList(params: ListParams): Promise<ApiResponse<PaginatedResult>>
  // ...
}

declare global {
  interface Window {
    userAPI: UserAPI
  }
}

export {}  // ← 关键：让文件成为模块，declare global 才能正确合并
```

**知识点**：`.d.ts` 文件没有 `import/export` 时是 script 模式，`declare global` 行为不同。加 `export {}` 转为 module 模式即可。

---

## 3. 隐藏菜单栏

```ts
// BrowserWindow 选项中（注意不是 webPreferences 里）
autoHideMenuBar: true  // 默认隐藏，按 Alt 临时显示
```

如果想彻底移除：`Menu.setApplicationMenu(null)`。

---

## 4. 系统通知

**四层调用链**：Vue → preload 桥接 → IPC → 主进程 Notification

```
Vue:  window.userAPI.showNotification(title, body)
           ↓
preload: ipcRenderer.invoke('notification:show', title, body)
           ↓
main:  ipcMain.handle('notification:show', (e, title, body) => {
         new Notification({ title, body }).show()
       })
```

**Windows 通知标识问题**：开发模式下通知来源显示 `electron.app.xxx`，需要设置 AppUserModelId：

```ts
// 必须在 app.whenReady() 之前
app.setName('人员管理系统')
if (process.platform === 'win32') {
  app.setAppUserModelId('com.electron.crud-app')
}
```

> **注意**：开发模式下 Windows 通知来源始终显示 AUMID 或标识符，不会显示中文名。只有通过安装器安装后（开始菜单有快捷方式），Windows 才会将 AUMID 映射为显示名称。

---

## 5. Windows 控制台中文乱码

**原因**：Windows 终端默认编码是 GBK(936)，Node.js 输出的是 UTF-8。

**解决**（三层防护）：

```ts
// ① 主进程：切换代码页
import { execSync } from 'child_process'
if (process.platform === 'win32') {
  execSync('chcp 65001', { stdio: 'ignore' })
  process.stdout.setDefaultEncoding('utf-8')
  process.stderr.setDefaultEncoding('utf-8')
}
```

```json
// ② package.json：dev 命令前置 chcp
"dev": "chcp 65001 > nul && electron-vite dev"
```

---

## 6. 数据库文件放置位置

**知识点**：`app.getPath('userData')` 在不同系统返回不同路径：

| 系统 | 路径 |
|------|------|
| Windows | `%APPDATA%/<appName>/` |
| macOS | `~/Library/Application Support/<appName>/` |
| Linux | `~/.config/<appName>/` |

**本项目策略**：

```ts
const dbFile = app.isPackaged ? 'data.db' : 'data.dev.db'
const dbDir = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'data')  // 安装目录下
  : app.getPath('userData')                               // userData 隔离
fs.mkdirSync(dbDir, { recursive: true })
const dbPath = path.join(dbDir, dbFile)
```

- `app.isPackaged`：区分开发 / 生产
- 开发用 `data.dev.db` 隔离，避免污染正式数据
- 生产放安装目录下，用户可见、方便备份

---

## 7. 应用图标

### 7.1 生成图标

Windows 需要 `.ico`（多分辨率），macOS 需要 `.icns`。可以用脚本生成，也可以从一张 1024×1024 PNG 用 electron-builder 自动转换。

### 7.2 左上角窗口图标不显示

需要两处配置：

```ts
// src/main/index.ts — 窗口创建时指定 icon
mainWindow = new BrowserWindow({
  icon: app.isPackaged
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../../build/icon.ico'),
})
```

```yaml
# electron-builder.yml — 打包时复制图标到 resources/
extraResources:
  - from: build/icon.ico
    to: icon.ico
```

### 7.3 exe 文件名中文化

```yaml
# electron-builder.yml
productName: 人员管理系统        # 开始菜单显示名
executableName: lwx-crud         # exe 文件名（建议英文，避免路径编码问题）
```

---

## 8. 安装器自动追加目录名

**场景**：用户选择 `F:\test\`，期望安装到 `F:\test\lwx-crud\`。

**坑**：electron-builder 生成的 NSIS 脚本已占用 `.onGUIInit`、`.onVerifyInstDir` 等回调，外部 include 重定义会导致 `makensis` 编译失败。

**解决方案**：使用 electron-builder 支持的 `!macro` 钩子：

```nsis
; build/installer.nsh——用宏代替函数，不冲突
Var ExpectedDir

!macro customInit
  Push $INSTDIR
  Call GetLastFolderName
  Pop $ExpectedDir
!macroend

!macro customInstall
  Push $INSTDIR
  Call GetLastFolderName
  Pop $0
  ${If} $0 != $ExpectedDir
    StrCpy $INSTDIR "$INSTDIR\$ExpectedDir"
  ${EndIf}
!macroend
```

```yaml
# electron-builder.yml
nsis:
  include: build/installer.nsh
```

**知识点**：electron-builder 支持的 NSIS 宏钩子有 `customInit`、`customInstall`、`customUnInstall`、`customHeader`、`customWelcomePage`、`customFinishPage`、`customAbort` 等。

---

## 9. 打包时依赖缺失

**现象**：安装后运行报 `Cannot find package 'dayjs'`。

**原因**：`electron-builder.yml` 中 `"!node_modules"` 排除了所有依赖。

**解决**：去掉这行，electron-builder 会根据 `package.json` 自动区分 `dependencies`（打包）和 `devDependencies`（不打包）。

```yaml
# ❌ 错误
files:
  - out/**/*
  - "!node_modules"

# ✅ 正确
files:
  - out/**/*
```

> **devDependencies 不打包原理**：`vue`、`element-plus` 等已被 Vite 编译进 `out/renderer/` 的 bundle，运行时不需要 node_modules 中的源码。只有主进程直接 import 的包（dayjs、better-sqlite3、winston、p-queue）需要放在 `dependencies`。

---

## 10. tsconfig rootDir 越界报错

**现象**：`文件"electron.vite.config.ts"不在 "rootDir""f:/.../src"下`。

**解决**：`tsconfig.node.json` 只负责 src 下的代码，配置文件不需要它管：

```json
// tsconfig.node.json
"include": ["src/main/**/*.ts", "src/preload/**/*.ts"]
// 去掉 "electron.vite.config.ts"
```

---

## 11. 发布与升级

### 手动升级

改 `package.json` 的 `version`（如 `1.0.0` → `1.0.1`），重新 `pnpm package:win`。NSIS 安装器天然支持覆盖安装。

### 自动更新（知识点，暂未接入）

如需应用内自动检测更新（类似 VS Code 弹窗提示），需要：

| 组件 | 说明 |
|------|------|
| `electron-updater` | npm 包，处理更新检测、下载、安装 |
| 发布渠道 | GitHub Releases / S3 / 自建静态服务器 |
| 代码签名 | Windows 需 EV Code Signing 证书（$300+/年），否则自动更新不受信任 |
| NSIS + autoUpdater | electron-builder 生成的 NSIS 安装器天然支持 electron-updater |

**最小接入步骤**：
1. `pnpm add electron-updater`
2. 主进程添加 `autoUpdater.checkForUpdatesAndNotify()`
3. `electron-builder.yml` 添加 `publish` 配置
4. 每次发版 push tag 触发 CI 构建上传

```yaml
# electron-builder.yml — 发布到 GitHub Releases
publish:
  provider: github
  owner: your-name
  repo: your-repo
```

> **注意**：macOS 需要 Apple Developer 签名（$99/年），Windows 自动更新建议代码签名证书，否则用户会看到 SmartScreen 警告。

---

## 快速排查清单

| 问题 | 排查点 |
|------|--------|
| window.xxxAPI undefined | preload 路径扩展名 `.mjs` vs `.js` |
| TypeScript 类型报错 | `env.d.ts` 是否有 `export {}` |
| 打包后缺少依赖 | `electron-builder.yml` 是否写了 `!node_modules` |
| 控制台中文乱码 | `chcp 65001` + `setDefaultEncoding` |
| 通知显示 electron.app.xxx | `app.setAppUserModelId()` 在 whenReady 前调用 |
| NSIS 编译失败 | include 的 nsh 是否重定义了 electron-builder 的 Function |
| 窗口图标不显示 | `extraResources` + `BrowserWindow.icon` 都配了没 |
| 安装后数据库有旧数据 | 开发/生产 db 文件名是否隔离 |
| exe 文件名是中文 | 加 `executableName` |
| icon.ico 不存在 | build/ 目录下是否有图标文件 |
