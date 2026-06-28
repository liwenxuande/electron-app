---
name: sync-electron-docs
description: 提交代码前检查 Electron 相关改动，提醒同步更新 docs/electron-faq.md 或 docs/electron-knowledge.md
argument-hint: [commit message or nothing]
---

# Sync Electron Docs

提交代码时，检查是否涉及 Electron 知识点变更，确保文档同步。

## 触发条件

用户说"提交代码"、"commit"、"push" 等时，在 commit 之前执行此检查。

## 检查流程

### 1. 扫描待提交文件

```bash
git diff --cached --name-only  # 已暂存的文件
git diff --name-only           # 未暂存的修改（如果用户还没 add）
```

### 2. 判断是否涉及 Electron 层

关注以下目录/文件：

| 路径 | 对应文档 |
|------|---------|
| `src/main/**` | 主进程改动 → 可能涉及知识点或踩坑 |
| `src/preload/**` | 桥接层改动 → 可能涉及 IPC 知识点 |
| `electron-builder.yml` | 打包配置 → 可能涉及打包知识点/踩坑 |
| `electron.vite.config.ts` | 构建配置 → 可能涉及工程化知识点 |
| `package.json` (scripts/electron相关字段) | 项目配置 |
| `src/renderer/src/env.d.ts` | 类型声明 |

**不关注**（纯渲染层，不涉及 Electron）：
- `src/renderer/src/views/**`
- `src/renderer/src/components/**` (除 TitleBar 等涉及 Electron API 的组件)
- `src/renderer/src/stores/**`
- 纯 CSS 样式改动

### 3. 分析改动类型

阅读 diff 内容，判断属于哪种类型：

**新增知识点** → 更新 `docs/electron-knowledge.md`
- 使用了新的 Electron API
- 实现了新的 Electron 功能模式
- 新的架构设计或最佳实践

**踩坑修复** → 更新 `docs/electron-faq.md`
- 修复了一个有明确原因和解决方案的 bug
- 配置错误导致的构建/运行失败
- API 使用不当导致的问题

**两者都有** → 两个文档都更新

### 4. 生成文档条目

按照两个文档的既有格式生成条目。

**FAQ 格式**：
```markdown
## N. 问题简述

**现象**：具体报错/表现

**原因**：根因分析

**解决**：代码或配置变更
```

**Knowledge 格式**：
按照九大章节归类，说明是什么、为什么、怎么用，附带项目实际代码。

### 5. 用户确认

> 📋 **Electron 文档同步检查**
> 
> 本次改动涉及 Electron 层：
> - `src/main/index.ts` — 新增 xxx
> - `electron-builder.yml` — 修改 xxx
> 
> 需要更新：
> - [ ] `docs/electron-faq.md` — 添加踩坑条目 "xxx"
> - [ ] `docs/electron-knowledge.md` — 补充知识点 "xxx"
> 
> 要现在更新吗？还是先提交后续补文档？

### 6. 执行

如果用户选择现在更新，直接编辑对应文档文件，保持格式一致。

## 注意

- 不要为纯格式化、注释、变量重命名等无知识增量的改动创建文档条目
- 如果是已有条目的补充（如同一问题的另一种解法），在已有条目前提下追加而非新建
- 文档条目要包含具体的代码片段和文件路径引用
