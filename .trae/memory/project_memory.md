# 项目记忆 — personal-finance (electron-01)

## 项目信息

- **名称**: personal-finance
- **技术栈**: Electron + Vue 3 + TypeScript + Pinia + Element Plus + vue-element-plus-x
- **包管理器**: pnpm（绝对不能混用 npm/yarn）
- **UI 组件库**: Element Plus + vue-element-plus-x（AI 专用组件）
- **Markdown 渲染**: x-markdown-vue（MarkdownRenderer）

## 红线规则

### 1. 包管理器：只能用 pnpm
- 本项目锁定 pnpm，通过 `.npmrc` 配置了 pnpm 专用选项（node-linker、shamefully-hoist 等）
- **禁止使用 npm install / yarn install**，会破坏 node_modules 结构
- 安装失败时不要在沙箱里反复尝试——直接告知用户执行 `pnpm install`
- 判断依据：项目中存在 `pnpm-lock.yaml` + `.npmrc` 含 pnpm 配置

### 2. 不要回退已采用的组件库方案
- 用户明确要求使用 Element-Plus-X 重构后，遇到问题应该调试组件库本身，而不是退回旧方案
- 例如：x-markdown-vue 渲染有问题 → 检查 props/import，不是退回 marked

### 3. 不删除 node_modules 重装
- node_modules 下 electron 等二进制文件可能被 IDE 锁定，Remove-Item 会失败
- 让用户在关闭 IDE 后的终端自行执行

## 架构约定

- Element Plus 主题色: `--el-color-primary: #FF8C00`
- 全局注册: ElementPlus + ElementPlusX
- AI 助手页组件: Conversations / BubbleList / XSender / Welcome / Prompts / Thinking / ThoughtChain / MarkdownRenderer
