# Electron 踩坑记录

本项目的实际问题及解决方案。

---

## 1. preload 脚本未加载 → window.xxxAPI undefined

**现象**：`Cannot read properties of undefined (reading 'getUserList')`，`window.userAPI` 不存在。

**原因**：`package.json` `"type": "module"` → electron-vite 将 preload 编译为 `.mjs`，但主进程引用的是 `.js`。

**解决**：[src/main/index.ts](../src/main/index.ts)

```ts
// ❌
preload: path.join(__dirname, '../preload/index.js')
// ✅
preload: path.join(__dirname, '../preload/index.mjs')
```

---

## 2. TypeScript 报错：Window 上不存在 userAPI

**现象**：`类型"Window & typeof globalThis"上不存在属性"userAPI"`

**原因**：renderer 的 `tsconfig.web.json` 不会自动引入 `src/preload/index.d.ts`。

**解决**：[src/renderer/src/env.d.ts](../src/renderer/src/env.d.ts) 中直接声明，末尾加 `export {}`：

```ts
declare global {
  interface Window {
    userAPI: UserAPI
  }
}
export {}  // ← 关键
```

---

## 3. preload 类型声明不生效

**现象**：`env.d.ts` 里写了 `declare global` 但 IDE 仍报类型错误。

**原因**：`.d.ts` 文件没有 `import/export` 时是 ambient script 模式，`declare global` 不按预期合并。

**解决**：文件末尾加 `export {}`，转为 module 模式。

---

## 4. Windows 控制台中文乱码

**现象**：logger 输出中文变乱码（如 `应用启动完成` → `搴旂敤鍚姩瀹屾垚`）。

**原因**：Windows 终端默认编码 GBK(936)，Node.js 输出 UTF-8。

**解决**：

```ts
// src/main/index.ts
import { execSync } from 'child_process'
if (process.platform === 'win32') {
  execSync('chcp 65001', { stdio: 'ignore' })
  process.stdout.setDefaultEncoding('utf-8')
}
```

```json
// package.json
"dev": "chcp 65001 > nul && electron-vite dev"
```

---

## 5. 打包后运行报找不到 dayjs

**现象**：安装后启动报 `Cannot find package 'dayjs'`。

**原因**：`electron-builder.yml` 里 `"!node_modules"` 排除了所有依赖。

**解决**：去掉 `"!node_modules"`，electron-builder 会自动区分 `dependencies`（打包）和 `devDependencies`（不打包）。

---

## 6. 打包报 NSIS 编译失败

**现象**：`ERR_ELECTRON_BUILDER_CANNOT_EXECUTE`，makensis 返回 exit code 1。

**原因**：`installer.nsh` 中定义了 `Function .onGUIInit` 或 `Function .onVerifyInstDir`，与 electron-builder 生成的同名函数冲突。

**解决**：改用 `!macro customInit` / `!macro customInstall` 等宏钩子。

---

## 7. tsconfig rootDir 越界报错

**现象**：`文件"electron.vite.config.ts"不在 "rootDir""f:/.../src"下`

**解决**：`tsconfig.node.json` 的 include 中去掉 `"electron.vite.config.ts"`。

---

## 8. 窗口左上角图标不显示

**现象**：开发/安装后窗口左上角是空白图标。

**解决**：两处配置缺一不可：

```ts
// main — BrowserWindow
icon: app.isPackaged
  ? path.join(process.resourcesPath, 'icon.ico')
  : path.join(__dirname, '../../build/icon.ico')
```

```yaml
# electron-builder.yml
extraResources:
  - from: build/icon.ico
    to: icon.ico
```

---

## 9. 安装后数据库有测试数据

**现象**：安装版启动后表里有开发时存的测试记录。

**原因**：开发和生产共用 `%APPDATA%/人员管理系统/data.db`。

**解决**：用 `app.isPackaged` 区分文件名：开发 `data.dev.db`，生产 `data.db`。

---

## 10. 无边框窗口 DevTools 打不开

**现象**：`frame: false` 后 `Ctrl+Shift+I` 失效。

**解决**：手动注册 IPC + 渲染进程全局快捷键：

```ts
// main
ipcMain.handle('window:toggleDevTools', () => mainWindow?.webContents.toggleDevTools())

// renderer
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'I') window.userAPI.toggleDevTools()
})
```

---

## 11. 最大化窗口拖拽报 TypeError

**现象**：最大化状态下拖标题栏，控制台报错。

**原因**：Electron 33 的 `screen.getDisplayMatching()` 接受 `Rectangle` 而非 `Point`。

**解决**：`screen.getDisplayMatching({ ...cursor, width: 1, height: 1 })`

---

## 12. 最大化拖拽还原位置不跟手

**现象**：拖拽时窗口跳到别的位置，手感差。

**原因**：
- `getNormalBounds()` 首次调用可能未就绪
- `setBounds` 的 Y 偏移写死了

**解决**：
- `getNormalBounds()` 包 try-catch
- 用 `ratioX = cursor.x / screenWidth` 计算鼠标在窗口中的相对位置
- `setBounds` 的 x 用 `cursor.x - normalW * ratioX`

---

## 13. Splash 启动动画一闪而过

**现象**：开发模式下 splash 窗口几乎看不到。

**原因**：Vite 热更新 + 小项目加载极快。

**解决**：`ready-to-show` 后加最小展示时间：

```ts
const splashStart = Date.now()
mainWindow.once('ready-to-show', () => {
  setTimeout(() => { splashWindow?.close(); mainWindow?.show() },
    Math.max(0, 1500 - (Date.now() - splashStart)))
})
```

---

## 14. 无边框窗口全屏有白边

**现象**：最大化后窗口边缘有一条白/灰线。

**原因**：`#app-root` 设了 `border: 1px solid rgba(...)`。

**解决**：去掉 border，无边框窗口不需要轮廓线。

---

## 15. 窗口透明导致拖拽残影

**现象**：`transparent: true` 后拖拽时有个透明边框不消失。

**解决**：圆角不需要透到桌面时，去掉 `transparent`，用 `backgroundColor` 填充即可。

---

## 16. 通知显示 electron.app.xxx

**现象**：开发时系统通知来源显示 `electron.app.人员管理系统`。

**解决**：

```ts
// 必须在 app.whenReady() 之前
app.setAppUserModelId('com.electron.crud-app')
```

> 开发模式下始终显示 AUMID，只有安装后 Windows 才会映射为显示名。

---

## 17. exe 文件名是中文

**解决**：`electron-builder.yml` 加 `executableName: lwx-crud`。

---

## 18. 安装版 Splash 动画不显示

**现象**：安装后启动，splash 窗口只有纯色背景，logo/文字/动画全没。

**原因**：`splash.html` 在 `src/renderer/` 下，electron-vite 不会把它编译到 `out/renderer/`。打包后的 asar 里根本没有这个文件，`loadFile` 找不到。

**解决**：

```yaml
# electron-builder.yml — 打包时复制 splash.html 到 resources/
extraResources:
  - from: src/renderer/splash.html
    to: splash.html
```

```ts
// main — 生产模式从 resourcesPath 加载
splashWindow.loadFile(path.join(process.resourcesPath, 'splash.html'))
```

> 开发模式走 Vite dev server（`/splash.html` 直接能用），不受影响。
