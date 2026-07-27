# MCP 服务使用指南

> 让外部 AI 应用（TraeWork、Claude Code、Cursor、Codex 等）通过 MCP 协议访问个人记账数据。

## 快速开始

### 第一步：确保个人记账应用已启动

MCP 需要通过应用内 HTTP 服务（`localhost:19527`）才能访问数据。打开"个人记账"应用即可，无需额外操作。

### 第二步：选择你的 AI 工具

---

## 方式 A：TraeWork 用户（推荐，一键安装）

1. 打开插件目录 `plugin/`
2. 在 TraeWork 的 MCP 设置中，选择"从本地加载插件"，指向该目录
3. 或者在 TraeWork 的 MCP 配置中手动添加：

```json
{
  "mcpServers": {
    "个人记账": {
      "command": "node",
      "args": ["%LOCALAPPDATA%/personal-finance/resources/mcp-agent.cjs"]
    }
  }
}
```

之后 TraeWork 会自动发现并调用以下能力。

---

## 方式 B：Claude Code 用户

在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "个人记账": {
      "command": "node",
      "args": ["{项目路径}/resources/mcp-agent.cjs"]
    }
  }
}
```

> `{项目路径}` 替换为本项目的实际路径，例如 `f:/project/pc_app/electron-01/resources/mcp-agent.cjs`

---

## 方式 C：Cursor 用户

在项目根目录创建 `.cursor/mcp.json`，内容同上。

---

## 方式 D：VS Code Copilot 用户

在项目根目录创建 `.vscode/mcp.json`，内容同上。

---

## 方式 E：其他 AI 工具

只要支持 MCP Stdio 协议，在对应配置中设置：

```json
{
  "command": "node",
  "args": ["{mcp-agent.cjs 的绝对路径}"]
}
```

`mcp-agent.cjs` 位于项目 `resources/` 目录下。

---

## 可用功能

配置完成后，AI 助手可以执行以下操作：

### 账单查询

| 操作 | 说明 | 示例对话 |
|---|---|---|
| 查询账单列表 | 支持按类型、分类、账本、日期、关键字筛选和分页 | "帮我看看这个月的餐饮支出" |
| 查询单条账单 | 按 ID 查看详情 | "显示第 42 号账单的详细信息" |

### 账单操作

| 操作 | 说明 | 示例对话 |
|---|---|---|
| 新增账单 | 记录一笔收入或支出 | "记一笔：今天午餐 35 元，餐饮分类" |
| 编辑账单 | 修改已有记录 | "把刚才那笔午餐改成 42 元" |
| 删除账单 | 删除记录（不可恢复） | "删除第 42 号账单" |

### 辅助查询

| 操作 | 说明 | 示例对话 |
|---|---|---|
| 查看账本 | 列出所有账本 | "我有几个账本？" |
| 查看分类 | 列出所有收支分类 | "支出有哪些分类？" |

### Tool 完整列表

| Tool 名 | 参数 | 说明 |
|---|---|---|
| `list_transactions` | `type?`, `categoryId?`, `ledgerId?`, `startDate?`, `endDate?`, `keyword?`, `page?`, `pageSize?` | 分页查询账单 |
| `get_transaction` | `id`（必填） | 按 ID 查单条 |
| `create_transaction` | `type`, `amount`, `categoryId`, `ledgerId`, `transDate`（必填）, `description?`, `paymentMethod?` | 新增 |
| `update_transaction` | `id` + 同 create（均必填） | 编辑 |
| `delete_transaction` | `id`（必填） | 删除 |
| `list_ledgers` | 无 | 账本列表 |
| `list_categories` | `type?`（income/expense） | 分类列表 |

---

## 常见问题

### Q: AI 提示"请先启动个人记账应用"？

应用没有在运行。打开"个人记账"应用后再试。

### Q: 能同时连接多个 AI 工具吗？

可以。MCP 服务通过 `localhost:19527` 提供，多个工具可同时连接。

### Q: 数据安全吗？

- MCP 服务仅监听 `127.0.0.1`（本机回环），不暴露给局域网
- AI 工具只能操作你的本地数据库，数据不会上传到云端
- 应用关闭后 MCP 自动停止

### Q: 能导入 CSV 或查看统计图表吗？

当前版本 MCP 工具覆盖：账单 CRUD + 账本/分类查询。CSV 导入和统计功能需在应用界面操作。
