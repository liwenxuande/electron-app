<template>
  <div class="settings-panel" v-loading="appInfoLoading">
    <div class="settings-panel-head">
      <h2>关于</h2>
      <p>个人记账</p>
    </div>

    <div class="settings-card">
      <div class="settings-info-list">
        <div class="settings-info-row">
          <span class="settings-info-label">应用名称</span>
          <span class="settings-info-value">个人记账</span>
        </div>
        <div class="settings-info-row">
          <span class="settings-info-label">版本</span>
          <span class="settings-info-value">{{ appInfo?.version || '-' }}</span>
        </div>
        <div class="settings-info-row">
          <span class="settings-info-label">技术栈</span>
          <span class="settings-info-value">Electron + Vue 3 + TypeScript + Pinia + Element Plus</span>
        </div>
        <div class="settings-info-row">
          <span class="settings-info-label">版权</span>
          <span class="settings-info-value">© 2026 个人记账</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'

const { appInfoLoading, appInfo, loadAppInfo } = useSettings()

onMounted(loadAppInfo)
</script>
