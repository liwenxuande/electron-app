# 安装包体积优化（阶段一：依赖归位）执行报告

**计划：** docs/superpowers/plans/2026-08-03-installer-size-optimization.md
**分支：** feature-personal-accounting
**任务：** 4/4 已完成

### 完成的任务
1. ✅ 任务 1 依赖归位：`mermaid`、`vue-element-plus-x`、`x-markdown-vue`、`@element-plus/icons-vue` 从 `dependencies` 移入 `devDependencies`；`pnpm install` 更新 lockfile；`pnpm build` 通过（commit `9225e27`）
2. ✅ 任务 2 重新打包：`pnpm package:win` 成功，`release/` 生成新安装包、zip、`win-unpacked/`
3. ✅ 任务 3 量化验证：安装包 / asar / win-unpacked 三项全部达标，冒烟测试启动正常（见验证结果）
4. ✅ 任务 4 决策点与收尾：汇报验证结果（本报告），等待用户决定是否进入阶段二/三及是否合并

### 验证结果
| 指标 | 优化前（基线） | 优化后 | 判定 |
|---|---|---|---|
| 安装包体积（个人记账 Setup 1.0.0.exe） | 134.36 MB | 102.12 MB（-24%） | ✅ < 110 MB |
| app.asar 体积 | 189.34 MB | 13.68 MB（14,345,881 bytes） | ✅ 大幅低于预期 |
| app.asar 文件数 | 17,068（其中 16,959 来自 node_modules） | 1,262 | ✅ < 9,000 |
| win-unpacked 体积 | 555.66 MB | 380.00 MB（-32%） | ✅ 明显下降 |
| win-unpacked 文件数 | 127 | 127 | 持平（框架固定文件） |
| 构建 / 打包 | — | `pnpm build`、`pnpm package:win` 全程无报错 | ✅ |
| 冒烟测试 | — | `win-unpacked\personal-finance.exe` 启动正常，账本/分类/交易数据正常加载 | ✅ |

实测命令：`Get-ChildItem release -Filter "*.exe"`（102.12 MB）、`(Get-Item release\win-unpacked\resources\app.asar).Length`（14,345,881）、`npx asar list ... | Measure-Object`（1,262）、win-unpacked 递归统计（380.00 MB / 127）。

### 偏离计划的地方
- asar 优化收益远超预期：计划预期新 asar 约 100 MB 上下，实际仅 13.68 MB（因为优化前 asar 中 16,959 个 node_modules 文件绝大多数来自移出的渲染依赖，而 remaining 的 `better-sqlite3`/`dayjs`/`p-queue`/`winston` 体积很小）。对判定标准无影响，全部达标且超额。
- 额外提交 `40893f8`：打包时 electron-builder 因缺少 `GH_TOKEN` 在 CI 模式下尝试自动发布而报错，将 `package:win` 脚本改为 `electron-builder --win --publish never` 解决。这是计划外的修正，属于打包链路必要调整。
- win-unpacked 文件数与基线持平（127，计划预期"明显下降"）：文件数主要由 electron 框架展开文件决定，与依赖归位无关；体积仍下降 32%。

### 下一步
按 `finishing-a-development-branch` 处理收尾：等待用户决定（1）是否合并 `feature-personal-accounting`；（2）是否进入阶段二（`asarUnpack: ["**/*.node"]` 收窄 better-sqlite3 展开，去 9MB 源码）与阶段三（清理 `release/` 下其他项目遗留产物 `人员管理系统 Setup 1.0.0.exe`，101MB）。
