# AI 对话调试日志 —— 上手指南

面向对象：不熟悉这套日志框架的人，照着这篇文档一步步做就能定位 AI 对话相关的 bug。

配套代码：[src/main/utils/aiLogger.ts](../src/main/utils/aiLogger.ts)、[scripts/view-ai-log.js](../scripts/view-ai-log.js)
更偏工程实现细节的设计说明见 [ai-integration-design.md 第 16 节](./ai-integration-design.md#16-ai-调用调试日志框架)。

## 目录

1. [这套日志解决什么问题](#1-这套日志解决什么问题)
2. [日志文件在哪](#2-日志文件在哪)
3. [一行日志长什么样](#3-一行日志长什么样)
4. [最简单的看法：命令行工具](#4-最简单的看法命令行工具)
5. [不用工具，直接打开文件看](#5-不用工具直接打开文件看)
6. [实战：一步步排查一个真实问题](#6-实战一步步排查一个真实问题)
7. [常见问题 FAQ](#7-常见问题-faq)
8. [速查表](#8-速查表)

---

## 1. 这套日志解决什么问题

AI 助手（`AIView.vue`）背后的对话流程比较绕：用户发一句话 → 先问一次 DeepSeek「要不要查数据库」→ 如果要查，执行对应的工具（最多循环 5 轮）→ 最后再流式生成给用户看的回复。任何一步出问题，用户看到的现象往往只是"回复不对"或"没反应"，看不出到底是哪一步错了。

这套日志会把**每一步**都完整记下来，不做任何截断：

- 发给 DeepSeek 的完整参数（用的什么模型、完整的对话历史、可用的工具列表）
- DeepSeek 返回的完整结果（是直接回复了，还是要求调用工具、调用了哪个工具、传了什么参数）
- 每个工具实际执行后返回了什么数据
- 最终展示给用户的完整文本
- 任何一步报错时的完整错误信息

日志写在一个独立文件 `ai-chat.log` 里，跟其他日志（数据库、界面操作等）分开，不用大海捞针。

## 2. 日志文件在哪

文件名固定叫 `ai-chat.log`，具体文件夹跟应用当前叫什么名字有关：

| 场景 | 路径（Windows） |
|---|---|
| 开发模式 `pnpm dev` | `C:\Users\<你的用户名>\AppData\Roaming\personal-finance\logs\ai-chat.log` |
| 打包安装后（应用名"个人记账"） | `C:\Users\<你的用户名>\AppData\Roaming\个人记账\logs\ai-chat.log` |

> mac / Linux 用户：对应 `~/Library/Application Support/<应用名>/logs/ai-chat.log` 或 `~/.config/<应用名>/logs/ai-chat.log`。

**不确定具体路径？** 直接跳到第 4 节用命令行工具，它会自动帮你找。

⚠️ **注意**：这个文件只有主进程（`src/main/**`）代码生效之后才会写入。如果你刚改了 AI 相关的主进程代码，必须**完全重启** `pnpm dev`（渲染层的热更新对主进程不生效），改完之后再发一条消息，日志才会体现新代码的行为。

## 3. 一行日志长什么样

日志文件是 **JSON Lines** 格式：每一行都是一条完整、独立的 JSON 记录，行与行之间没有关联符号，靠里面的字段自己认领。所有记录共享这几个字段：

| 字段 | 含义 |
|---|---|
| `event` | 这条记录是哪种事件，见下表 |
| `requestId` | 一次用户提问（可能内部循环好几轮工具调用）的唯一编号，**同一次提问的所有记录这个值都一样** |
| `sessionId` | 对话会话编号（对应左侧会话列表里的一个会话），一次会话里可能有很多个 `requestId` |
| `round` | 工具调用循环的第几轮，从 1 开始 |
| `timestamp` | 这条记录发生的时间 |

不同 `event` 的记录还会带各自的字段：

| event | 什么时候记 | 关键字段 |
|---|---|---|
| `request_start` | 每次给 DeepSeek 发请求之前 | `model`、`temperature`、`messages`（完整对话历史）、`tools`（本次可用的工具名单，只有判断要不要调工具的那次请求才有） |
| `request_end` | 收到 DeepSeek 完整响应之后 | `durationMs`（耗时）、`finishReason`、`content`（回复文本）、`toolCalls`（模型要调用的工具及参数）、`usage`（token 用量） |
| `tool_call` | 执行某个工具之前 | `name`（工具名）、`arguments`（工具入参） |
| `tool_result` | 工具执行完之后 | `name`、`durationMs`、`result`（工具返回的数据） |
| `error` | 任何一步抛异常 | `phase`（哪个阶段出错）、`message`、`stack` |

一次"不需要查数据库"的简单提问，日志会依次出现：
`request_start(phase=tools)` → `request_end(phase=tools, finishReason=stop)` → `request_start(phase=stream)` → `request_end(phase=stream)`

一次"需要查数据库"的提问，中间会插入工具调用：
`request_start(phase=tools)` → `request_end(phase=tools, finishReason=tool_calls)` → `tool_call` → `tool_result` → （可能再循环一轮 `request_start/end(phase=tools)`）→ 最终 `request_start(phase=stream)` → `request_end(phase=stream)`

## 4. 最简单的看法：命令行工具

项目自带一个查看脚本，会自动定位日志文件、按 `requestId` 分组、缩进美化打印，不用自己啃 JSON。在项目根目录执行：

```bash
pnpm logs:ai
```

默认显示最近 5 次请求，长内容会截断方便扫读。常用参数：

```bash
pnpm logs:ai -- --full             # 不截断，看完整内容（真正排查问题时用这个）
pnpm logs:ai -- --tail=20          # 看最近 20 次请求
pnpm logs:ai -- --session=<会话ID>  # 只看某个会话的所有请求
pnpm logs:ai -- --request=<请求ID>  # 只看某一次请求的完整链路
pnpm logs:ai -- --file=<路径>       # 自动定位失败时，手动指定文件路径
```

> 注意 `--` 前后都有空格，这是 pnpm 转发参数给脚本的写法，不能省略。

输出示例（简化版）：

```
requestId: e1329dec-f23b-4dab-8f6f-1b8603e3200b
sessionId: chat-1784126542702-ry0u8b    ledgerId: 1
时间范围:  2026-07-15T14:45:39.732Z → 2026-07-15T14:45:46.259Z
------------------------------------------------------------------------

→ 请求发出 [tools] round1  model=deepseek-v4-pro  temperature=0.3  tools=[get_monthly_summary, ...]
        [system] 你是个人财务助手...
        [user] 你能做什么
← 响应返回 [tools] round1  耗时=3185ms  finishReason=stop
   tokens: 输入786 + 输出156 = 942
   回复内容: 我可以帮你：...

→ 请求发出 [stream] round1  model=deepseek-v4-pro  temperature=0.3
← 响应返回 [stream] round1  耗时=3342ms
   回复内容: 我能帮你分析记账数据...
```

图标含义：`→` 发出请求、`←` 收到响应、`🔧` 调用工具、`✅` 工具返回结果、`❌` 出错。

## 5. 不用工具，直接打开文件看

如果暂时不方便跑命令，也可以用普通文本编辑器（VS Code、记事本都行）直接打开 `ai-chat.log`：

1. 按第 2 节里的路径找到文件，用 VS Code 打开
2. 每一行是一条完整 JSON，行太长看着乱很正常——用编辑器的**搜索**（`Ctrl+F`）功能，搜你关心的 `sessionId` 或 `"event":"error"`，先定位到大概位置
3. 找到目标行后，全选这一行内容，粘贴到 [jsonformatter.org](https://jsonformatter.org) 之类的在线 JSON 格式化工具（或者直接问 AI 助手帮你格式化），看着就清楚了
4. VS Code 也可以装一个 "Prettify JSON" 类插件，选中一行按快捷键直接格式化，不用跳去网页

这种方式适合偶尔看一眼；如果要经常调试，还是推荐第 4 节的命令行工具，省事很多。

## 6. 实战：一步步排查一个真实问题

假设用户反馈："我问 AI 这个月花了多少钱，它说不知道/答非所问"。排查步骤：

**第一步：定位这次请求**

```bash
pnpm logs:ai -- --full
```

找到时间点对得上、`messages` 里最后一条 `user` 内容是这句提问的那个 `requestId`（记下这个 ID，后面可以用 `--request=` 精确过滤）。

**第二步：看模型有没有决定查数据库**

看第一条 `request_end(phase=tools)`：

- 如果 `finishReason` 是 `stop`、`toolCalls` 是空数组 → 模型自己判断"不需要查数据库"，直接凭对话上下文瞎猜回答的。这种情况通常是 **system prompt 或工具描述没让模型意识到该用工具**，需要调整 [aiToolService.ts](../src/main/service/ai/aiToolService.ts) 里工具的 `description` 描述，或者调整 [aiAnalysisService.ts](../src/main/service/ai/aiAnalysisService.ts) 里的 `SYSTEM_PROMPT`。
- 如果 `finishReason` 是 `tool_calls` → 继续第三步。

**第三步：看工具调用的参数对不对**

找紧接着的 `tool_call` 记录，看 `arguments` 里的月份、类型等参数是否正确。比如问"这个月"，`yearMonth` 却传了别的月份 → 说明模型理解错了当前日期，是 prompt 里缺少"今天是几号"这类上下文的问题。

**第四步：看工具返回的数据对不对**

找对应的 `tool_result` 记录，看 `result` 字段：

- 如果是空数组/全是 0 → 大概率是这个月确实没有符合条件的记账数据，或者 SQL 条件写错了（比如月份格式不匹配），可以去 [aiToolService.ts](../src/main/service/ai/aiToolService.ts) 里对应的私有方法核对 SQL
- 如果数据是对的 → 说明前面链路没问题，那就该看最后一步

**第五步：看最终回复是怎么"编"出来的**

看最后一组 `request_start(phase=stream)` 的 `messages`——这里能看到工具结果是怎么被塞进对话历史（`role: "tool"` 的消息）再喂给模型的。如果工具结果数据是对的，但最终 `request_end(phase=stream)` 的 `content` 还是答非所问，那问题出在模型没有正确利用这些数据组织语言，可以尝试调整 system prompt 或者换更强的模型（`deepseek-v4-pro` vs `deepseek-v4-flash`，配置见 `AISettingsDialog.vue`）。

## 7. 常见问题 FAQ

**Q: `pnpm logs:ai` 报错"找不到日志文件"？**
A: 两种可能：① 应用还没跑起来发过消息，文件根本没生成；② 你打包安装后用的是别的应用名，脚本猜的路径不对。用 `pnpm logs:ai -- --file=<真实路径>` 手动指定。真实路径可以在系统的应用数据目录里搜 `ai-chat.log` 文件名找到。

**Q: 改了主进程代码但日志没有变化？**
A: 主进程代码需要**完全重启** `pnpm dev` 才生效，不像界面代码能热更新。

**Q: 日志里会不会记录我的 DeepSeek API Key？**
A: 不会。日志只记录请求体（`model`/`messages`/`tools`/`temperature`）和响应内容，`Authorization` 请求头里的 API Key 从不写入日志，可以放心把日志发给别人排查问题。但要注意 `messages` 里包含你的完整记账问答内容，涉及隐私的话分享前自己看一眼。

**Q: 同一句提问怎么产生了好几组 `request_start`/`request_end`？**
A: 正常现象。一次提问至少发生 2 次请求：第一次是"要不要调用工具"的判断请求（`phase=tools`），第二次才是真正生成回复给用户看的请求（`phase=stream`）。如果模型连续判断需要调用工具，中间还会有更多轮 `phase=tools`，最多循环 5 轮（`MAX_TOOL_ROUNDS`，见 [aiAnalysisService.ts](../src/main/service/ai/aiAnalysisService.ts)）。

**Q: 看到 `round` 一直加到 5 就停了，回复也很奇怪？**
A: 说明模型连续 5 轮都想调用工具、一直没有给出最终答案，触发了循环上限保护，代码会强制发起最后一次流式请求收尾。这种情况通常是模型反复觉得数据不够、或者工具返回的数据模型看不懂导致的死循环，需要看每一轮的 `tool_call`/`tool_result` 具体分析。

**Q: 日志文件会不会一直变大占满硬盘？**
A: 不会，单文件最大 20MB，超过就自动滚动，最多保留 10 个历史文件（约 200MB 上限），配置见 [aiLogger.ts](../src/main/utils/aiLogger.ts) 里的 `maxsize`/`maxFiles`。

**Q: 我手动把 `ai-chat.log` 删了/清空重建，为什么应用还在跑却怎么都不再写入了？**
A: 应用运行期间不要手动删除这个文件——写入流一旦打开就绑定着当时那个文件描述符，文件被外部删除后，流并不知道，会一直往那个已经从目录里消失的旧文件写（这部分数据基本就丢了），你原地新建的同名空文件永远收不到任何写入，看起来就像"日志坏了"。现在的版本加了自愈检查：每次写入前会确认文件是否还在，不在就自动关掉旧流、重新指向当前路径开一个新流，不需要重启应用；如果确实想清空日志，等应用完全退出后再删文件最保险。

## 8. 速查表

```bash
# 最常用：看最近一次完整对话链路
pnpm logs:ai -- --tail=1 --full

# 看某个会话的所有请求
pnpm logs:ai -- --session=chat-xxxxxxx --full

# 精确定位某一次请求
pnpm logs:ai -- --request=<requestId> --full
```

| 想知道什么 | 看哪个 event | 看哪个字段 |
|---|---|---|
| 传给 DeepSeek 的完整参数 | `request_start` | `model` / `temperature` / `messages` / `tools` |
| DeepSeek 最终回了什么 | `request_end`（`phase=stream`） | `content` |
| 模型是否决定调用工具 | `request_end`（`phase=tools`） | `finishReason` / `toolCalls` |
| 调用了哪个工具、传了什么参数 | `tool_call` | `name` / `arguments` |
| 工具查出来的原始数据 | `tool_result` | `result` |
| 哪一步报错了 | `error` | `phase` / `message` |
| token 用量/花了多少钱 | `request_end` | `usage` |
