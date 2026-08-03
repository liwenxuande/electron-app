# 安装包体积优化（阶段一：依赖归位）实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 4 个渲染进程专用依赖移入 `devDependencies`，消除 app.asar 内的重复打包，缩小安装包体积并降低安装卡顿。

**架构：** 仅调整 `package.json` 依赖分区——electron-builder 只把 `dependencies` 的 node_modules 打进 asar，vite 对渲染进程的打包只看 import 语句、不受分区影响（`element-plus`、`echarts` 已在 devDependencies 即为既有证明）。重新打包后量化对比安装包 / asar / win-unpacked 的体积与文件数。

**技术栈：** package.json、pnpm、electron-builder（NSIS）、electron-vite、asar CLI

**基线数据（优化前，已实测）：**

| 指标 | 优化前 |
|---|---|
| 安装包体积 | 134.36 MB（release/个人记账 Setup 1.0.0.exe） |
| app.asar 体积 / 文件数 | 189.34 MB / 17,068（其中 16,959 来自 node_modules） |
| win-unpacked 体积 / 文件数 | 555.66 MB / 127 |

**判定标准（达标即阶段一成功）：** 新安装包 < 110 MB，新 asar 文件数 < 9,000，且 `pnpm build` 与打包全程无报错。

---

### 任务 1：依赖归位

**文件：**
- 修改：`package.json`（dependencies / devDependencies 两个区块）
- 修改：`pnpm-lock.yaml`（由 `pnpm install` 自动更新）

- [ ] **步骤 1：编辑 `package.json`**

将 `mermaid`、`vue-element-plus-x`、`x-markdown-vue`、`@element-plus/icons-vue` 从 `dependencies` 移入 `devDependencies`。修改后两个区块应为：

```json
  "dependencies": {
    "better-sqlite3": "^12.11.1",
    "dayjs": "^1.11.13",
    "p-queue": "^8.1.0",
    "winston": "^3.17.0"
  },
  "devDependencies": {
    "@element-plus/icons-vue": "^2.3.2",
    "@types/better-sqlite3": "^7.6.12",
    "@vitejs/plugin-vue": "^5.2.3",
    "echarts": "^6.1.0",
    "electron": "^42.4.1",
    "electron-builder": "^26.15.3",
    "electron-vite": "^6.0.0-beta.1",
    "element-plus": "^2.9.7",
    "mermaid": "^11.16.0",
    "pinia": "^2.3.1",
    "sass": "^1.102.0",
    "typescript": "^5.7.3",
    "unplugin-auto-import": "^21.1.0",
    "unplugin-vue-components": "^32.1.0",
    "vue": "^3.5.13",
    "vue-echarts": "^8.0.1",
    "vue-element-plus-x": "^2.0.3",
    "x-markdown-vue": "^0.0.201"
  }
```

- [ ] **步骤 2：更新 lockfile**

运行：`pnpm install`

预期：成功，`pnpm-lock.yaml` 中这 4 个包的分类随之更新，无版本变更、无新增依赖。

注意：`package-lock.json` 为历史遗留（项目实际使用 pnpm），不更新、不纳入本次提交。

- [ ] **步骤 3：构建验证（确认 import 解析不受影响）**

运行：`pnpm build`

预期：electron-vite build 成功退出，`out/main`、`out/preload`、`out/renderer` 均生成。渲染进程的 `mermaid`（经 x-markdown-vue）、`vue-element-plus-x`、`x-markdown-vue`、`@element-plus/icons-vue` 仍被正常打进 `out/renderer`（out 目录体积基本不变）。

- [ ] **步骤 4：Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "perf: 渲染进程专用依赖移入 devDependencies，消除 asar 重复打包"
```

### 任务 2：重新打包

**文件：** 无（仅产出 `release/` 产物）

- [ ] **步骤 1：执行打包**

运行：`pnpm package:win`

预期：electron-vite build + electron-builder --win 成功，`release/` 下生成新的 `个人记账 Setup 1.0.0.exe`（覆盖旧产物）、`个人记账 Setup 1.0.0.zip`、`win-unpacked/`。若 electron-builder 因网络下载二进制失败，重试一次；仍失败则汇报阻塞。

### 任务 3：量化验证

**文件：** 无

- [ ] **步骤 1：测量新安装包体积**

```powershell
Get-ChildItem "f:\project\pc_app\electron-01\release" -Filter "*.exe" | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}}
```

预期：`个人记账 Setup 1.0.0.exe` < 110 MB（基线 134.36 MB）。

- [ ] **步骤 2：测量新 asar 体积与文件数**

```powershell
(Get-Item "f:\project\pc_app\electron-01\release\win-unpacked\resources\app.asar").Length / 1MB
npx asar list "f:\project\pc_app\electron-01\release\win-unpacked\resources\app.asar" | Measure-Object
```

预期：asar 约 100 MB 上下（基线 189.34 MB），文件数 < 9,000（基线 17,068）。

- [ ] **步骤 3：测量新 win-unpacked 体积与文件数**

```powershell
$f = Get-ChildItem "f:\project\pc_app\electron-01\release\win-unpacked" -Recurse -File
$f.Count
[math]::Round(($f | Measure-Object Length -Sum).Sum/1MB, 2)
```

预期：win-unpacked 约 467 MB 上下（基线 555.66 MB），文件数明显下降。

- [ ] **步骤 4：人工冒烟测试（运行时回归确认）**

运行 `release\win-unpacked\personal-finance.exe`，确认：主窗口正常出现、账本/分类/交易数据正常加载（验证 better-sqlite3 等原生模块与打包产物无回归）。测试完关闭应用。

- [ ] **步骤 5：汇总对比结论**

输出优化前后对比表（安装包 / asar / win-unpacked），判定是否达到阶段一达标线。若未达标（如 asar 文件数仍 > 9,000），检查 `package.json` 是否仍有渲染专用依赖滞留或打包配置异常，修正后回到任务 1 步骤 3 重跑。

### 任务 4：决策点与收尾

- [ ] **步骤 1：汇报验证结果**

向用户展示对比数据，确认阶段一达标。

- [ ] **步骤 2：询问是否进入阶段二/三**

阶段二：`electron-builder.yml` 增加 `asarUnpack: ["**/*.node"]` 收窄 better-sqlite3 展开（去 9MB 源码）。
阶段三：清理 `release/` 下旧产物 `人员管理系统 Setup 1.0.0.exe`（101MB，其他项目产物）。
由用户决定是否继续；不继续则本次计划到此结束。
