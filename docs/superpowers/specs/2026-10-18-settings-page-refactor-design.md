# 设置页面重构 — DeepSeek API Key 存储方案变更 设计规格

- 日期：2026-10-18
- 状态：待评审
- 主题：独立设置页 + electron-store 明文配置 + AI / MCP 配置能力

## 1. 背景

当前设置入口是侧边栏底部的齿轮按钮，点击后打开 `AISettingsDialog.vue` 弹窗，仅支持配置 API Key 和模型。存在以下问题：

1. API Key 由 `aiConfigService` 手写读写 `userData/ai/config.json`，使用 `safeStorage` 加密；加密不可用时降级为 base64，换机或加密环境变化后 Key 可能无法解密。
2. 配置没有统一的 schema、默认值和管理入口，后续增加设置项需要重复手写文件逻辑。
3. MCP 服务固定监听 `127.0.0.1:19527`，应用启动即开启，没有开关、端口配置和状态展示。
4. `功能需求清单.md` 5.4 中设置页面仍为待开发状态。

本次将设置从弹窗重构为独立页面，并用 electron-store 统一管理 AI 与 MCP 配置。

## 2. 目标与非目标

### 2.1 目标

1. 使用 electron-store 管理 DeepSeek API Key 和模型名称，Key 以明文保存在 `userData/config.json`。
2. 首次启动自动迁移旧 `userData/ai/config.json`，迁移成功后删除旧文件。
3. 新增独立设置页，左侧分组导航：AI 配置、MCP 服务、通用、数据、关于。
4. AI 配置页支持：API Key 小眼睛显示/隐藏、模型手动输入、调用 DeepSeek 官方接口刷新模型列表、测试连接、保存配置。
5. MCP 配置页支持：启用/禁用、监听端口、运行状态、复制客户端配置。
6. 通用 / 数据 / 关于提供基础只读信息，不做额外功能。
7. 删除旧弹窗及其状态，AI 对话和报告功能行为保持不变。

### 2.2 非目标

1. 不引入多个 AI Provider，不设计多 Key 结构。
2. 不做系统凭据库（keytar / Windows Credential Manager）接入。
3. 不做深色模式、主题切换、语言切换。
4. 不做预算目标、通知偏好等其他设置项。
5. 不改变 AI 对话、流式输出、工具调用、月报和统计解读的业务逻辑。
6. 不实现自动更新入口。

## 3. 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 配置存储库 | electron-store 12.x | Electron 生态成熟方案，支持默认值、schema、原子写入、变更监听 |
| API Key 存储方式 | 明文 JSON | 符合“配置文件”诉求，用户可直接查看和手动修改，换机拷贝即用 |
| 旧配置处理 | 自动迁移，成功后删除旧文件 | 避免用户重新输入；失败保留旧文件并记录日志 |
| 设置页形态 | 独立页面 + 左侧分组导航 | 便于后续扩展设置项 |
| 模型选择 | 可手动输入 + 官方 `/models` 拉取 | 既支持官方模型，也允许用户使用自定义模型名 |
| 测试连接 | 保留一次 chat 请求 | 能验证具体模型的对话能力；与模型列表刷新分开 |
| 模型列表刷新 | `GET https://api.deepseek.com/models` | 免费、不消耗 token，同时验证 Key 有效性 |
| MCP 配置 | 开关 + 端口 + 状态 + 复制配置 | 覆盖实际使用场景 |
| 代码组织 | 配置层 + 领域服务分层 | 避免 AI 服务承担通用配置职责，便于扩展 |

## 4. 总体架构

```
渲染进程
  SettingsView
    ├─ SettingsSidebar
    ├─ AISettingsPanel
    ├─ MCPSettingsPanel
    ├─ GeneralSettingsPanel
    ├─ DataSettingsPanel
    └─ AboutSettingsPanel
        │  window.settingsAPI（preload contextBridge）
        ▼
主进程
  settingsController
    ├─ configStore（electron-store 唯一实例）
    ├─ aiConfigService ── deepseekClient
    ├─ mcp-server（start / stop / status）
    └─ paths（dataDir / dbPath / configPath）
```

职责边界：

