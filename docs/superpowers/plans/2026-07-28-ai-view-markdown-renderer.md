# AIView.vue Markdown 渲染重构 — 实施计划

## 目标

将 AIView.vue 的 Markdown 渲染从 `marked` + `v-html` 迁移到 `x-markdown-vue` 的 `MarkdownRenderer`，布局和其他组件不变。

## 进度

| 步骤 | 状态 |
|------|------|
| 1. 依赖安装 | 已完成 |
| 2. 替换模板渲染 | 已完成 |
| 3. 移除 marked 代码 | 已完成 |
| 4. CSS 样式适配 | 已完成 |
| 5. Mermaid 图表支持 | 已完成 |
| 6. 渲染异常修复 | 已完成 |

## 实施步骤

### 1. 依赖安装

```powershell
pnpm add vue-element-plus-x x-markdown-vue
pnpm add mermaid
pnpm remove marked
```

并在 `main.ts` 注册 `ElementPlusX`。

### 2. 替换模板渲染

在 AIView.vue 的消息气泡和流式输出中，将 `v-html="renderContent(...)"` 替换为：

```html
<MarkdownRenderer
  :markdown="content"
  enable-breaks
  :enable-gfm="true"
  :enable-shiki="false"
  :enable-latex="false"
  :enable-animate="false"
/>
```

同时移除脚本中的 `import { marked }`、`marked.setOptions()` 配置、`renderContent()` 函数，改为 `import { MarkdownRenderer } from 'x-markdown-vue'` 和 `import 'x-markdown-vue/style'`。

### 3. CSS 样式适配

x-markdown-vue 默认样式与气泡背景冲突，通过 `:deep()` 覆盖：

- 根容器背景透明
- 代码块内 `white-space: pre` 留白 → `font-size: 0`
- 行内代码 `vertical-align: sub` → `vertical-align: bottom`
- 代码块内 `<pre>` margin 清零
- 用户气泡元素适配（blockquote/a/code/th 白色半透明）
- 有序列表补 `ol` 样式

### 4. Mermaid 图表

- 安装 `mermaid` 包
- 默认启用（`enableMermaid` 默认为 `true`）
- 隐藏 View/Code 切换按钮（v0.0.201 bug：代码视图内容为空）
- 注释标记 TODO，升级 x-markdown-vue 后可恢复

### 5. 渲染异常修复

| 问题 | 解决方案 |
|------|---------|
| `$208` 被解析为 LaTeX | `:enable-latex="false"` |
| 流式输出时 Markdown 语法拆散 | `:enable-animate="false"` |
| 未安装 shiki 导致渲染失败 | `:enable-shiki="false"` |
