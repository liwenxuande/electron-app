# 安装包体积与安装速度优化规格

## 概述

NSIS 安装包 134MB、安装过程卡顿。根因是**重复打包**：渲染进程专用依赖（mermaid 79.66MB、vue-element-plus-x、x-markdown-vue、@element-plus/icons-vue 等）已被 vite 打进 `out/renderer`，但仍在 `package.json` 的 `dependencies` 中，electron-builder 又将整套 node_modules 原样塞入 `app.asar`（189MB、17,068 个文件，其中 16,959 个来自 node_modules）。

安装耗时 ≈ 压缩体积的解压耗时 + 文件数 × 杀软扫描/单文件开销，两个因素都被放大。

**本次为阶段一（仅依赖归位）**，验证通过后再决定是否执行阶段二（asarUnpack 收窄）与阶段三（清理旧产物）。

## 约束

- 不改变任何业务功能与交互行为
- 主进程运行期真实 require 的依赖（`better-sqlite3`、`p-queue`、`winston`、`dayjs`）必须保留在 `dependencies`
- `externalizeDepsPlugin` 只作用于 main/preload，渲染进程打包不受依赖位次影响，无需改动构建配置
- 优化前后需量化对比验证（安装包体积、asar 体积、asar 文件数）

## 第 1 节：依赖归位

**文件：`package.json`**

- `dependencies` 保留：`better-sqlite3`、`dayjs`、`p-queue`、`winston`
- 移入 `devDependencies`：`mermaid`、`vue-element-plus-x`、`x-markdown-vue`、`@element-plus/icons-vue`

**依据**：

| 依赖 | 使用位置 | 处理 |
|---|---|---|
| better-sqlite3 | src/main（db、repository） | 保留 dependencies |
| dayjs | src/main/service + renderer | 保留 dependencies（主进程也用） |
| p-queue | src/main/db | 保留 dependencies |
| winston | src/main/utils | 保留 dependencies |
| mermaid | 仅经 x-markdown-vue 打包进 renderer | 移入 devDependencies |
| vue-element-plus-x | src/renderer/src/main.ts | 移入 devDependencies |
| x-markdown-vue | src/renderer/src/views/AIView | 移入 devDependencies |
| @element-plus/icons-vue | 经 unplugin 自动引入，renderer 专用 | 移入 devDependencies |

## 第 2 节：量化验证

1. 执行 `pnpm package:win` 重新打包
2. 记录并对比：
   - 安装包体积（`release/个人记账 Setup 1.0.0.exe`）
   - `app.asar` 体积与文件数（`npx asar list` 统计）
   - `win-unpacked` 目录总体积
3. 预期：asar 189MB → ~100MB，asar 文件数 17k → ~7k，安装包 134MB → ~100MB 以内
4. 安装提速由"解压数据量 + 文件数双降"推得（不主动跑安装器计时，避免影响用户环境）

## 阶段二/三（待阶段一验证后决定，不在本次范围）

- 阶段二：`electron-builder.yml` 增加 `asarUnpack: ["**/*.node"]`，避免 better-sqlite3 的 9MB `sqlite3.c` 源码被展开
- 阶段三：清理 release 目录旧产物 `人员管理系统 Setup 1.0.0.exe`（101MB，其他项目产物）
