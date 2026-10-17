import { app, clipboard, ipcMain, shell } from 'electron'
import { aiConfigService } from '../service/ai/aiConfigService'
import { getConfigStore } from '../service/configStore'
import { getMCPStatus, startMCPServer, stopMCPServer } from '../mcp/mcp-server'
import { getConfigPath, getDataDir, getDbPath, getMcpAgentPath } from '../utils/paths'
import { logger } from '../utils/logger'

function ok<T>(data: T, msg = 'ok') {
  return { code: 0, data, msg }
}

function fail(msg: string) {
  return { code: -1, data: null, msg }
}

function buildClientConfig(port: number): string {
  return JSON.stringify({
    mcpServers: {
      '个人记账': {
        command: 'node',
        args: [getMcpAgentPath()],
        env: { PF_MCP_PORT: String(port) },
      },
    },
  }, null, 2)
}

export function registerSettingsController(): void {
  ipcMain.handle('settings:ai:get', async () => {
    try {
      return ok(aiConfigService.getConfig())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:ai:get 异常: ${msg}`)
      return fail(`系统异常: ${msg}`)
    }
  })

  ipcMain.handle('settings:ai:save', async (_event, params: { apiKey: string; model: string }) => {
    try {
      const apiKey = String(params?.apiKey || '').trim()
      const model = String(params?.model || '').trim()
      if (!apiKey) return fail('API Key 不能为空')
      if (!model) return fail('模型名称不能为空')
      aiConfigService.saveConfig(apiKey, model)
      return ok(null, '保存成功')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:ai:save 异常: ${msg}`)
      return fail(`系统异常: ${msg}`)
    }
  })

  ipcMain.handle('settings:ai:test', async (_event, params?: { apiKey?: string; model?: string }) => {
    try {
      const apiKey = params?.apiKey?.trim() || undefined
      const model = params?.model?.trim() || undefined
      const passed = await aiConfigService.testConnection(apiKey, model)
      return passed
        ? ok(null, '连接成功')
        : fail('连接失败，请检查 API Key 和模型')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:ai:test 异常: ${msg}`)
      return fail(msg)
    }
  })

  ipcMain.handle('settings:ai:models', async (_event, params?: { apiKey?: string }) => {
    try {
      const models = await aiConfigService.listModels(params?.apiKey)
      return ok(models)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:ai:models 异常: ${msg}`)
      return fail(msg)
    }
  })

  ipcMain.handle('settings:mcp:get', async () => {
    try {
      const config = getConfigStore().get('mcp')
      const status = getMCPStatus()
      return ok({
        enabled: config.enabled,
        port: config.port,
        running: status.running,
        error: status.error,
        clientConfig: buildClientConfig(config.port),
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:mcp:get 异常: ${msg}`)
      return fail(`系统异常: ${msg}`)
    }
  })

  ipcMain.handle('settings:mcp:save', async (_event, params: { enabled: boolean; port: number }) => {
    const enabled = !!params?.enabled
    const port = Number(params?.port)
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return fail('端口必须是 1024–65535 的整数')
    }

    try {
      if (!enabled) {
        await stopMCPServer()
      } else {
        await startMCPServer(port)
      }
      getConfigStore().set('mcp', { enabled, port })
      const status = getMCPStatus()
      return ok(
        { running: status.running, port: status.port, error: status.error },
        enabled ? '配置已保存' : 'MCP 服务已停止'
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      const status = getMCPStatus()
      logger.error(`[IPC] settings:mcp:save 异常: ${msg}`)
      return {
        code: -1,
        data: { running: status.running, port: status.port, error: status.error },
        msg,
      }
    }
  })

  ipcMain.handle('settings:app:info', async () => {
    try {
      return ok({
        version: app.getVersion(),
        dataDir: getDataDir(),
        dbPath: getDbPath(),
        configPath: getConfigPath(),
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:app:info 异常: ${msg}`)
      return fail(`系统异常: ${msg}`)
    }
  })

  ipcMain.handle('settings:app:open-path', async (_event, params: { path: string }) => {
    try {
      const target = String(params?.path || '')
      const allowed = new Set([getDataDir(), getConfigPath()])
      if (!allowed.has(target)) return fail('不允许打开该路径')
      const error = await shell.openPath(target)
      return error ? fail(error) : ok(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:app:open-path 异常: ${msg}`)
      return fail(`系统异常: ${msg}`)
    }
  })

  ipcMain.handle('settings:app:copy', async (_event, params: { text: string }) => {
    try {
      clipboard.writeText(String(params?.text || ''))
      return ok(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      logger.error(`[IPC] settings:app:copy 异常: ${msg}`)
      return fail(`复制失败: ${msg}`)
    }
  })

  logger.info('Settings IPC 控制器注册完成')
}