- `configStore`：唯一负责配置文件的创建、默认值、schema 校验和旧配置迁移。
- `aiConfigService`：AI 领域配置的读写与 DeepSeek 客户端创建，不直接操作文件。
- `mcp-server`：MCP HTTP 服务的启动、停止、状态查询，不读取配置文件。
- `settingsController`：IPC 入口，负责参数校验、编排 service、统一返回 `{ code, data, msg }`。
- `SettingsView`：设置页布局和分组切换；各 Panel 只负责自身表单和状态。

## 5. 配置存储层

### 5.1 文件与结构

electron-store 默认文件：`userData/config.json`。

```json
{
  "ai": {
    "apiKey": "sk-0123456789abcdef",
    "model": "deepseek-v4-flash"
  },
  "mcp": {
    "enabled": true,
    "port": 19527
  }
}
```

默认值：

```ts
const defaults: AppConfig = {
  ai: { apiKey: '', model: 'deepseek-v4-flash' },
  mcp: { enabled: true, port: 19527 },
}
```

类型定义：

```ts
interface AppConfig {
  ai: { apiKey: string; model: string }
  mcp: { enabled: boolean; port: number }
}
```

schema 约束：

- `ai.apiKey`：string
- `ai.model`：string，非空
- `mcp.enabled`：boolean
- `mcp.port`：integer，最小 1024，最大 65535

schema 示例：

```json
{
  "type": "object",
  "properties": {
    "ai": {
      "type": "object",
      "properties": {
        "apiKey": { "type": "string" },
        "model": { "type": "string", "minLength": 1 }
      },
      "required": ["apiKey", "model"]
    },
    "mcp": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "port": { "type": "integer", "minimum": 1024, "maximum": 65535 }
      },
      "required": ["enabled", "port"]
    }
  },
  "required": ["ai", "mcp"]
}
```

说明：electron-store 12.x 要求 Node.js >= 22；当前开发环境 Node 24，Electron 42，满足要求。依赖使用 pnpm 安装，加入 `dependencies`。

### 5.2 初始化

- 新增 `src/main/service/configStore.ts`，导出 `getConfigStore()` 和 `migrateLegacyAIConfig()`。
- 在 `app.whenReady()` 后、数据库初始化之后调用初始化，避免 `app.getPath` 时机问题。
- 实例创建参数：

```ts
new Store<AppConfig>({
  name: 'config',
  defaults,
  schema,
  clearInvalidConfig: true,
})
```

`clearInvalidConfig: true` 用于配置文件损坏时恢复默认值，避免应用启动失败；损坏文件会被重置，属于可接受的最后兜底。

### 5.3 旧配置迁移

旧文件：`userData/ai/config.json`，结构为：

```ts
interface LegacyAIConfig {
  encryptedKey: string
  model: string
  encrypted?: boolean
}
```

迁移流程：

1. 如果新配置 `ai.apiKey` 已有值，跳过迁移。
2. 如果旧文件不存在，跳过迁移。
3. 读取旧文件并解析。
4. 按旧逻辑解密：
   - `encrypted !== false` 且 `safeStorage.isEncryptionAvailable()` 为真：`safeStorage.decryptString(Buffer.from(encryptedKey, 'base64'))`
   - 否则：`Buffer.from(encryptedKey, 'base64').toString()`
5. 将解密后的 Key 和旧 `model`（若存在）写入 electron-store。
6. 迁移成功后删除旧文件（`userData/ai/config.json`）；如果 `ai` 目录为空，一并删除。
7. 任一步失败：记录错误日志，保留旧文件，不覆盖新配置。

迁移只在首次启动执行一次，不保留迁移标记；以“新配置无 Key + 旧文件存在”作为触发条件。

## 6. 主进程服务与 IPC

### 6.1 aiConfigService

对外方法签名保持不变，内部改为读写 `configStore`：

- `saveApiKey(plainKey: string): void`
- `getApiKey(): string | null`
- `saveModel(model: string): void`
- `getModel(): string`
- `hasKey(): boolean`
- `testConnection(key?: string, model?: string): Promise<boolean>`
- `createClient(): DeepSeekClient | null`

新增：

- `getConfig(): { apiKey: string; model: string }`：返回真实 Key，供设置页小眼睛显示。
- `saveConfig(apiKey: string, model: string): void`：一次性保存两项。
- `listModels(key?: string): Promise<string[]>`：调用 DeepSeek 官方模型列表接口。

