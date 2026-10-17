<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1 class="settings-title">设置</h1>
      <p class="settings-subtitle">管理 AI 配置、MCP 服务与本地数据</p>
    </div>

    <div class="settings-body">
      <SettingsSidebar v-model="activeGroup" />
      <section class="settings-content">
        <AISettingsPanel v-if="activeGroup === 'ai'" />
        <MCPSettingsPanel v-else-if="activeGroup === 'mcp'" />
        <GeneralSettingsPanel v-else-if="activeGroup === 'general'" />
        <DataSettingsPanel v-else-if="activeGroup === 'data'" />
        <AboutSettingsPanel v-else-if="activeGroup === 'about'" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SettingsSidebar from './components/SettingsSidebar.vue'
import AISettingsPanel from './components/AISettingsPanel.vue'
import MCPSettingsPanel from './components/MCPSettingsPanel.vue'
import GeneralSettingsPanel from './components/GeneralSettingsPanel.vue'
import DataSettingsPanel from './components/DataSettingsPanel.vue'
import AboutSettingsPanel from './components/AboutSettingsPanel.vue'

const activeGroup = ref('ai')
</script>

<style lang="scss" src="./settings.scss"></style>
