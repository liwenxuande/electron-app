# Electron 33 → 42 升级文档

## 版本对照

| 依赖 | 升级前 | 升级后 |
|------|--------|--------|
| electron | ^33.4.0 | ^42.4.1 |
| better-sqlite3 | ^11.7.0 | ^12.11.1 |
| electron-builder | ^25.1.8 | ^26.15.3 |
| electron-vite | ^5.0.0 | ^6.0.0-beta.1 |

| 栈 | 升级前 | 升级后 |
|----|--------|--------|
| Chromium | M130 | M148 |
| Node.js | v20 | v24.17 |
| V8 | 13.0 | 14.8 |

---

## 一、升级步骤

### 1. 更新依赖版本

修改 `package.json`：

```json
{
  "dependencies": {
    "better-sqlite3": "^12.11.1"
  },
  "devDependencies": {
    "electron": "^42.4.1",
    "electron-builder": "^26.15.3",
    "electron-vite": "^6.0.0-beta.1"
  }
}
```

### 2. 删除 node_modules 重装

```bash
rm -rf node_modules package-lock.json
npm install
```

`postinstall` 脚本会自动执行 `electron-builder install-app-deps` 为 Electron 42 重新编译 better-sqlite3 原生模块。

### 3. 下载 Electron 二进制

Electron 42 不再通过 postinstall 自动下载二进制，需手动触发：

```bash
node node_modules/electron/install.js
```

或保留 package.json 脚本：
```json
"postinstall2": "node node_modules/electron/install.js"
```

### 4. 修改源码 import

Electron 42 + Node.js 24 不再支持从 `electron` 的命名导出，全部改为命名空间导入。涉及 4 个文件：

```ts
// 旧写法（不支持）
import { app, BrowserWindow, ipcMain } from 'electron'

// 新写法
import * as electron from 'electron/main'
const { app, BrowserWindow, ipcMain } = electron
```

- [src/main/index.ts](../src/main/index.ts)
- [src/main/controller/userController.ts](../src/main/controller/userController.ts)
- [src/main/utils/logger.ts](../src/main/utils/logger.ts)
- [src/preload/index.ts](../src/preload/index.ts)

### 5. 修复 AppUserModelId 冲突

开发环境下 `node_modules/electron/dist/electron.exe` 和安装后的 `lwx-crud.exe` 共用同一个 AppUserModelId，Windows 会将两个程序视为同一个应用，开始菜单出现混淆。

`src/main/index.ts` 中加上 `app.isPackaged` 判断：

```ts
// 修改前
if (process.platform === 'win32') {
  app.setAppUserModelId('com.electron.crud-app')
}

// 修改后
if (process.platform === 'win32' && app.isPackaged) {
  app.setAppUserModelId('com.electron.crud-app')
}
```

---

## 二、踩坑记录

### 1. better-sqlite3 编译失败

Electron 42 内嵌 Node.js v24（NODE_MODULE_VERSION 146），V8 14.8 的 external API 签名变了，旧版 better-sqlite3 的原生模块无法编译。

**解决**：升级到 better-sqlite3 12.11.1（首个支持 Electron 42 prebuild 的版本），并确保 `postinstall` 执行 `electron-builder install-app-deps`。

### 2. SyntaxError: does not provide an export named

```
SyntaxError: The requested module 'electron' does not provide an export named 'BrowserWindow'
```

`import { BrowserWindow } from 'electron'` 在 Node.js 24 ESM 模式下无法解析 Electron 的 CJS 导出。

**解决**：改用 `import * as electron from 'electron/main'` 命名空间导入。

### 3. 开发版和安装版冲突

Windows 根据 AppUserModelId 将同一 ID 的程序视为一个应用。开发时运行的 `electron.exe` 和安装后的 `lwx-crud.exe` 都设置了 `com.electron.crud-app`，导致开始菜单出现混淆（多出一个 Electron 原始图标）。

**解决**：仅在 `app.isPackaged` 时设置 AppUserModelId。

---

## 三、打包验证

```bash
# 构建 + 打包
npm run package:win

# 产物
release/人员管理系统 Setup 1.0.0.exe
```

在纯净系统上安装验证：桌面快捷方式、开始菜单、任务栏图标、数据库读写均正常。
