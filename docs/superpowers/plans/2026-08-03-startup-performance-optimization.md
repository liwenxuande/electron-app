# 启动性能优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 修复首次打开软件 Splash 白屏无动画、主窗口白屏，并通过 ElementPlus 按需引入、视图懒加载、ECharts 延迟初始化、MCP 启动后置，全面降低启动加载耗时。

**架构：** 渲染进程采用 unplugin-vue-components + unplugin-auto-import 实现 ElementPlus 按需引入，5 个视图改 defineAsyncComponent 懒加载，ECharts 注册迁移到统计页局部模块；主进程将 startMCPServer() 后置到 createWindow() 之后；主/渲染进程分别加计时日志用于前后对比验证。

**技术栈：** Electron 42 + electron-vite 6 + Vue 3.5 + Element Plus 2.9 + ECharts 6 + TypeScript

**规格文档：** `docs/superpowers/specs/2026-08-03-startup-performance-optimization-design.md`

**Commit 风格：** 本项目使用中文 Conventional Commits（如 `fix:`、`perf:`、`chore:` + 中文描述）。

---

### 任务 1：加入启动计时日志（采集基线）

**文件：**
- 修改：`src/main/index.ts`
- 修改：`src/renderer/src/main.ts`

- [ ] **步骤 1：主进程计时**

在 `src/main/index.ts` 中，`let mainWindow: BrowserWindow | null = null` 处附近增加模块级变量：

```ts
let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let bootStart = 0
```

在 `app.whenReady().then(() => {` 函数体首行记录起点：

```ts
app.whenReady().then(() => {
  bootStart = Date.now()
  // ① 第一时间显示启动动画（避免白屏，必须在所有耗时操作之前）
  createSplashWindow()
```

在 `createWindow()` 的 `ready-to-show` 回调中，`mainWindow?.show()` 之后追加耗时日志：

```ts
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow?.show()
    logger.info(`[启动耗时] 主窗口就绪: ${Date.now() - bootStart}ms`)
    // 开发模式自动打开 DevTools
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools()
    }
  })
```

- [ ] **步骤 2：渲染进程计时**

修改 `src/renderer/src/main.ts`：在 `createApp(App)` 之前加入计时起点，`app.mount('#app')` 之后输出耗时：

```ts
import App from './App.vue'

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

console.time('[启动耗时] 渲染进程 bootstrap')
const app = createApp(App)
app.component('v-chart', ECharts)
app.use(ElementPlus, { locale: zhCn })
app.use(ElementPlusX)
app.use(createPinia())
app.mount('#app')
console.timeEnd('[启动耗时] 渲染进程 bootstrap')
```

- [ ] **步骤 3：运行 dev 采集基线数据**

运行：`pnpm dev`
预期：终端/DevTools Console 输出两行 `[启动耗时] ...` 日志。
**在下方记录基线数值，供任务 9 对比：**

```
主窗口就绪：____ms（优化前）
渲染进程 bootstrap：____ms（优化前）
```

- [ ] **步骤 4：Commit**

```bash
git add src/main/index.ts src/renderer/src/main.ts
git commit -m "chore: 新增启动耗时计时日志，用于性能优化前后对比"
```

---

### 任务 2：Splash 白屏 + 动画缺失修复

**文件：**
- 修改：`src/renderer/splash.html:7`

- [ ] **步骤 1：修改 html 背景色**

将 `src/renderer/splash.html` 中：

```css
  html { background: transparent; border-radius: 10px; overflow: hidden; }
```

改为：

```css
  html { background: #E07800; border-radius: 10px; overflow: hidden; }
```

原理：非透明 BrowserWindow 下 Chromium 将 CSS `transparent` 渲染为白色；改为与窗口 `backgroundColor: '#E07800'` 一致的实色后，窗口创建即显示橙底，body 的渐变与 pulse/bounce 动画随之一并渲染。

- [ ] **步骤 2：验证**

运行：`pnpm dev`
预期：启动瞬间 Splash 窗口即为橙色背景（无白屏闪现），logo 脉冲与三点 loading 动画可见。

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/splash.html
git commit -m "fix: 修复 Splash 启动白屏 — html 透明背景改为橙色实底"
```

---

### 任务 3：主窗口挂载前白屏修复

**文件：**
- 修改：`src/renderer/index.html:8`

- [ ] **步骤 1：body 补背景色**

将 `src/renderer/index.html` 中：

```html
  <body>
    <div id="app"></div>
