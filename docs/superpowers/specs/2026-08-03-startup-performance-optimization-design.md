# 启动性能优化规格

## 概述

解决首次打开软件的两个问题：

1. **闪屏显示白色背景、无动画效果** — `splash.html` 中 `html { background: transparent }` 在 Windows 非透明窗口下被 Chromium 退化为白色渲染，`<html>` 先于 `<body>` 绘制，白底闪现后才出现橙色渐变与动画。
2. **加载速度慢** — 渲染进程全量引入 ElementPlus/ECharts，5 个视图全部 eager 打包进主 chunk，主进程 MCP 启动同步阻塞窗口创建。

本次为**全面启动性能优化**，覆盖：Splash 白屏修复、主窗口白屏修复、ElementPlus 按需引入、视图懒加载、ECharts 延迟初始化、主进程 MCP 后置异步化、计时日志验证。

## 约束

- 不改变任何业务功能、页面布局与交互行为
- AI 聊天状态保存在 pinia store 中，懒加载不得导致会话/消息丢失
- 不改动数据库、IPC 控制器、MCP 服务逻辑（仅调整启动时机）
- 优化前后需通过计时日志量化对比验证

## 依赖变更

### 新增（devDependencies）

- `unplugin-vue-components` — 自动按需解析模板中 `el-*` 组件
- `unplugin-auto-import` — 自动按需引入 `ElMessage` 等 API 及样式

### 安装命令

```
pnpm add -D unplugin-vue-components unplugin-auto-import
```

## 第 1 节：Splash 白屏修复

**文件：`src/renderer/splash.html`**

- 将 `html { background: transparent; ... }` 中的 `background: transparent` 移除，改为 `background: #E07800`（与 BrowserWindow `backgroundColor: '#E07800'` 一致）
- body 的渐变背景、pulse/bounce 动画保持不变

**原理**：非透明 BrowserWindow 下 Chromium 将 CSS `transparent` 渲染为白色，修复后窗口创建即显示橙色底，动画随 body 一并渲染。

## 第 2 节：主窗口白屏修复

**文件：`src/renderer/index.html`**

- `<body>` 增加内联样式 `background: #FFF8F0`（与主窗口 `backgroundColor: '#FFF8F0'`、`#app-root` 背景一致）

**原理**：Vue 挂载前 body 无背景色透出默认白色，补色后挂载间隙不露白。

## 第 3 节：ElementPlus 按需引入

### 构建配置：`electron.vite.config.ts`

renderer 段 plugins 追加：

```ts
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

plugins: [
  vue(),
  AutoImport({ resolvers: [ElementPlusResolver()] }),
  Components({ resolvers: [ElementPlusResolver()] })
]
```

### `src/renderer/src/main.ts`

- 移除 `import ElementPlus from 'element-plus'`、`import 'element-plus/dist/index.css'`、`app.use(ElementPlus, { locale: zhCn })`
- 保留 `import zhCn from 'element-plus/es/locale/lang/zh-cn'`

### `src/renderer/src/App.vue`

- 根部模板用 `<el-config-provider :locale="zhCn">` 包裹（替换原全局 locale 注入）

### 清理显式导入（auto-import 接管）

删除以下文件中 `import { ElMessage / ElMessageBox } from 'element-plus'`（值导入，auto-import 接管）：

- `src/renderer/src/components/CategoryDetailDialog.vue`
- `src/renderer/src/views/LedgerManager/index.vue`
- `src/renderer/src/stores/categoryStore.ts`
- `src/renderer/src/stores/transactionStore.ts`
- `src/renderer/src/views/TransactionList/index.vue`
- `src/renderer/src/views/LedgerManager/composables/useLedgerForm.ts`

**保留** `import type { UploadFile, UploadInstance }`（CsvImportDialog.vue）— 类型导入 auto-import 不处理，原样保留。

> 若 ElMessage 在 `script setup` 外（如 store 文件）使用，需确认 unplugin-auto-import 对普通 .ts 文件同样生效；否则在这些文件保留显式值导入并单独补充对应样式。

### 保留

- `app.use(ElementPlusX)` — `vue-element-plus-x` 为 AI 扩展组件包（Bubble/XSender 等），不含 `el-*`，全局注册保留

## 第 4 节：视图懒加载

**文件：`src/renderer/src/App.vue`**

- 5 个视图改为 `defineAsyncComponent` 懒加载：

```ts
const DashboardView = defineAsyncComponent(() => import('./views/DashboardView/index.vue'))
const TransactionList = defineAsyncComponent(() => import('./views/TransactionList/index.vue'))
const StatisticsView = defineAsyncComponent(() => import('./views/StatisticsView/index.vue'))
const LedgerManager = defineAsyncComponent(() => import('./views/LedgerManager/index.vue'))
const AIView = defineAsyncComponent(() => import('./views/AIView/index.vue'))
```

- 首屏仅加载 DashboardView
- **AIView 由 `v-show` 改为 `v-if`**：聊天状态在 `aiSessionStore`（pinia）中，会话与消息不丢失；`onMounted` 中 `store.init()` 幂等可重复执行
- 本地资源加载极快，不设 loading 占位组件

## 第 5 节：ECharts 延迟初始化

**现状**：仅 StatisticsView 使用 `v-chart`，DashboardView 不用。

- 新建 `src/renderer/src/utils/echarts.ts`，集中注册并导出：

```ts
import ECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])
export default ECharts
```

- StatisticsView 局部注册 `v-chart` 并改用该模块
- `src/renderer/src/main.ts` 移除 echarts 相关 import、`app.component('v-chart', ECharts)`
- 效果：ECharts 仅在进入统计页时加载

## 第 6 节：主进程 MCP 启动后置异步化

**文件：`src/main/index.ts`**

- 将 `startMCPServer()` 从 `createWindow()` 之前移到之后调用（异步执行，不阻塞窗口创建）
- MCP 服务逻辑不变，仅调整启动时机

## 第 7 节：计时日志（验证手段）

- **主进程** `src/main/index.ts`：`app.whenReady` 入口记录起点，`ready-to-show` 回调记录 `启动 → 主窗口就绪` 耗时，经现有 logger 输出
- **渲染进程** `src/renderer/src/main.ts`：记录模块执行起点与 `app.mount()` 完成耗时（`console.time` / `performance.now`）
- **对比方法**：优化前后各运行一次 `pnpm dev`，收集两组日志数据对比

## 预期收益

| 项 | 优化前 | 优化后 |
|----|--------|--------|
| Splash 显示 | 白底闪现 → 无动画 | 橙底 + 动画立即显示 |
| 首屏 JS/CSS | 全量 ElementPlus + ECharts + 5 视图 | 仅 DashboardView + 按需组件（预计 -60%+） |
| 窗口创建 | 被 MCP 启动阻塞 | 立即创建 |
| 统计页 ECharts | 首屏加载 | 进入统计页才加载 |

## 验证清单

- [ ] Splash 打开即橙色背景，pulse/bounce 动画可见
- [ ] 主窗口挂载前不露白
- [ ] 首屏正常显示仪表盘，无组件/样式缺失（ElementPlus 按需后逐页回归）
- [ ] AIView 切换进入后会话、消息正常恢复
- [ ] 统计页图表正常渲染
- [ ] MCP 服务仍可正常启动（`pnpm logs:ai` / 外部访问 localhost:19527）
- [ ] 优化前后计时日志对比，启动耗时下降
