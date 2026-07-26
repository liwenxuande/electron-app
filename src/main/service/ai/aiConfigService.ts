import { app, safeStorage } from 'electron'
import fs from 'fs'
import path from 'path'
import { DeepSeekClient } from './deepseekClient'
import { logger } from '../../utils/logger'

export interface AIConfig {
  encryptedKey: string
  model: string
  encrypted?: boolean
}

const CONFIG_DIR = path.join(app.getPath('userData'), 'ai')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

class AIConfigService {
  private cachedKey: string | null = null
  private cachedModel: string = 'deepseek-v4-flash'

  saveApiKey(plainKey: string): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
    let config: AIConfig
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(plainKey)
      config = { encryptedKey: encrypted.toString('base64'), model: this.cachedModel, encrypted: true }
    } else {
      logger.warn('safeStorage 不可用，使用 base64 存储 API Key')
      config = { encryptedKey: Buffer.from(plainKey).toString('base64'), model: this.cachedModel, encrypted: false }
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config))
    this.cachedKey = plainKey
    logger.info('API Key 已保存')
  }

  getApiKey(): string | null {
    if (this.cachedKey) return this.cachedKey
    try {
      if (!fs.existsSync(CONFIG_FILE)) return null
      const config: AIConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
      let decrypted: string
      if (config.encrypted !== false && safeStorage.isEncryptionAvailable()) {
        decrypted = safeStorage.decryptString(Buffer.from(config.encryptedKey, 'base64'))
      } else {
        decrypted = Buffer.from(config.encryptedKey, 'base64').toString()
      }
      this.cachedKey = decrypted
      this.cachedModel = config.model || 'deepseek-v4-flash'
      return decrypted
    } catch {
      logger.error('解密 API Key 失败')
      return null
    }
  }

  saveModel(model: string): void {
    this.cachedModel = model
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const config: AIConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
        config.model = model
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config))
      }
    } catch { /* ignore */ }
  }

  getModel(): string {
    if (this.cachedKey === null) this.getApiKey()
    return this.cachedModel
  }

  hasKey(): boolean {
    return this.getApiKey() !== null
  }

  async testConnection(key?: string, model?: string): Promise<boolean> {
    const k = key || this.getApiKey()
    if (!k) return false
    const m = model || this.cachedModel
    const client = new DeepSeekClient(k, m)
    return client.validate()
  }

  createClient(): DeepSeekClient | null {
    const key = this.getApiKey()
    if (!key) return null
    return new DeepSeekClient(key, this.cachedModel)
  }
}

export const aiConfigService = new AIConfigService()