移除 `fs`、`safeStorage` 和 `cachedKey` 相关逻辑；electron-store 自身承担内存缓存。

### 6.2 DeepSeek 模型列表

在 `deepseekClient.ts` 增加 GET 请求封装：

```
GET https://api.deepseek.com/models
Authorization: Bearer <apiKey>
Accept: application/json
```

响应结构：

```json
{
  "object": "list",
  "data": [
    { "id": "deepseek-v4-flash", "object": "model", "owned_by": "deepseek" },
    { "id": "deepseek-v4-pro", "object": "model", "owned_by": "deepseek" }
  ]
}
```

处理规则：

- 取 `data[].id` 返回 `string[]`。
- 未提供 Key 且本地无 Key：直接返回错误“请先填写 API Key”，不发请求。
- HTTP 错误：优先使用响应体 `error.message`，否则返回 `HTTP <status>`。
- 超时：沿用现有 60 秒请求超时。
- 模型列表只用于下拉建议，不限制用户输入；即使拉取失败，用户仍可手动保存模型名。

### 6.3 MCP 服务生命周期

重构 `src/main/mcp/mcp-server.ts`：

- `startMCPServer(port: number): Promise<void>`
- `stopMCPServer(): Promise<void>`
- `getMCPStatus(): { running: boolean; port: number | null; error: string | null }`

启动规则：

- 应用启动时读取 `mcp.enabled`：
  - `true`：调用 `startMCPServer(mcp.port)`。
  - `false`：不启动。
- 监听地址固定 `127.0.0.1`。
- 端口被占用（`EADDRINUSE`）时记录状态错误，不阻塞应用启动。

保存配置采用事务式应用：

1. 校验端口为 1024–65535 的整数。
2. 若新配置为“禁用”：
   - 停止当前服务（如运行中）。
   - 写入配置。
3. 若新配置为“启用”：
   - 如果当前未运行或端口变化：先在新端口启动。
   - 启动成功：写入配置；若端口变化，停止旧实例。
   - 启动失败：保留原配置和原服务，返回错误，不落盘。
4. 仅在服务状态变更成功或确认禁用后写入 electron-store。

`resources/mcp-agent.cjs` 调整：

```js
const PORT = process.env.PF_MCP_PORT || 19527
const ELECTRON_URL = `http://127.0.0.1:${PORT}/mcp`
```

默认端口仍为 19527，现有 `plugin/.mcp.json` 无需修改即可工作；修改端口后，用户应使用设置页生成的客户端配置。

### 6.4 路径工具

新增 `src/main/utils/paths.ts`：

- `getDataDir(): string`：`app.getPath('userData')`
- `getDbPath(): string`：打包环境 `data.db`，开发环境 `data.dev.db`
- `getConfigPath(): string`：`path.join(getDataDir(), 'config.json')`
- `getMcpAgentPath(): string`：打包环境 `path.join(process.resourcesPath, 'resources', 'mcp-agent.cjs')`；开发环境 `path.join(app.getAppPath(), 'resources', 'mcp-agent.cjs')`

`src/main/index.ts` 中数据库路径计算改为复用 `getDbPath()`。

### 6.5 IPC 接口

所有接口统一返回 `{ code: number; data: unknown; msg: string }`，`code === 0` 表示成功。

| 通道 | 请求 | 成功返回 `data` |
|---|---|---|
| `settings:ai:get` | 无 | `{ apiKey: string; model: string }` |
| `settings:ai:save` | `{ apiKey: string; model: string }` | `null` |
| `settings:ai:test` | `{ apiKey?: string; model?: string }` | `null`，成功 `msg` 为“连接成功” |
| `settings:ai:models` | `{ apiKey?: string }` | `string[]` |
| `settings:mcp:get` | 无 | `{ enabled: boolean; port: number; running: boolean; error: string \| null; clientConfig: string }` |
| `settings:mcp:save` | `{ enabled: boolean; port: number }` | `{ running: boolean; port: number; error: string \| null }` |
| `settings:app:info` | 无 | `{ version: string; dataDir: string; dbPath: string; configPath: string }` |
| `settings:app:open-path` | `{ path: string }` | `null` |
| `settings:app:copy` | `{ text: string }` | `null` |

`settings:mcp:get` 返回的 `clientConfig` 由主进程生成：

```json
{
  "mcpServers": {
    "个人记账": {
      "command": "node",
      "args": ["<mcp-agent.cjs 绝对路径>"],
      "env": { "PF_MCP_PORT": "<当前端口>" }
    }
  }
}
```

尖括号内容为运行时替换值，不属于未定项。

`settings:app:open-path` 只允许打开 `dataDir` 或 `configPath` 所在目录，避免渲染进程传入任意路径；实现时对传入路径与允许列表做比较。

### 6.6 preload 暴露

新增 `window.settingsAPI`：

```ts
interface SettingsAPI {
  getAIConfig(): Promise<IpcResponse<{ apiKey: string; model: string }>>
  saveAIConfig(config: { apiKey: string; model: string }): Promise<IpcResponse<null>>
  testAIConnection(params?: { apiKey?: string; model?: string }): Promise<IpcResponse<null>>
  listModels(params?: { apiKey?: string }): Promise<IpcResponse<string[]>>

