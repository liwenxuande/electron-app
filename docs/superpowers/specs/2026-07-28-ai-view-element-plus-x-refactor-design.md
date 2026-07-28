# AIView.vue Markdown 渲染重构规格

## 概述

将 AIView.vue 中的 Markdown 渲染从 `marked` + `v-html` 替换为 `x-markdown-vue` 的 `MarkdownRenderer` 组件，保留原有布局、侧边栏、输入区、业务逻辑不变。

> 注：最初计划全面使用 `vue-element-plus-x` 组件重构整个页面，因组件兼容性问题（BubbleList 布局冲突、Conversations 样式偏差等）已回退。本次仅完成 Markdown 渲染层的替换。

## 约束

- 仅替换 Markdown 渲染方式，不改变任何布局、功能
- 侧边栏、欢迎页、输入区、思考动画等保持原样
- 所有 store、composable 不动
- 后端 IPC / AI 服务层不动

## 依赖变更

### 新增

- `vue-element-plus-x` — AI 组件库（全局注册，AIView 暂未使用其组件）
- `x-markdown-vue` — Markdown 渲染（替代 marked）
- `mermaid` — Mermaid 图表渲染（x-markdown-vue 可选依赖）

### 移除

- `marked` — 不再需要

### 安装命令

```
pnpm add vue-element-plus-x x-markdown-vue
pnpm add mermaid
pnpm remove marked
```

## main.ts 改动

在 `app.use(ElementPlus, ...)` 之后追加：

```ts
import ElementPlusX from 'vue-element-plus-x'
app.use(ElementPlusX)
```

## AIView.vue 改动

### 模板（2 处替换）

**消息气泡：**

```html
<!-- 旧 -->
<div class="ai-msg-content" v-html="renderContent(msg.content)"></div>

<!-- 新 -->
<div class="ai-msg-content">
  <MarkdownRenderer
    :markdown="msg.content"
    enable-breaks
    :enable-gfm="true"
    :enable-shiki="false"
    :enable-latex="false"
    :enable-animate="false"
  />
</div>
```

**流式输出同理。**

### Props 说明

| Prop | 值 | 原因 |
|------|-----|------|
| `enable-breaks` | true | 换行转 `<br>` |
| `enable-gfm` | true | GitHub 风格 Markdown（表格、任务列表等） |
| `enable-shiki` | false | 未安装 shiki 依赖，关闭避免报错 |
| `enable-latex` | false | `$` 符号被误解析为 LaTeX，如 `$208` |
| `enable-animate` | false | 逐词动画在流式输出时拆散 Markdown 语法 |
| `enable-mermaid` | 默认 true | Mermaid 图表正常渲染 |

### 脚本

- 移除 `import { marked } from 'marked'`
- 移除 `marked.setOptions()` 配置
- 移除 `renderContent()` 函数
- 新增 `import { MarkdownRenderer } from 'x-markdown-vue'`
- 新增 `import 'x-markdown-vue/style'`

### 样式（:deep() 覆盖）

x-markdown-vue 自带样式与气泡背景冲突，通过 `:deep()` 选择器针对性覆盖：

| 问题 | 根因 | 覆盖 |
|------|------|------|
| 根容器背景色 | x-markdown-vue 默认背景 | `background: transparent` |
| 代码块上下留白 | `white-space: pre` 保留标签间换行 | `font-size: 0` 消除空白文本节点 |
| 行内代码上飘 | `vertical-align: sub` | 改为 `vertical-align: bottom` |
| 代码块内 `<pre>` 大间距 | `.x-md-renderer pre { margin: 16px 0 }` | 代码块内 `pre { margin: 0 }` |
| Mermaid 代码视图为空 | 组件 bug（v0.0.201） | 隐藏 View/Code 切换按钮 |
| 用户气泡内元素不可见 | 橙色背景上默认颜色看不清 | `blockquote/a/code/th` 改为白色半透明 |
| 有序列表序号跑偏 | 缺 `ol` 样式 | 补 `padding-left: 20px` |

## 不受影响

- 侧边栏（自定义 HTML + v-for）
- 欢迎页 + 快捷问题按钮
- 工具调用状态条
- 思考中动画
- 底部输入区 + 发送/停止按钮
- 错误提示 + 重试
- 所有 IPC 事件监听逻辑
- 所有 store 和 composable

## 受影响文件

| 文件 | 改动 |
|------|------|
| `AIView.vue` | 替换 2 处模板 + 移除 marked 逻辑 + 调整 CSS |
| `main.ts` | +2 行：ElementPlusX import + use |
| `package.json` | +3 依赖（vue-element-plus-x, x-markdown-vue, mermaid），-1（marked） |
