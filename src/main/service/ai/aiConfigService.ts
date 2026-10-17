import { getConfigStore } from '../configStore'
import { DeepSeekClient } from './deepseekClient'

class AIConfigService {
  saveApiKey(plainKey: string): void {
    const store = getConfigStore()
    store.set('ai', { ...store.get('ai'), apiKey: plainKey.trim() })
  }

  getApiKey(): string | null {
    const { apiKey } = getConfigStore().get('ai')
    return apiKey || null
  }

  saveModel(model: string): void {
    const store = getConfigStore()
    store.set('ai', { ...store.get('ai'), model })
  }

  getModel(): string {
    return getConfigStore().get('ai').model
  }

  hasKey(): boolean {
    return this.getApiKey() !== null
  }

  getConfig(): { apiKey: string; model: string } {
    return {
      apiKey: this.getApiKey() ?? '',
      model: this.getModel(),
    }
  }

  saveConfig(apiKey: string, model: string): void {
    this.saveApiKey(apiKey)
    this.saveModel(model)
  }

  async listModels(key?: string): Promise<string[]> {
    const apiKey = key?.trim() || this.getApiKey()
    if (!apiKey) throw new Error('请先填写 API Key')
    return DeepSeekClient.listModels(apiKey)
  }

  async testConnection(key?: string, model?: string): Promise<boolean> {
    const k = key || this.getApiKey()
    if (!k) return false
    const client = new DeepSeekClient(k, model || this.getModel())
    return client.validate()
  }

  createClient(): DeepSeekClient | null {
    const key = this.getApiKey()
    if (!key) return null
    return new DeepSeekClient(key, this.getModel())
  }
}

export const aiConfigService = new AIConfigService()