  getMCPConfig(): Promise<IpcResponse<MCPConfigData>>
  saveMCPConfig(config: { enabled: boolean; port: number }): Promise<IpcResponse<MCPStatus>>

  getAppInfo(): Promise<IpcResponse<AppInfo>>
  openPath(path: string): Promise<IpcResponse<null>>
  copyText(text: string): Promise<IpcResponse<null>>
}
```

`aiAPI` 保留对话、会话、报告相关方法；移除 `saveConfig`、`getConfig`、`testConnection`，由 `settingsAPI` 接管。同步更新 `src/preload/index.d.ts`。

## 7. 设置页 UI

### 7.1 整体布局

- `App.vue` 侧边栏底部齿轮不再打开弹窗，改为设置 `activeNav = 'settings'`。
- 新增 `SettingsView`，在 `.app-content` 区域内渲染。
- 页面结构：左侧设置分组导航（168px）+ 右侧内容区。
- 分组：AI 配置、MCP 服务、通用、数据、关于。
- 默认分组：AI 配置。
- 视觉沿用项目现有 token：
  - 主色 `$color-primary: #FF8C00`，浅底 `$color-primary-light: #FFF5E6`
  - 页面暖底 `#FFF8F0`
  - 卡片 `rgba(255, 255, 255, 0.85)` + `backdrop-filter: blur(8px)` + `1px solid rgba($color-border-light, 0.7)` + `$radius-xl` + `$shadow-sm`
  - 文字 `$color-text-primary / $color-text-secondary / $color-text-muted`
  - 正文基准 `$font-base: 13px`，页面标题 `$font-4xl: 32px`
- 交互稿中的页面标题在实现时使用项目 32px 标题规范；卡片标题 16px，正文 13px，说明文字 12px。

### 7.2 AI 配置页

**API Key 卡片**

- 标题：`API Key`
- 右侧标记：`本机保存`
- 输入框：`type="password"`，等宽字体，内容为真实 Key。
- 小眼睛按钮：
  - 默认显示圆点，点击切换为明文。
  - 切换时按钮变为激活色，图标切换为带斜线的眼睛。
  - `aria-pressed` 同步状态。
- 说明文字：仅保存在本机配置文件中，不会上传到其他服务。

**模型卡片**

- 标题：`模型`
- 一行布局：模型输入框占满剩余宽度，右侧「刷新模型列表」按钮。
- 输入框支持直接输入任意模型名，右侧有下拉箭头。
- 点击「刷新模型列表」：
  - 使用当前输入框中的 Key（若为空则使用已保存 Key）。
  - 调用 `settings:ai:models`。
  - 成功后把返回的模型写入下拉选项；失败用 `ElMessage.error` 提示，保留用户已输入的模型名。
- 实现使用 Element Plus `el-select`（`filterable` + `allow-create` + `default-first-option`），既支持下拉选择，也支持输入任意自定义模型名；拉取结果作为 `options`。
- 说明文字：可直接输入模型名称，也可从 DeepSeek 官方列表选择。

**底部操作栏**

- 左侧：「测试连接」按钮 + 结果文案。
  - 测试中按钮 loading，文案“测试中...”。
  - 成功：绿色圆点 + “连接成功”。
  - 失败：红色圆点 + 错误信息。
- 右侧：「保存配置」主按钮。
- 保存校验：
  - API Key 去除首尾空格后不能为空。
  - 模型名不能为空。
  - 保存成功后 `ElMessage.success('保存成功')`。
