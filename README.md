# 个人记账

轻松记录每一笔收支，管理你的日常账本。

基于 **Electron + Vue 3 + Element Plus + better-sqlite3** 构建的桌面记账应用，支持多账本管理、收支记录、统计分析、CSV 导入等功能。

## 功能

- **仪表盘** — 月度收支概览、消费分布圆环图、近期账单、快捷操作入口
- **账单明细** — 多条件筛选（类型/分类/日期/关键词）、分页表格、增删改
- **统计分析** — 收支趋势折线图、分类占比环形图、分类消费排行
- **账本管理** — 支持多账本切换，默认账本不可删除
- **CSV 导入** — 拖拽上传、数据预览、自动匹配分类
- **分类管理** — 支出/收入分类的增删改

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行框架 | Electron 42 |
| 构建工具 | electron-vite 6（Vite 热更新） |
| 数据库 | better-sqlite3（SQLite，WAL 模式） |
| 前端渲染 | Vue 3 + Element Plus + TypeScript |
| 状态管理 | Pinia |
| 图表 | ECharts（按需引入） |
| 时间处理 | dayjs |
| 日志 | winston（控制台 + 文件双输出） |
| 打包 | electron-builder |

## 架构

```
渲染进程 (Vue 3)          预加载 (preload)           主进程 (main)
┌─────────────────┐   contextBridge    ┌──────────────────────────────┐
│   Views/*.vue   │ ── ipcRenderer ──► │ ④ controller (IPC 注册)     │
│   Components/   │    .invoke()       │ ③ service   (校验 + 事务)    │
│   stores/       │                    │ ② repository (原生 SQL)      │
└─────────────────┘                    │ ① db        (单例 + WAL)     │
                                        └──────────────────────────────┘
```

渲染进程无法直接访问 Node API 或 SQLite，所有操作通过 preload 桥接 → IPC → 主进程四层。

## 数据库

数据库文件存放在 `userData` 目录，不受软件升级/卸载影响：

| 表 | 用途 |
|----|------|
| `ledger` | 账本（预置"默认账本"） |
| `category` | 收支分类（预置 16 个：10 支出 + 6 收入） |
| `transactions` | 记账记录（关联分类和账本） |

## 快速开始

### 环境要求

- Node.js >= 18
- **C++ 编译工具链**（better-sqlite3 需要原生编译）：
  - Windows：安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)，勾选「使用 C++ 的桌面开发」

### 安装

```bash
npm install
```

### 开发

```bash
npm run dev
```

### 打包

```bash
# Windows
npm run package:win

# macOS
npm run package:mac
```

打包产物在 `release/` 目录。

## 文档

- [功能需求清单](docs/personal-finance-requirements.md)
- [开发文档](docs/personal-finance-dev.md)
- [产品需求文档](docs/PRD.md)
- [代码知识库](docs/code-wiki.md)
- [Electron 踩坑记录](docs/electron-faq.md)
- [Electron 知识点](docs/electron-knowledge.md)
