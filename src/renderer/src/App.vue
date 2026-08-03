<template>
  <el-config-provider :locale="zhCn">
    <div id="app-root">
      <div class="app-body">
        <aside class="app-sidebar">
          <div class="sidebar-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>

          <nav class="sidebar-nav">
            <div
              v-for="nav in navItems"
              :key="nav.key"
              class="sidebar-nav-item"
              :class="{ active: activeNav === nav.key }"
              :title="nav.label"
              @click="activeNav = nav.key"
            >
              <span class="sidebar-nav-icon" v-html="nav.icon"></span>
            </div>
          </nav>

          <div class="sidebar-bottom">
            <div class="sidebar-nav-item" title="设置" @click="openSettings()">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </div>
          </div>
        </aside>

        <div class="app-main">
          <TitleBar />
          <div class="app-content">
            <DashboardView v-if="activeNav === 'dashboard'" @add-record="onAddRecord" @import-csv="onImportCsv" @go-transactions="activeNav = 'transactions'" @go-to="activeNav = $event" />
            <TransactionList ref="transactionListRef" v-if="activeNav === 'transactions'" />
            <StatisticsView v-if="activeNav === 'statistics'" />
            <LedgerManager v-if="activeNav === 'ledger'" />
            <AIView v-if="activeNav === 'ai'" />
          </div>
        </div>
      </div>

      <AISettingsDialog
        v-model:visible="settingsVisible"
        :config="aiConfig"
        @save="saveAIConfig"
      />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useLedgerStore } from './stores/ledgerStore'
import { useAI } from './composables/useAI'
import TitleBar from './components/TitleBar.vue'
import AISettingsDialog from './components/AISettingsDialog.vue'

const viewLoaders = {
  DashboardView: () => import('./views/DashboardView/index.vue'),
  TransactionList: () => import('./views/TransactionList/index.vue'),
  StatisticsView: () => import('./views/StatisticsView/index.vue'),
  LedgerManager: () => import('./views/LedgerManager/index.vue'),
  AIView: () => import('./views/AIView/index.vue')
}

const DashboardView = defineAsyncComponent(viewLoaders.DashboardView)
const TransactionList = defineAsyncComponent(viewLoaders.TransactionList)
const StatisticsView = defineAsyncComponent(viewLoaders.StatisticsView)
const LedgerManager = defineAsyncComponent(viewLoaders.LedgerManager)
const AIView = defineAsyncComponent(viewLoaders.AIView)

const activeNav = ref('dashboard')
const transactionListRef = ref<InstanceType<typeof TransactionList> | null>(null)
const ledgerStore = useLedgerStore()
const { settingsVisible, config: aiConfig, openSettings, saveConfig: saveAIConfig } = useAI()

const navItems = [
  {
    key: 'dashboard',
    label: '仪表盘',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'
  },
  {
    key: 'transactions',
    label: '账单明细',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
  },
  {
    key: 'statistics',
    label: '统计分析',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
  },
  {
    key: 'ledger',
    label: '账本管理',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="13" y2="11"/></svg>'
  },
  {
    key: 'ai',
    label: 'AI 助手',
    icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
  }
]


function onAddRecord() {
  activeNav.value = 'transactions'
  setTimeout(() => {
    transactionListRef.value?.openCreateDialog()
  }, 100)
}

function onImportCsv() {
  activeNav.value = 'transactions'
  setTimeout(() => {
    transactionListRef.value?.openCsvImport()
  }, 100)
}

onMounted(() => {
  ledgerStore.fetchList()
  // 首屏（仪表盘）就绪后，后台预加载其余页面组件，避免用户切换页面时出现加载空隙
  const idle = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => setTimeout(cb, 200) as unknown as number)
  idle(() => {
    viewLoaders.TransactionList()
    viewLoaders.StatisticsView()
    viewLoaders.LedgerManager()
    viewLoaders.AIView()
  })
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      window.electronAPI.toggleDevTools()
    }
  })
})
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: transparent;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

#app-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #FFF8F0;
  background-image: url('/app-background.jpg');
  background-size: cover;
  background-position: center;
  background-blend-mode: soft-light;
}

.app-body {
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

.app-sidebar {
  width: 88px;
  background: $color-bg-white;
  border-right: 1px solid $color-border-light;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  padding: 20px 0;
  z-index: 100;
}

.sidebar-logo {
  width: 40px;
  height: 40px;
  background: $color-primary;
  border-radius: $radius-xl;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
  box-shadow: 0 2px 8px rgba(255, 140, 0, 0.25);
  cursor: pointer;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  padding: 0 14px;
}

.sidebar-nav-item {
  width: 60px;
  height: 44px;
  border-radius: $radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-text-muted;
  transition: $transition-base;
  cursor: pointer;
  margin: 0 auto;
}

.sidebar-nav-item:hover {
  background: $color-bg-hover;
  color: $color-text-secondary;
}

.sidebar-nav-item.active {
  background: $color-primary-light;
  color: $color-primary;
}

.sidebar-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-bottom {
  margin-top: auto;
  width: 100%;
  padding: 0 14px;
  display: flex;
  justify-content: center;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

::-webkit-scrollbar {
  width: 0;
  height: 0;
}

* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
</style>
