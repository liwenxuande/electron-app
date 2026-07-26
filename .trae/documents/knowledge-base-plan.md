# 项目知识库完整计划

## 定位

项目本身是 **Electron 桌面应用脚手架**，知识库面向 **Electron 小白开发者**，目标是拿到架子就能快速二次开发。

## 产出文档

共三份，覆盖"理解架构 → 动手开发 → 查询原理"三个层级：

### 文档一：`docs/architecture.md` —— 项目架构说明书

**面向**：想快速理解项目怎么组织的。

1. 架构全景 ASCII 图（主进程四层 + preload + 渲染进程三层）
2. 完整目录树 + 每个文件的职责一句话说明
3. 启动全流程时序（db 初始化 → splash → 主窗口）
4. 全部 IPC 通道一览表（通道名、方向、参数、返回值）
5. 以「新增人员」为例的完整调用链（从按钮点击到 SQL 写入）
6. 关键设计决策及原因（userData / WAL / p-queue / 开发生产库分离 / 单实例锁）

### 文档二：`docs/dev-guide.md` —— 二次开发指南

**面向**：基于架子加功能的人。

1. **加一张新表**（完整走一遍，如加 `department` 表）：database → repository → service → controller → preload → store → 页面 → App.vue 注册
2. **加一个 IPC 通道**：模板代码
3. **加一个新页面**：约定与步骤
4. **前端开发约定**：Pinia store 写法模板、ElMessage 提示、表单校验写法
5. **常见扩展场景**：导入导出 Excel、系统托盘、自动更新、换图标/改应用名
6. **打包发布 checklist**：改 appId、改图标、改应用名、改 installer 配置

### 文档三：`docs/electron-basics.md` —— Electron 核心概念

**面向**：Electron 新手，写业务之前先建立心智模型。

1. **Electron 到底是什么**：Chromium + Node.js，前端写桌面软件的桥
2. **三进程模型图解**：main / renderer / preload 各自的权限和能力
3. **contextBridge 安全模型**：为什么不能直接在 Vue 里 `require('fs')`
4. **IPC 双模式**：invoke/handle（请求-响应）vs send/on（单向推送），各适用什么场景
5. **package.json 的 type:module 坑**：preload 扩展名 .mjs / .js 的抉择
6. **better-sqlite3 编译**：为什么它是 C++ 模块，electron-rebuild 在做什么
7. **electron-builder 打包原理**：dependencies vs devDependencies、asar、NSIS
8. **app 生命周期**：ready / window-all-closed / before-quit / second-instance
9. **窗口无边框**：frame:false 意味着什么，-webkit-app-region 怎么用
10. **本地存储三件套对比**：localStorage / electron-store / SQLite 选型矩阵