- 修改 Key 后清空上一次测试结果；修改模型不清空。

### 7.3 MCP 服务页

**服务状态卡片**

- 绿色圆点 + “运行中” / 灰色圆点 + “已停止” / 红色圆点 + “启动失败”。
- 运行中显示 `127.0.0.1:<port>`，右侧「复制地址」按钮。
- 启动失败时在卡片内显示错误原因（如端口被占用）。

**服务配置卡片**

- 启用 MCP 服务：开关。
- 监听端口：数字输入框，范围 1024–65535。
- 说明：仅监听本机回环地址，不暴露给局域网。
- 开关关闭时端口输入框禁用。
- 「保存并应用」按钮：
  - 保存中 loading。
  - 成功刷新状态并提示。
  - 失败保留原配置、原服务，显示错误信息。

**客户端配置卡片**

- 展示主进程生成的 JSON 配置，只读。
- 「复制配置」按钮，复制成功后 `ElMessage.success('已复制')`。
- 说明：复制到 Trae / Claude Code / Cursor 的 MCP 配置中。

### 7.4 通用页

- 数据存储目录：展示 `dataDir`，提供复制按钮。
- 说明：应用数据、数据库和配置文件的存放位置。

### 7.5 数据页

- 数据库文件：展示 `dbPath`。
- 配置文件：展示 `configPath`。
- 「打开数据目录」按钮：调用 `settings:app:open-path`，打开 `dataDir`。

### 7.6 关于页

- 应用版本：`app.getVersion()`。
- 应用名称：个人记账。
- 技术栈：Electron + Vue 3 + TypeScript + Pinia + Element Plus。
- 版权信息：静态文案。

### 7.7 组件拆分

建议文件结构：

```
src/renderer/src/views/SettingsView/
├── index.vue
├── components/
│   ├── SettingsSidebar.vue
│   ├── AISettingsPanel.vue
│   ├── MCPSettingsPanel.vue
│   ├── GeneralSettingsPanel.vue
│   ├── DataSettingsPanel.vue
│   └── AboutSettingsPanel.vue
└── composables/
    └── useSettings.ts
```

`useSettings.ts` 负责：

- 当前分组状态。
- AI 配置读取、保存、测试、模型列表。
- MCP 配置读取、保存、刷新状态。
- 通用/数据/关于信息加载。

## 8. 交互与校验汇总

| 场景 | 规则 |
|---|---|
| API Key 显示 | 默认隐藏，小眼睛切换明文；不修改输入框内容 |
| 保存 AI 配置 | Key 和模型均不能为空；Key 去除首尾空格 |
| 测试连接 | 需要 Key；使用 chat 请求；结果保留到下次修改 Key |
| 刷新模型列表 | 需要 Key；调用 `/models`；失败不影响手动输入 |
| 端口输入 | 整数，1024–65535；禁用时不可编辑 |
| MCP 保存 | 事务式应用；失败不落盘 |
| 复制 | `clipboard.writeText`，成功后 `ElMessage.success` |
| 页面加载 | 显示加载态；IPC 失败时显示错误，不阻塞其他分组切换 |

## 9. 错误处理

1. IPC 统一捕获异常并返回 `{ code: -1, data: null, msg }`。
2. electron-store 文件损坏：`clearInvalidConfig: true` 重置为默认值并记录日志。
3. 旧配置迁移失败：保留旧文件，记录日志，新配置保持为空，用户可手动重新输入。
4. 模型列表拉取失败：页面提示错误，保留当前模型输入值和已有下拉选项。
5. MCP 启动失败：保留原服务与原配置，状态卡显示错误；用户可修改端口后重试。
6. 复制失败：提示“复制失败”，不影响页面其他操作。

## 10. 文件变更清单

### 新增

