<template>
  <div class="settings-panel" v-loading="appInfoLoading">
    <div class="settings-panel-head">
      <h2>通用</h2>
      <p>应用基础信息</p>
    </div>

    <div class="settings-card" v-if="appInfo">
      <div class="settings-card-title">
        <span>数据存储目录</span>
      </div>
      <div class="settings-row">
        <el-input :model-value="appInfo.dataDir" readonly />
        <el-button @click="copyText(appInfo.dataDir)">复制</el-button>
      </div>
      <p class="settings-hint">应用数据、数据库与配置文件的存放位置。</p>
    </div>
    <div class="settings-empty" v-else>加载中...</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettings } from '../composables/useSettings'

const { appInfoLoading, appInfo, loadAppInfo, copyText } = useSettings()

onMounted(loadAppInfo)
</script>
