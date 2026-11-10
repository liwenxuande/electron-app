# 月度财务报表导出功能设计（PDF）

- 日期：2026-11-10
- 状态：已批准（方案 B：vite 多入口独立打印页）
- 模板基准：`report-template-ultra.html`（7 页结构，已通过多轮视觉评审）

## 背景与目标

项目 AI 模块现有 6 个统计工具（月度汇总/分类排行/每日走势/TOP 交易/两月对比/当前时间），AI 助手页可流式生成报表文本，但没有可交付的文件产出。本功能实现**独立报表页 + 一键导出 PDF**。

目标：
1. 基于 Ultra 模板产出 7 页月度 PDF 报表（封面/执行摘要/收支趋势/支出结构/走势习惯/洞察评分/建议附录）
2. 数据收集由代码确定性完成（不走 AI 工具循环），AI 仅生成结论文案（一次非流式调用）
3. 主应用内可预览，预览与 PDF 完全一致（共享同一套组件）

非目标（本期不做）：
- Word（docx）导出——下一期
- AI 助手对话内触发报表
- 预算功能（预算 section 组件预留，无数据自动隐藏）
- 季度/年度报表

## 总体架构

```
ReportView（主应用新视图）
  │ 选月份 → report:generate
  ▼
reportDataService（统计聚合，直接查 DB）
  │ 确定性数据 + reportAiService（AI 文案，zod 校验）
  ▼
ReportData（shared 类型契约）
  │
  ├─→ 预览：ReportView 内嵌 ReportDocument（缩放展示）
  └─→ 导出：report:export
        → 隐藏 BrowserWindow 加载 report-print.html（独立 vite 入口）
        → IPC 注入数据 → ECharts 渲染（animation:false）→ print-ready 回执
        → printToPDF → showSaveDialog → 落盘
```

核心原则：**计算归代码，解读归 AI**。分类环比、YTD 累计等算术全部在服务端完成，AI 不做算术。

## 文件布局

```
src/
├── main/
│   ├── service/report/
│   │   ├── reportDataService.ts    # 数据聚合（月汇总/分类环比/6月趋势/YTD/记账行为派生）
│   │   ├── reportAiService.ts      # AI 文案生成（概述/洞察/建议/评分）
│   │   └── reportExportService.ts  # 隐藏窗口 + printToPDF + 保存
│   ├── controller/reportController.ts
│   └── service/ai/aiToolService.ts # 新增 2 个工具（见下）
├── shared/types/report.ts          # ReportData 类型 + zod schema
└── renderer/
    ├── report-print.html           # 独立入口（仅 Vue + ECharts）
    ├── report-print/main.ts        # 挂载 + IPC 收发
    └── src/
        ├── views/ReportView/index.vue       # 月份选择/生成/导出/预览
        └── components/report/               # 双端共享
            ├── ReportDocument.vue           # 7 页拼装
            ├── sections/                    # Cover/ExecSummary/OverviewCards/
            │                                # IncomeBar/Trend6/Budget(可选)/
            │                                # Pareto/Compare/CategoryTable/
            │                                # Daily/Habits/Top5/Insights/
            │                                # ScoreRadar/Suggestions/Closing/Appendix
            └── composables/useReportCharts.ts
```

构建配置：electron.vite.config.ts renderer 增加 rollupOptions.input
`{ report-print: 'src/renderer/report-print.html' }`。

## 数据契约（ReportData）

对齐 Ultra 模板 `REPORT_DATA`：

| 字段 | 来源 |
|---|---|
| summary / prevSummary | 月汇总 + 上月汇总 |
| categories[]（含环比 changePercent） | 新增 getCategoryComparison |
| incomeStructure[] | 分类排行 type=income |
| topEntries[] | TOP N 支出 |
| daily[] | 每日走势 |
| monthly6[] + ytd | 新增 getMonthlySummaries（服务端聚合） |
| bookStats（活跃天数/日均笔数/最大单日/连续记账） | daily 派生计算 |
| budgets? | 可选，无数据整节隐藏 |
| ai{overview/insights/suggestions/scoreDims} | reportAiService 生成 |

## 统计函数与 AI 工具扩展

`reportDataService` 新增：
- `getMonthlySummaries(endYM, months)`：近 N 月汇总 + YTD 累计
- `getCategoryComparison(currentYM, prevYM)`：分类级环比（服务端算差值）

包装为 AI 聊天工具（aiToolService 顺带注册，AI 助手可答"近半年趋势"）：
- `get_monthly_summaries(endYM, months)`
- `compare_category_breakdown(currentYM, prevYM)`

## AI 文案生成

- 复用现有 AI 服务非流式 JSON 调用（与 aiAnalysisService 报表 JSON 契约同源）
- 输入：聚合统计数据 + prompt 模板（五维评分权重写死在 prompt，方法论稳定）
- 输出经 zod schema 校验；失败重试 1 次；仍失败降级（见错误处理）

## IPC 契约

```
report:generate  { yearMonth } → ReportData    # 组装数据 + AI 文案
report:export    { yearMonth } → { filePath }  # 全流程导出
report:print-data  （主进程 → 打印页）数据注入
report:print-ready （打印页 → 主进程）渲染完成回执
```

## 导出时序

1. `report:export` → 隐藏 BrowserWindow（show:false，最小权限 webPreferences，无 nodeIntegration）
2. 加载 report-print.html（dev: `ELECTRON_RENDERER_URL/report-print.html`；prod: loadFile）
3. did-finish-load → 发 `report:print-data`
4. 打印页渲染 ReportDocument，图表 animation:false，nextTick 后发 `report:print-ready`
5. 主进程收回执（15s 超时）→ `printToPDF({ pageSize:'A4', printBackground:true, margins })`
6. showSaveDialog（filters: pdf）→ 写文件 → 销毁窗口 → 返回路径

## 错误处理与降级

| 场景 | 行为 |
|---|---|
| AI 调用失败/超时（30s） | AI section 显示"本月分析生成失败，仅数据报表"，导出不阻断 |
| 该月无交易 | 报表页提示，禁用生成按钮 |
| 打印页渲染超时（15s） | 销毁窗口，toast 报错 |
| 保存对话框取消 | 静默取消，非错误 |

## 测试策略

- reportDataService 聚合/环比/派生计算：vitest 单测（空月/单月/跨年边界）
- zod 校验降级路径：非法 JSON 样例测试
- 导出流程：dev + 打包后各手动验证一次（重点 loadFile 路径、中文字体、图表清晰度）

## 已知风险

- 打包后 loadFile 加载多入口页的路径正确性（`../renderer/report-print.html`）需实测
- ECharts 在隐藏窗口（show:false）的渲染：Chromium offscreen 渲染正常，但需实测部分驱动环境下 `printToPDF` 时机的稳定性——以 print-ready 回执 + 超时兜底
