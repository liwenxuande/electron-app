<template>
  <div class="settings-panel" v-loading="aiLoading">
    <div class="settings-panel-head">
      <h2>AI 配置</h2>
      <p>配置 DeepSeek API Key 与对话模型</p>
    </div>

    <div class="settings-card">
      <div class="settings-card-title">
        <span>API Key</span>
        <span class="settings-tag">本机保存</span>
      </div>
      <el-input
        v-model="aiForm.apiKey"
        type="password"
        show-password
        class="settings-mono"
        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxx"
        @input="clearTestResult"
      />
      <p class="settings-hint">Key 以明文保存在本机 config.json 中，不会上传到其他服务。</p>
    </div>

    <div class="settings-card">
      <div class="settings-card-title">
        <span>模型</span>
      </div>
      <div class="settings-row">
        <el-select
          v-model="aiForm.model"
          class="settings-model-select"
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入模型名称"
        >
          <el-option v-for="item in models" :key="item" :label="item" :value="item" />
        </el-select>
        <el-button :loading="modelsLoading" @click="refreshModels">刷新模型列表</el-button>
      </div>
      <p class="settings-hint">可直接输入模型名称，也可从 DeepSeek 官方列表选择。</p>
    </div>

    <div class="settings-actions">
      <div class="settings-test">
        <el-button :loading="aiTesting" @click="testAIConnection">测试连接</el-button>
        <span v-if="testResult" :class="testResult.ok ? 'settings-ok' : 'settings-fail'">
          {{ testResult.msg }}
        </span>
      </div>
      <el-button type="primary" :loading="aiSaving" @click="saveAIConfig">保存配置</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'

const {
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
} = useSettings()

onMounted(loadAIConfig)
</script>
