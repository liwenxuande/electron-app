# README.md 创建计划

## 概述

为该项目创建一份完整的 README.md 文件，涵盖项目介绍、技术栈、架构图、目录结构、安装启动步骤、常见问题。

## 当前状态

- 项目已可正常运行
- 用户自行做了若干实用修改（Windows UTF-8 修复、通知 IPC 等）
- 项目使用 pnpm 作为包管理器
- 缺少 README 文档

## 目标文件

`f:\project\pc_app\electron-01\README.md`

## README 内容大纲

1. **项目简介**：一句话说明这是什么应用
2. **技术栈**：Electron + Vue3 + Element Plus + better-sqlite3 等
3. **功能列表**：新增/查询/编辑/删除 + 模糊搜索 + 分页
4. **架构说明**：四层分层示意（db → repository → service → controller）+ IPC 通信流程
5. **目录结构**：精简版树形结构
6. **快速开始**：
   - 环境要求（Node 18+, pnpm, C++ 编译工具链）
   - 安装依赖
   - 重编译原生模块
   - 启动开发
   - 打包
7. **常见问题**：better-sqlite3 编译失败、database is locked、pnpm 权限问题

## 验证

- README 中新手指令直接可复制执行
- 覆盖用户实际修改后的项目状态（如 pnpm、Windows 编码修复）
