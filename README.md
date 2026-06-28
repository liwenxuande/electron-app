# 人员管理系统

基于 **Electron + Vue3 + Element Plus + better-sqlite3** 构建的本地人员管理桌面应用，支持新增、查询、编辑、删除四大基础功能，数据存储在本地 SQLite 数据库。

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行框架 | Electron 33 |
| 构建工具 | electron-vite 5（Vite 热更新） |
| 数据库 | better-sqlite3（SQLite 嵌入式数据库，WAL 模式） |
| 写队列 | p-queue（串行写入，防止 database is locked） |
| 前端渲染 | Vue 3 + Element Plus + TypeScript |
| 状态管理 | Pinia |
| 时间处理 | dayjs |
| 日志 | winston（控制台 + 文件双输出） |
| 打包 | electron-builder |

## 功能

- 人员列表分页展示
- 按姓名模糊搜索
- 新增人员（表单校验 + 后端校验）
- 编辑人员（回显数据，修改后更新）
- 删除人员（二次确认弹窗）
- 增改操作包裹事务，写入走串行队列

## 架构分层

```
渲染进程 (Vue3)              预加载 (preload)              主进程 (main)
┌─────────────────┐    contextBridge     ┌──────────────────────────────┐
│  UserList.vue   │ ─── ipcRenderer ───► │ ④ controller (IPC注册)      │
│  UserDialog.vue │    .invoke()         │ ③ service   (校验+事务)      │
│  userStore.ts   │                      │ ② repository (原生SQL)       │
└─────────────────┘                      │ ① db        (单例+WAL+队列)  │
                                          └──────────────────────────────┘
```

**四层后端**：db → repository → service → controller，严格分离：

| 层 | 文件 | 职责 |
|----|------|------|
| ① db 底层 | `src/main/db/database.ts` | 单例连接、WAL 模式、建表、p-queue 写队列 |
| ② repository 仓储层 | `src/main/repository/userRepository.ts` | 纯 SQL，无业务逻辑 |
| ③ service 业务层 | `src/main/service/userService.ts` | 参数校验、事务、统一返回 `{code, data, msg}` |
| ④ controller 控制器层 | `src/main/controller/userController.ts` | ipcMain.handle 注册、异常捕获 |

**安全规范**：渲染进程不直接访问 Node API / SQLite，所有数据库操作通过 preload 桥接 → IPC → 主进程四层。

## 目录结构

```
electron-01/
├── package.json
├── electron-builder.yml
├── electron.vite.config.ts
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
├── src/
│   ├── main/                          # 主进程
│   │   ├── index.ts                   # 入口：初始化DB → 注册IPC → 创建窗口
│   │   ├── db/database.ts             # ① DB底层
│   │   ├── repository/userRepository.ts # ② 仓储层
│   │   ├── service/userService.ts     # ③ 业务层
│   │   ├── controller/userController.ts # ④ 控制器层
│   │   └── utils/logger.ts            # 日志模块
│   ├── preload/                       # 预加载桥接
│   │   ├── index.ts                   # contextBridge 暴露 API
│   │   └── index.d.ts                 # 类型声明
│   └── renderer/                      # 渲染进程
│       ├── index.html
│       └── src/
│           ├── main.ts                # Vue 入口
│           ├── App.vue
│           ├── stores/userStore.ts     # Pinia 状态管理
│           ├── components/UserDialog.vue # 新增/编辑弹窗
│           └── views/UserList.vue      # 列表主页
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm（推荐）或 npm
- **C++ 编译工具链**（better-sqlite3 需原生编译）：
  - Windows：安装 Visual Studio Build Tools 并勾选「使用 C++ 的桌面开发」，或执行 `npm install -g windows-build-tools`

### 安装

```bash
# 1. 安装依赖
pnpm install

# 2. 重新编译 better-sqlite3 原生模块（匹配 Electron 内嵌 Node 版本）
pnpm electron-rebuild -f -w better-sqlite3
```

### 开发

```bash
pnpm dev
```

自动打开 Electron 窗口，修改代码即时热更新。

### 打包

```bash
# Windows exe
pnpm package:win

# macOS dmg
pnpm package:mac
```

打包产物在 `release/` 目录。

## 数据库

### 存储位置

数据库文件存放在 Electron 的 `userData` 目录（不受软件升级/卸载影响）：

| 模式 | 文件名 | 完整路径（Windows） |
|------|--------|---------------------|
| 开发 (`pnpm dev`) | `data.dev.db` | `%APPDATA%/人员管理系统/data.dev.db` |
| 安装版 | `data.db` | `%APPDATA%/人员管理系统/data.db` |

> **为什么放 userData 而不是安装目录？** NSIS 升级安装时会先卸载旧版，安装目录可能被清空。`userData` 不受安装/卸载影响，数据持久化。
>
> 旧版本数据在安装目录 `data/` 下时，首次启动会自动迁移到 userData。

快速打开数据目录：`start %APPDATA%\人员管理系统`

### 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| name | TEXT | 姓名（≤50 字符） |
| phone | TEXT | 手机号（11 位，1 开头） |
| address | TEXT | 地址（≤200 字符） |
| create_time | TEXT | 创建时间 |

## 常见问题

### better-sqlite3 编译失败

```
npm install -g windows-build-tools
```
或安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)，勾选「使用 C++ 的桌面开发」。

### database is locked

项目已开启 WAL 模式 + p-queue 串行写队列，正常情况下不会出现锁表。如仍然遇到，检查是否有多进程同时访问同一 db 文件。

### pnpm 安装报 EPERM 权限错误

关闭杀毒软件或 Windows Defender 实时扫描后重试，或改用 npm：
```bash
npm install
npx electron-rebuild -f -w better-sqlite3
```

### 控制台中文乱码（Windows）

已在 `main/index.ts` 中通过 `chcp 65001` 修复。
