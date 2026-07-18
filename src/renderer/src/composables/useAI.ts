import { ref } from 'vue'
import { AIconfigType } from './types'

export interface AIConfig {
  apiKey: string
  model: 'deepseek-v4-flash' | 'deepseek-v4-pro'
}

const settingsVisible = ref(false)
const ready = ref(false)

const config = ref<AIConfig>({
  apiKey: '',
  model: 'deepseek-v4-flash',
})

let loaded = false

export function useAI(): AIconfigType {
  async function loadConfig() {
    if (loaded) return
    loaded = true
    try {
      const res = await window.aiAPI.getConfig()
      if (res.code === 0 && res.data) {
        config.value = {
          apiKey: res.data.hasKey ? '(已保存)' : '',
          model: res.data.model || 'deepseek-v4-flash',
        }
      }
    } catch { /* ignore */ }
    ready.value = true
  }

  function openSettings() {
    settingsVisible.value = true
    loadConfig()
  }

  function closeSettings() {
    settingsVisible.value = false
  }

  async function saveConfig(newConfig: AIConfig) {
    try {
      await window.aiAPI.saveConfig({ key: newConfig.apiKey, model: newConfig.model })
      config.value = { ...newConfig }
    } catch { /* ignore */ }
    settingsVisible.value = false
  }

  return {
    settingsVisible,
    config,
    ready,
    openSettings,
    closeSettings,
    saveConfig,
    loadConfig,
  }
}
