import { reactive, ref, watch } from 'vue'

const DEFAULT_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro']

export function useSettings() {
  // ---------- AI ----------
  const aiLoading = ref(false)
  const aiSaving = ref(false)
  const aiTesting = ref(false)
  const modelsLoading = ref(false)
  const aiForm = reactive({ apiKey: '', model: 'deepseek-v4-flash' })
  const models = ref<string[]>([...DEFAULT_MODELS])
  const testResult = ref<{ ok: boolean; msg: string } | null>(null)

  async function loadAIConfig() {
    aiLoading.value = true
    try {
      const res = await window.settingsAPI.getAIConfig()
      if (res.code === 0 && res.data) {
        aiForm.apiKey = res.data.apiKey
        aiForm.model = res.data.model
        if (!models.value.includes(res.data.model)) {
          models.value = [res.data.model, ...models.value]
        }
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '读取 AI 配置失败')
    } finally {
      aiLoading.value = false
    }
  }

  function clearTestResult() {
    testResult.value = null
  }

  watch(() => aiForm.apiKey, clearTestResult)

  async function saveAIConfig() {
    const apiKey = aiForm.apiKey.trim()
    const model = aiForm.model.trim()
    if (!apiKey) {
      ElMessage.warning('请填写 API Key')
      return
    }
    if (!model) {
      ElMessage.warning('请填写模型名称')
      return
    }

    aiSaving.value = true
    try {
      const res = await window.settingsAPI.saveAIConfig({ apiKey, model })
      if (res.code === 0) {
        aiForm.apiKey = apiKey
        aiForm.model = model
        ElMessage.success('保存成功')
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      aiSaving.value = false
    }
  }

  async function testAIConnection() {
    const apiKey = aiForm.apiKey.trim()
    if (!apiKey) {
      ElMessage.warning('请先填写 API Key')
      return
    }

    aiTesting.value = true
    testResult.value = null
    try {
      const res = await window.settingsAPI.testAIConnection({
        apiKey,
        model: aiForm.model.trim(),
      })
      testResult.value = res.code === 0
        ? { ok: true, msg: '连接成功' }
        : { ok: false, msg: res.msg }
    } catch (e: unknown) {
      testResult.value = {
        ok: false,
        msg: e instanceof Error ? e.message : '连接失败',
      }
    } finally {
      aiTesting.value = false
    }
  }

  async function refreshModels() {
    modelsLoading.value = true
    try {
      const res = await window.settingsAPI.listModels({
        apiKey: aiForm.apiKey.trim() || undefined,
      })
      if (res.code === 0 && Array.isArray(res.data)) {
        const list = res.data.filter(Boolean)
        models.value = Array.from(new Set([...list, aiForm.model].filter(Boolean)))
        ElMessage.success(`已获取 ${list.length} 个模型`)
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '获取模型列表失败')
    } finally {
      modelsLoading.value = false
    }
  }

  // ---------- MCP ----------
  const mcpLoading = ref(false)
  const mcpSaving = ref(false)
  const mcpForm = reactive({ enabled: true, port: 19527 })
  const mcpStatus = reactive<{ running: boolean; port: number | null; error: string | null }>({
    running: false,
    port: null,
    error: null,
  })
  const mcpClientConfig = ref('')

  async function loadMCPConfig() {
    mcpLoading.value = true
    try {
      const res = await window.settingsAPI.getMCPConfig()
      if (res.code === 0 && res.data) {
        mcpForm.enabled = res.data.enabled
        mcpForm.port = res.data.port
        mcpStatus.running = res.data.running
        mcpStatus.port = res.data.running ? res.data.port : null
        mcpStatus.error = res.data.error
        mcpClientConfig.value = res.data.clientConfig
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '读取 MCP 配置失败')
    } finally {
      mcpLoading.value = false
    }
  }

  async function saveMCPConfig() {
    if (!Number.isInteger(mcpForm.port) || mcpForm.port < 1024 || mcpForm.port > 65535) {
      ElMessage.warning('端口必须是 1024–65535 的整数')
      return
    }

    mcpSaving.value = true
    try {
      const res = await window.settingsAPI.saveMCPConfig({
        enabled: mcpForm.enabled,
        port: mcpForm.port,
      })
      if (res.code === 0 && res.data) {
        mcpStatus.running = res.data.running
        mcpStatus.port = res.data.port
        mcpStatus.error = res.data.error
        ElMessage.success(res.msg || '配置已保存')
        await loadMCPConfig()
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '保存失败')
    } finally {
      mcpSaving.value = false
    }
  }

  // ---------- App info ----------
  const appInfoLoading = ref(false)
  const appInfo = ref<AppInfoData | null>(null)

  async function loadAppInfo() {
    if (appInfo.value) return
    appInfoLoading.value = true
    try {
      const res = await window.settingsAPI.getAppInfo()
      if (res.code === 0 && res.data) {
        appInfo.value = res.data
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '读取应用信息失败')
    } finally {
      appInfoLoading.value = false
    }
  }

  async function copyText(text: string) {
    if (!text) return
    try {
      const res = await window.settingsAPI.copyText(text)
      if (res.code === 0) {
        ElMessage.success('已复制')
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '复制失败')
    }
  }

  async function openDataDir() {
    if (!appInfo.value) return
    try {
      const res = await window.settingsAPI.openPath(appInfo.value.dataDir)
      if (res.code !== 0) ElMessage.error(res.msg)
    } catch (e: unknown) {
      ElMessage.error(e instanceof Error ? e.message : '打开目录失败')
    }
  }

  return {
    aiLoading,
    aiSaving,
    aiTesting,
    modelsLoading,
    aiForm,
    models,
    testResult,
    loadAIConfig,
    clearTestResult,
    saveAIConfig,
    testAIConnection,
    refreshModels,
    mcpLoading,
    mcpSaving,
    mcpForm,
    mcpStatus,
    mcpClientConfig,
    loadMCPConfig,
    saveMCPConfig,
    appInfoLoading,
    appInfo,
    loadAppInfo,
    copyText,
    openDataDir,
  }
}