| 文件 | 说明 |
|---|---|
| `src/main/service/configStore.ts` | electron-store 实例、schema、默认值、旧配置迁移 |
| `src/main/controller/settingsController.ts` | 设置相关 IPC |
| `src/main/utils/paths.ts` | 数据目录、数据库、配置文件、mcp-agent 路径 |
| `src/renderer/src/views/SettingsView/index.vue` | 设置页容器 |
| `src/renderer/src/views/SettingsView/components/SettingsSidebar.vue` | 左侧分组导航 |
| `src/renderer/src/views/SettingsView/components/AISettingsPanel.vue` | AI 配置页 |
| `src/renderer/src/views/SettingsView/components/MCPSettingsPanel.vue` | MCP 配置页 |
| `src/renderer/src/views/SettingsView/components/GeneralSettingsPanel.vue` | 通用页 |
| `src/renderer/src/views/SettingsView/components/DataSettingsPanel.vue` | 数据页 |
| `src/renderer/src/views/SettingsView/components/AboutSettingsPanel.vue` | 关于页 |
| `src/renderer/src/views/SettingsView/composables/useSettings.ts` | 设置页状态与 IPC 调用 |

### 修改

| 文件 | 说明 |
|---|---|
| `package.json` | 新增 `electron-store` 依赖 |
| `src/main/index.ts` | 初始化 configStore、迁移旧配置、注册 settingsController、按配置启动 MCP、复用 paths |
| `src/main/service/ai/aiConfigService.ts` | 改为基于 configStore，移除 fs / safeStorage |
| `src/main/service/ai/deepseekClient.ts` | 增加 GET 请求封装与 `listModels` |
| `src/main/mcp/mcp-server.ts` | 支持端口参数、Promise 化启停、状态查询 |
| `src/main/controller/aiController.ts` | 移除旧配置 IPC，保留对话/会话/报告接口 |
| `src/preload/index.ts` | 新增 `settingsAPI`，移除 `aiAPI` 配置方法 |
| `src/preload/index.d.ts` | 同步类型声明 |
| `src/renderer/src/App.vue` | 设置入口改为独立页面 |
| `resources/mcp-agent.cjs` | 支持 `PF_MCP_PORT` 环境变量 |

### 删除

| 文件 | 说明 |
|---|---|
| `src/renderer/src/components/AISettingsDialog.vue` | 由独立设置页替代 |
| `src/renderer/src/composables/useAI.ts` | 仅服务旧设置弹窗，重构后无引用 |
| `src/renderer/src/composables/types.ts` | 仅包含旧弹窗的 `AIConfig` / `AIconfigType` 类型 |

说明：`src/renderer/src/components.d.ts` 由 unplugin-vue-components 自动生成，删除组件后重新开发或构建即可更新，无需手动编辑。

## 11. 验收标准

1. 启动应用后 `userData/config.json` 生成，包含 `ai` 和 `mcp` 两组配置。
2. 旧 `userData/ai/config.json` 存在时，首次启动后 Key 和模型被迁移，旧文件被删除。
3. 设置页可通过侧边栏齿轮进入，五个分组可正常切换。
4. API Key 小眼睛可在明文/密文之间切换。
5. 模型输入框可手动输入任意模型名；点击「刷新模型列表」能获取 DeepSeek 官方模型。
6. 「测试连接」成功和失败均有明确反馈。
7. 保存后重启应用，API Key 和模型仍然生效。
8. MCP 服务开关、端口修改可生效；端口被占用时页面显示错误且不破坏原服务。
9. 「复制配置」生成的 JSON 包含当前端口，可直接用于外部 AI 工具。
10. 通用页可复制数据目录；数据页可打开数据目录；关于页显示版本号。
11. AI 对话、流式输出、月报、统计解读功能无回归。
12. `pnpm build` 通过，无 TypeScript 报错。

## 12. 风险与后续

1. **明文存储风险**：本机其他程序可读取 API Key；这是本次明确接受的权衡。后续如需提升安全性，可迁移到系统凭据库。
2. **electron-store 版本要求**：12.x 要求 Node.js >= 22；当前开发环境 Node 24、Electron 42 满足要求。若后续降级 Electron，需要同步检查。
3. **静态 MCP 插件配置**：`plugin/.mcp.json` 仍使用默认端口 19527；用户修改端口后需使用设置页复制的配置。
4. **配置文件损坏**：`clearInvalidConfig` 会重置配置，用户需要重新填写 Key。
5. **后续扩展**：多 Provider、多 Key、主题、语言、预算等设置可在现有 `AppConfig` 和分组导航上继续扩展。
6. **electron-store 12 为 ESM-only**：项目 `package.json` 为 `"type": "module"`，主进程构建为 ESM，兼容；若后续改为 CJS 或调整 externalize 策略，需要同步验证。
