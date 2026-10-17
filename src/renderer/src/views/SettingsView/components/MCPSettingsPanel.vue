<template>
  <div class="settings-panel" v-loading="mcpLoading">
    <div class="settings-panel-head">
      <h2>MCP 服务</h2>
      <p>让外部 AI 工具通过本机 HTTP 服务访问记账数据</p>
    </div>

    <div class="settings-card">
      <div class="settings-card-title">
        <span>服务状态</span>
      </div>
      <div class="mcp-status">
        <span class="mcp-dot" :class="statusClass"></span>
        <span>{{ statusText }}</span>
        <span v-if="mcpStatus.running && mcpStatus.port" class="mcp-address">
          127.0.0.1:{{ mcpStatus.port }}
        </span>
        <el-button
          v-if="mcpStatus.running && mcpStatus.port"
          size="small"
          text
          @click="copyText(`http://127.0.0.1:${mcpStatus.port}`)"
        >
          复制地址
        </el-button>
      </div>
      <p v-if="mcpStatus.error" class="settings-fail">{{ mcpStatus.error }}</p>
    </div>

    <div class="settings-card">
      <div class="settings-card-title">
        <span>服务配置</span>
      </div>
      <div class="settings-field">
        <span class="settings-label">启用 MCP 服务</span>
        <el-switch v-model="mcpForm.enabled" />
      </div>
      <div class="settings-field">
        <span class="settings-label">监听端口</span>
        <el-input-number
          v-model="mcpForm.port"
          :min="1024"
          :max="65535"
          :step="1"
          :disabled="!mcpForm.enabled"
        />
      </div>
      <p class="settings-hint">仅监听本机回环地址 127.0.0.1，不暴露给局域网。</p>
      <div class="settings-actions">
        <span class="settings-hint">修改后需点击保存并应用</span>
        <el-button type="primary" :loading="mcpSaving" @click="saveMCPConfig">
          保存并应用
        </el-button>
      </div>
    </div>

    <div class="settings-card">
      <div class="settings-card-title">
        <span>客户端配置</span>
        <el-button size="small" @click="copyText(mcpClientConfig)">复制配置</el-button>
      </div>
      <pre class="mcp-config">{{ mcpClientConfig }}</pre>
      <p class="settings-hint">粘贴到 Trae / Claude Code / Cursor 的 MCP 配置中。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'

const {
  mcpLoading,
  mcpSaving,
  mcpForm,
  mcpStatus,
  mcpClientConfig,
  loadMCPConfig,
  saveMCPConfig,
  copyText,
} = useSettings()

const statusText = computed(() => {
  if (mcpStatus.running) return '运行中'
  return mcpStatus.error ? '启动失败' : '已停止'
})

const statusClass = computed(() => {
  if (mcpStatus.running) return 'on'
  return mcpStatus.error ? 'error' : 'off'
})

onMounted(loadMCPConfig)
</script>