```

改为：

```html
  <body style="background: #FFF8F0;">
    <div id="app"></div>
```

内联样式优先级高于 App.vue 中 `body { background: transparent }`，Vue 挂载前页面直接显示与主窗口 backgroundColor 一致的底色，不露白。

- [ ] **步骤 2：验证**

运行：`pnpm dev`
预期：窗口从出现到仪表盘渲染完成之间显示浅橙底色 `#FFF8F0`，无白色闪烁。

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/index.html
git commit -m "fix: 修复主窗口挂载前白屏 — body 补充背景色"
```

---

### 任务 4：ElementPlus 按需引入

**文件：**
- 修改：`package.json`（devDependencies）
- 修改：`electron.vite.config.ts`
- 修改：`src/renderer/src/main.ts`
- 修改：`src/renderer/src/App.vue`

- [ ] **步骤 1：安装依赖**

运行：

```bash
pnpm add -D unplugin-vue-components unplugin-auto-import
```

预期：`package.json` devDependencies 出现 `unplugin-auto-import` 与 `unplugin-vue-components`。

- [ ] **步骤 2：配置 electron.vite.config.ts**

在 `electron.vite.config.ts` 顶部追加 import：

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
```

将 renderer 段 plugins 改为：

```ts
  // 渲染进程配置
  renderer: {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: 'src/renderer/src/auto-imports.d.ts'
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/renderer/src/components.d.ts'
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src')
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/styles/variables.scss" as *;`,
          api: 'modern-compiler'
        }
      }
    }
  }
```

说明：`dts` 输出到 `src/renderer/src/` 下，可被 `tsconfig.web.json` 的 `include: ["src/renderer/src/**/*.d.ts"]` 覆盖，保证类型检查通过。

- [ ] **步骤 3：main.ts 移除全量注册**

修改 `src/renderer/src/main.ts`：删除以下 3 行：

```ts
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
app.use(ElementPlus, { locale: zhCn })
```

保留 `import zhCn from 'element-plus/es/locale/lang/zh-cn'`（locale 改由 App.vue 的 el-config-provider 注入）。

- [ ] **步骤 4：App.vue 包裹 el-config-provider**

修改 `src/renderer/src/App.vue` 模板，将根节点包进 `<el-config-provider>`：

```html
<template>
  <el-config-provider :locale="zhCn">
    <div id="app-root">
      ...
    </div>
  </el-config-provider>
