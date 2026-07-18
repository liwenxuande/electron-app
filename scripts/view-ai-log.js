#!/usr/bin/env node
/**
 * AI 对话调试日志查看器
 *
 * 读取 utils/aiLogger.ts 写出的 ai-chat.log（JSON Lines），按 requestId 分组，
 * 把一次用户提问触发的完整链路（发给 DeepSeek 的参数 → 响应 → 工具调用 → 工具返回）
 * 用缩进好读的形式打印出来，替代直接看压缩成一行的原始 JSON。
 *
 * 用法：
 *   node scripts/view-ai-log.js                 自动定位日志文件，显示最近 5 次请求
 *   node scripts/view-ai-log.js --tail=20        显示最近 20 次请求
 *   node scripts/view-ai-log.js --session=<id>   只看某个会话的所有请求
 *   node scripts/view-ai-log.js --request=<id>   只看某一次请求（跨多轮 tool-calling 的完整链路）
 *   node scripts/view-ai-log.js --full           不截断内容，打印完整 messages/响应/工具结果
 *   node scripts/view-ai-log.js --file=<path>    手动指定日志文件路径（打包后应用名不同时用得上）
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 开发模式用 package.json 的 name，打包后用 electron-builder.yml 的 productName，两个都试一下
const CANDIDATE_APP_NAMES = ['personal-finance', '个人记账']

function candidateRoots() {
  const home = os.homedir()
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    return CANDIDATE_APP_NAMES.map((name) => path.join(appData, name, 'logs', 'ai-chat.log'))
  }
  if (process.platform === 'darwin') {
    return CANDIDATE_APP_NAMES.map((name) => path.join(home, 'Library', 'Application Support', name, 'logs', 'ai-chat.log'))
  }
  return CANDIDATE_APP_NAMES.map((name) => path.join(home, '.config', name, 'logs', 'ai-chat.log'))
}

function resolveLogFile(explicitPath) {
  if (explicitPath) return explicitPath
  const found = candidateRoots().find((p) => fs.existsSync(p))
  return found || candidateRoots()[0]
}

function parseArgs(argv) {
  const args = { tail: '5' }
  for (const raw of argv) {
    const m = raw.match(/^--([^=]+)(?:=(.*))?$/)
    if (!m) continue
    args[m[1]] = m[2] === undefined ? true : m[2]
  }
  return args
}

function loadRecords(file) {
  const raw = fs.readFileSync(file, 'utf-8')
  const records = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      records.push(JSON.parse(trimmed))
    } catch {
      // 跳过写入过程中可能截断的坏行
    }
  }
  return records
}

function truncate(value, n) {
  if (value === null || value === undefined) return value
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  return s.length > n ? `${s.slice(0, n)} …(共${s.length}字)` : s
}

function printMessages(messages, full) {
  for (const m of messages || []) {
    if (m.tool_calls) {
      console.log(`        [${m.role}] → 让模型调用工具: ${m.tool_calls.map((tc) => tc.function.name).join(', ')}`)
    } else if (m.role === 'tool') {
      console.log(`        [tool:${m.tool_call_id}] ${full ? m.content : truncate(m.content, 120)}`)
    } else {
      console.log(`        [${m.role}] ${full ? m.content : truncate(m.content, 120)}`)
    }
  }
}

function printGroup(requestId, events, full) {
  const first = events[0]
  console.log('='.repeat(72))
  console.log(`requestId: ${requestId}`)
  console.log(`sessionId: ${first.sessionId ?? '-'}    ledgerId: ${first.ledgerId ?? '-'}`)
  console.log(`时间范围:  ${first.timestamp} → ${events[events.length - 1].timestamp}`)
  console.log('-'.repeat(72))

  for (const e of events) {
    const tag = [e.phase ? `[${e.phase}]` : '', e.round ? `round${e.round}` : ''].filter(Boolean).join(' ')

    switch (e.event) {
      case 'request_start':
        console.log(`\n→ 请求发出 ${tag}  model=${e.model}  temperature=${e.temperature}${e.tools ? `  tools=[${e.tools.join(', ')}]` : ''}`)
        printMessages(e.messages, full)
        break

      case 'request_end': {
        console.log(`← 响应返回 ${tag}  耗时=${e.durationMs}ms  finishReason=${e.finishReason ?? '-'}`)
        if (e.usage) {
          console.log(`   tokens: 输入${e.usage.prompt_tokens} + 输出${e.usage.completion_tokens} = ${e.usage.total_tokens}`)
        }
        if (e.toolCalls && e.toolCalls.length) {
          for (const tc of e.toolCalls) {
            console.log(`   → 模型决定调用工具: ${tc.name}(${JSON.stringify(tc.arguments)})`)
          }
        } else if (e.content !== undefined) {
          console.log(`   回复内容: ${full ? e.content : truncate(e.content, 200)}`)
        }
        break
      }

      case 'tool_call':
        console.log(`  🔧 工具调用 ${tag}: ${e.name}(${JSON.stringify(e.arguments)})`)
        break

      case 'tool_result':
        console.log(`  ✅ 工具返回 ${tag}: ${e.name}  耗时=${e.durationMs}ms  → ${full ? JSON.stringify(e.result) : truncate(e.result, 200)}`)
        break

      case 'error':
        console.log(`  ❌ 出错 ${tag}: ${e.message}`)
        if (full && e.stack) console.log(e.stack)
        break

      default:
        console.log(JSON.stringify(e))
    }
  }
  console.log('')
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const file = resolveLogFile(args.file)

  if (!fs.existsSync(file)) {
    console.error(`找不到日志文件: ${file}`)
    console.error('如果应用装在其他位置或用了别的名字，用 --file=<实际路径> 指定。')
    process.exit(1)
  }

  let records = loadRecords(file)
  if (args.session) records = records.filter((r) => r.sessionId === args.session)
  if (args.request) records = records.filter((r) => r.requestId === args.request)

  const order = []
  const groups = new Map()
  for (const r of records) {
    if (!r.requestId) continue
    if (!groups.has(r.requestId)) {
      groups.set(r.requestId, [])
      order.push(r.requestId)
    }
    groups.get(r.requestId).push(r)
  }

  let ids = order
  if (!args.request && !args.session) {
    const n = Number(args.tail)
    if (Number.isFinite(n) && n > 0) ids = ids.slice(-n)
  }

  console.log(`日志文件: ${file}`)
  console.log(`共 ${order.length} 次请求，本次显示 ${ids.length} 次\n`)

  for (const id of ids) {
    printGroup(id, groups.get(id), !!args.full)
  }
}

main()
