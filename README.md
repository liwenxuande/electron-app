# electron-app

基于 **Electron + Vue3 + Element Plus + better-sqlite3** 的桌面应用开发脚手架，提供完整的 IPC 通信架构、SQLite 数据库封装、日志系统和打包配置。开箱即用，适合快速二次开发。

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行框架 | Electron 42 |
| 构建工具 | electron-vite 6（Vite 热更新） |
| 数据库 | better-sqlite3（SQLite 嵌入式数据库，WAL 模式） |
| 写队列 | p-queue（串行写入，防止 database is locked） |
| 前端渲染 | Vue 3 + Element Plus + TypeScript |
| 状态管理 | Pinia |
| 时间处理 | dayjs |
| 日志 | winston（控制台 + 文件双输出） |
| 打包 | electron-builder |

## 项目定位

这是一个**通用桌面应用开发架子**，而非具体业务系统。内置了一套完整的 Electron 最佳实践：

- ✅ 主进程四层架构（db → repository → service → controller）
- ✅ 安全的 IPC 通信（contextBridge + invoke/handle 模式）
- ✅ SQLite 数据库封装（WAL 模式 + 串行写队列 + 事务支持）
- ✅ winston 日志（开发控制台 + 生产文件双输出）
- ✅ 自定义无边框窗口 + 启动动画
- ✅ 单实例锁（防止重复打开应用）
- ✅ 应用自动更新配置
- ✅ 生产/开发数据库隔离（data.db / data.dev.db）
- ✅ 安装目录旧数据自动迁移到 userData

在此架子上开发只需：定义表结构 → 写 repository → 写 service → 注册 IPC controller → 写 Vue 页面。

## 架构分层

```
渲染进程 (Vue3)              预加载 (preload)              主进程 (main)
┌─────────────────┐    contextBridge     ┌──────────────────────────────┐
│   Views/*.vue   │ ─── ipcRenderer ───► │ ④ controller (IPC注册)      │
│   Components/   │    .invoke()         │ ③ service   (校验+事务)      │
│   stores/       │                      │ ② repository (原生SQL)       │
└─────────────────┘                      │ ① db        (单例+WAL+队列)  │
                                          └──────────────────────────────┘
```

| 层 | 示例文件 | 职责 |
|----|---------|------|
| ① db 底层 | `src/main/db/database.ts` | 单例连接、WAL 模式、建表、p-queue 写队列 |
| ② repository 仓储层 | `src/main/repository/xxxRepository.ts` | 纯 SQL，无业务逻辑 |
| ③ service 业务层 | `src/main/service/xxxService.ts` | 参数校验、事务、统一返回 `{code, data, msg}` |
| ④ controller 控制器层 | `src/main/controller/xxxController.ts` | ipcMain.handle 注册、异常捕获 |

**安全规范**：渲染进程不直接访问 Node API / SQLite，所有操作通过 preload 桥接 → IPC → 主进程四层。

## 目录结构

```
electron-app/
├── package.json
├── electron-builder.yml          # 打包配置
├── electron.vite.config.ts       # electron-vite 配置
├── tsconfig.json / .node.json / .web.json
├── src/
│   ├── main/                     # 主进程
│   │   ├── index.ts              # 入口：初始化DB → 注册IPC → 创建窗口
│   │   ├── db/database.ts        # ① DB底层（连接、建表、队列）
│   │   ├── repository/           # ② 仓储层（纯 SQL）
│   │   ├── service/              # ③ 业务层（校验 + 事务）
│   │   ├── controller/           # ④ 控制器层（IPC 注册）
│   │   └── utils/logger.ts       # 日志模块
│   ├── preload/                  # 预加载桥接
│   │   ├── index.ts              # contextBridge 暴露 API
│   │   └── index.d.ts            # 类型声明
│   └── renderer/                 # 渲染进程
│       ├── index.html
│       ├── splash.html           # 启动动画
│       └── src/
│           ├── main.ts           # Vue 入口
│           ├── App.vue
│           ├── env.d.ts          # 类型声明
│           ├── stores/           # Pinia 状态管理
│           ├── components/       # 通用组件
│           └── views/            # 页面
├── build/                        # 打包资源（图标等）
└── docs/                         # 文档
```

## 快速开始

### 环境要求

- Node.js >= 18（推荐 >= 22）
- **C++ 编译工具链**（better-sqlite3 需原生编译）：
  - Windows：安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)，勾选「使用 C++ 的桌面开发」

### 安装

```bash
npm install
```

`postinstall` 脚本会自动执行 `electron-builder install-app-deps`，为当前 Electron 版本重新编译 better-sqlite3。

### 开发

```bash
npm run dev
```

自动打开 Electron 窗口，修改代码即时热更新。

### 打包

```bash
# Windows (NSIS 安装包)
npm run package:win

# macOS (DMG)
npm run package:mac
```

打包产物在 `release/` 目录。

## 数据库

### 存储位置

数据库文件存放在 Electron 的 `userData` 目录（不受软件升级/卸载影响）：

| 模式 | 文件名 | Windows 路径 |
|------|--------|-------------|
| 开发 | `data.dev.db` | `%APPDATA%/electron-app/data.dev.db` |
| 生产 | `data.db` | `%APPDATA%/electron-app/data.db` |

> 生产环境下若检测到安装目录有旧版本数据，首次启动会自动迁移到 userData。

### 如何使用

1. 在 `database.ts` 中定义建表 SQL
2. 创建对应的 `xxxRepository.ts`，编写增删改查方法
3. 创建对应的 `xxxService.ts`，添加业务校验和事务逻辑
4. 在 `xxxController.ts` 中注册 `ipcMain.handle` 通道
5. 在 `preload/index.ts` 中通过 `contextBridge` 暴露给渲染进程
6. 在 Vue 组件中通过 `window.xxxAPI` 调用

详细示例参考 `docs/` 目录下的文档。

## 文档

- [升级记录 (v33→v42)](docs/electron-upgrade-v33-to-v42.md)
- [Electron 踩坑记录](docs/electron-faq.md)
- [架构说明书](docs/architecture.md)
- [二次开发指南](docs/dev-guide.md)
- [Electron 核心概念](docs/electron-basics.md)

## 常见问题

### better-sqlite3 编译失败

安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)，勾选「使用 C++ 的桌面开发」。

### database is locked

项目已开启 WAL 模式 + p-queue 串行写队列，正常情况下不会锁表。如遇到，检查是否有多进程同时访问同一 db 文件。

### 控制台中文乱码（Windows）

已在 `main/index.ts` 中通过 `chcp 65001` 修复。