</template>
```

在 `<script setup lang="ts">` 顶部追加 import：

```ts
import { ref, onMounted } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
```

- [ ] **步骤 5：验证**

运行：`pnpm dev`
预期：无编译错误；仪表盘及各页面 `el-*` 组件样式、弹窗、Message 提示均正常；Console 无 "Failed to resolve component" 或样式缺失告警。

- [ ] **步骤 6：Commit**

```bash
git add electron.vite.config.ts src/renderer/src/main.ts src/renderer/src/App.vue package.json pnpm-lock.yaml
git commit -m "perf: ElementPlus 按需引入，移除全量注册与全量 CSS"
```

---

### 任务 5：清理显式 ElMessage / ElMessageBox 导入

**文件：**
- 修改：`src/renderer/src/components/CategoryDetailDialog.vue:50`
- 修改：`src/renderer/src/views/LedgerManager/index.vue:83`
- 修改：`src/renderer/src/stores/categoryStore.ts:3`
- 修改：`src/renderer/src/stores/transactionStore.ts:3`
- 修改：`src/renderer/src/views/TransactionList/index.vue:100`
- 修改：`src/renderer/src/views/LedgerManager/composables/useLedgerForm.ts:6`

> 保留 `src/renderer/src/components/CsvImportDialog.vue:107` 的 `import type { UploadFile, UploadInstance } from 'element-plus'`（类型导入，auto-import 不处理）。

- [ ] **步骤 1：逐个删除显式导入**

删除以下 6 处 `import { ElMessage / ElMessageBox } from 'element-plus'` 行（unplugin-auto-import 的 ElementPlusResolver 会自动引入 ElMessage/ElMessageBox 及其样式）：

| 文件 | 删除的行 |
|------|----------|
| `src/renderer/src/components/CategoryDetailDialog.vue` | `import { ElMessage } from 'element-plus'` |
| `src/renderer/src/views/LedgerManager/index.vue` | `import { ElMessage, ElMessageBox } from 'element-plus'` |
| `src/renderer/src/stores/categoryStore.ts` | `import { ElMessage } from 'element-plus'` |
| `src/renderer/src/stores/transactionStore.ts` | `import { ElMessage } from 'element-plus'` |
| `src/renderer/src/views/TransactionList/index.vue` | `import { ElMessageBox } from 'element-plus'` |
| `src/renderer/src/views/LedgerManager/composables/useLedgerForm.ts` | `import { ElMessage } from 'element-plus'` |

- [ ] **步骤 2：验证**

运行：`pnpm dev`
预期：无编译错误、无 "ElMessage is not defined" 运行时错误；触发删除账本（ElMessageBox.confirm）、保存分类（ElMessage.success）等操作时弹窗与提示样式正常。

- [ ] **步骤 3：Commit**

```bash
git add src/renderer/src/components/CategoryDetailDialog.vue src/renderer/src/views/LedgerManager/index.vue src/renderer/src/stores/categoryStore.ts src/renderer/src/stores/transactionStore.ts src/renderer/src/views/TransactionList/index.vue src/renderer/src/views/LedgerManager/composables/useLedgerForm.ts
git commit -m "refactor: 移除显式 ElMessage/ElMessageBox 导入，交由 unplugin-auto-import 接管"
```

---

### 任务 6：视图懒加载

**文件：**
- 修改：`src/renderer/src/App.vue`

- [ ] **步骤 1：改为 defineAsyncComponent**

将 `src/renderer/src/App.vue` 的 `<script setup lang="ts">` 中：

```ts
import { ref, onMounted } from 'vue'
import { useLedgerStore } from './stores/ledgerStore'
import { useAI } from './composables/useAI'
import TitleBar from './components/TitleBar.vue'
import DashboardView from './views/DashboardView/index.vue'
import TransactionList from './views/TransactionList/index.vue'
import StatisticsView from './views/StatisticsView/index.vue'
import LedgerManager from './views/LedgerManager/index.vue'
import AISettingsDialog from './components/AISettingsDialog.vue'
import AIView from './views/AIView/index.vue'
```

改为：

```ts
import { ref, onMounted, defineAsyncComponent } from 'vue'
import { useLedgerStore } from './stores/ledgerStore'
import { useAI } from './composables/useAI'
import TitleBar from './components/TitleBar.vue'
import AISettingsDialog from './components/AISettingsDialog.vue'

const DashboardView = defineAsyncComponent(() => import('./views/DashboardView/index.vue'))
const TransactionList = defineAsyncComponent(() => import('./views/TransactionList/index.vue'))
const StatisticsView = defineAsyncComponent(() => import('./views/StatisticsView/index.vue'))
const LedgerManager = defineAsyncComponent(() => import('./views/LedgerManager/index.vue'))
const AIView = defineAsyncComponent(() => import('./views/AIView/index.vue'))
```

- [ ] **步骤 2：AIView 由 v-show 改为 v-if**

将模板中：

```html
          <AIView v-show="activeNav === 'ai'" />
```

改为：

```html
          <AIView v-if="activeNav === 'ai'" />
```

说明：聊天会话/消息保存在 pinia `aiSessionStore` 中，`v-if` 卸载重建不丢数据；`onMounted` 中 `chat.store.init()` 幂等可重复执行。

- [ ] **步骤 3：验证**

运行：`pnpm dev`
预期：首屏仅加载 DashboardView 对应 chunk；切换到账单/统计/账本/AI 各页均正常渲染；AI 页会话记录与消息完整恢复。

- [ ] **步骤 4：Commit**

```bash
git add src/renderer/src/App.vue
git commit -m "perf: 视图懒加载 — 5 个页面改 defineAsyncComponent，AIView 改 v-if"
```

---

### 任务 7：ECharts 延迟初始化

**文件：**
- 创建：`src/renderer/src/utils/echarts.ts`
- 修改：`src/renderer/src/views/StatisticsView/index.vue`
- 修改：`src/renderer/src/main.ts`

- [ ] **步骤 1：创建共享 ECharts 注册模块**

创建 `src/renderer/src/utils/echarts.ts`：

```ts
/**
 * ECharts 集中注册模块 — 仅在统计页懒加载时被引入
 */
import ECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

export default ECharts
```

- [ ] **步骤 2：StatisticsView 局部注册 v-chart**

修改 `src/renderer/src/views/StatisticsView/index.vue` 的 `<script setup lang="ts">`：追加 import（模板中 `<v-chart>` 会自动解析到 PascalCase 变量 `VChart`）：

```ts
import { ref, computed, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import VChart from '@/utils/echarts'
```

- [ ] **步骤 3：main.ts 移除全局 ECharts 注册**

修改 `src/renderer/src/main.ts`：删除以下 echarts 相关行：

```ts
import ECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
```

以及：

```ts
use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])
app.component('v-chart', ECharts)
```

- [ ] **步骤 4：验证**

运行：`pnpm dev`
预期：首屏 Network 中不再加载 echarts chunk；进入统计页后"收支趋势"折线图、"消费分类占比"饼图正常渲染。

- [ ] **步骤 5：Commit**

```bash
git add src/renderer/src/utils/echarts.ts src/renderer/src/views/StatisticsView/index.vue src/renderer/src/main.ts
git commit -m "perf: ECharts 延迟初始化 — 仅统计页进入时加载"
```

---

### 任务 8：主进程 MCP 启动后置

**文件：**
- 修改：`src/main/index.ts`

- [ ] **步骤 1：调整 startMCPServer 调用位置**

将 `src/main/index.ts` 中：

```ts
  // ⑤ 启动 MCP HTTP 服务（外部 AI 通过 mcp-agent.cjs → localhost:19527 访问）
  startMCPServer()

  // ⑥ 注册系统通知 IPC（测试用）
  ipcMain.handle('notification:show', (_event, title: string, body: string) => {
    ...
  })

  // ⑦ 创建渲染窗口（后台加载）
  createWindow()
```

调整为（`startMCPServer()` 移到 `createWindow()` 之后）：

```ts
  // ⑥ 注册系统通知 IPC（测试用）
  ipcMain.handle('notification:show', (_event, title: string, body: string) => {
    ...
  })

  // ⑦ 创建渲染窗口（后台加载）
  createWindow()

  // ⑤ 启动 MCP HTTP 服务（外部 AI 通过 mcp-agent.cjs → localhost:19527 访问）
  startMCPServer()
```

函数体保持原样，仅调整调用顺序，窗口创建不再被 MCP HTTP 服务启动阻塞。

- [ ] **步骤 2：验证**

运行：`pnpm dev`
预期：应用正常启动；外部访问 `http://localhost:19527` 仍可连通（MCP 服务正常启动）。

- [ ] **步骤 3：Commit**

```bash
git add src/main/index.ts
git commit -m "perf: MCP 服务器启动后置到主窗口创建之后，不阻塞窗口显示"
```

---

### 任务 9：优化前后对比验证

**文件：** 无（仅验证）

- [ ] **步骤 1：复测计时日志**

运行：`pnpm dev`
预期：终端/DevTools Console 再次输出两行 `[启动耗时] ...` 日志。

**记录优化后数值并对比任务 1 基线：**

```
主窗口就绪：____ms（优化前）→ ____ms（优化后）
渲染进程 bootstrap：____ms（优化前）→ ____ms（优化后）
```

- [ ] **步骤 2：逐项回归验证（对照规格验证清单）**

运行 `pnpm dev`，逐项检查：

- [ ] Splash 打开即橙色背景，pulse/bounce 动画可见
- [ ] 主窗口挂载前不露白
- [ ] 仪表盘首屏正常，无组件/样式缺失
- [ ] 账单明细页（含分页、导入 CSV 弹窗）正常
- [ ] 统计页折线图、饼图正常渲染（ECharts 延迟加载生效）
- [ ] 账本管理页增删改查、删除确认弹窗正常
- [ ] AI 页进入后会话、消息正常恢复
- [ ] MCP 服务可访问（`http://localhost:19527`）

- [ ] **步骤 3：构建验证**

运行：`pnpm build`
预期：构建成功，`out/renderer` 下主入口 chunk 明显小于优化前（可视化为多个按需 chunk）。
