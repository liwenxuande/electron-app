<template>
  <div class="settings-panel" v-loading="appInfoLoading">
    <div class="settings-panel-head">
      <h2>数据</h2>
      <p>本地数据库与配置文件位置</p>
    </div>

    <div class="settings-card" v-if="appInfo">
      <div class="settings-info-list">
        <div class="settings-info-row">
          <span class="settings-info-label">数据库</span>
          <span class="settings-info-value">{{ appInfo.dbPath }}</span>
        </div>
        <div class="settings-info-row">
          <span class="settings-info-label">配置文件</span>
          <span class="settings-info-value">{{ appInfo.configPath }}</span>
        </div>
      </div>
      <div class="settings-actions">
        <span class="settings-hint">数据仅保存在本机。</span>
        <el-button type="primary" plain @click="openDataDir">打开数据目录</el-button>
      </div>
    </div>
    <div class="settings-empty" v-else>加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'

const { appInfoLoading, appInfo, loadAppInfo, openDataDir } = useSettings()

onMounted(loadAppInfo)
</script>
