import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import Store from 'electron-store'
import { logger } from '../utils/logger'

export interface AppConfig {
  ai: { apiKey: string; model: string }
  mcp: { enabled: boolean; port: number }
}

const defaults: AppConfig = {
  ai: { apiKey: '', model: 'deepseek-v4-flash' },
  mcp: { enabled: true, port: 19527 },
}

const schema = {
  ai: {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
      model: { type: 'string', minLength: 1 },
    },
    required: ['apiKey', 'model'],
  },
  mcp: {
    type: 'object',
    properties: {
      enabled: { type: 'boolean' },
      port: { type: 'integer', minimum: 1024, maximum: 65535 },
    },
    required: ['enabled', 'port'],
  },
}

let store: Store<AppConfig> | null = null

export function getConfigStore(): Store<AppConfig> {
  if (!store) {
    store = new Store<AppConfig>({
      name: 'config',
      defaults,
      schema: schema as any,
      clearInvalidConfig: true,
    })
  }
  return store
}

/**
 * 迁移旧版 userData/ai/config.json。
 * 仅在新配置没有 Key 且旧文件存在时执行；成功后删除旧文件。
 */
export function migrateLegacyAIConfig(): void {
  const configStore = getConfigStore()
  if (configStore.get('ai').apiKey) return

  const legacyFile = path.join(app.getPath('userData'), 'ai', 'config.json')
  if (!fs.existsSync(legacyFile)) return

  try {
    const raw = JSON.parse(fs.readFileSync(legacyFile, 'utf-8')) as {
      encryptedKey: string
      model?: string
      encrypted?: boolean
    }

    let plainKey: string
    if (raw.encrypted !== false) {
      if (!safeStorage.isEncryptionAvailable()) {
        logger.warn('safeStorage 不可用，跳过迁移并保留旧配置')
        return
      }
      plainKey = safeStorage.decryptString(Buffer.from(raw.encryptedKey, 'base64'))
    } else {
      plainKey = Buffer.from(raw.encryptedKey, 'base64').toString()
    }

    if (!plainKey) {
      logger.warn('旧 AI 配置迁移跳过：解密结果为空')
      return
    }

    const ai = configStore.get('ai')
    configStore.set('ai', { apiKey: plainKey, model: raw.model || ai.model })

    fs.rmSync(legacyFile)
    const legacyDir = path.dirname(legacyFile)
    if (fs.existsSync(legacyDir) && fs.readdirSync(legacyDir).length === 0) {
      fs.rmdirSync(legacyDir)
    }
    logger.info('旧 AI 配置已迁移到 electron-store')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`旧 AI 配置迁移失败: ${msg}`)
  }
}
