<template>
  <div class="title-bar" @dblclick="handleMaximize">
    <!-- 左侧：Logo + 标题 -->
    <div class="title-bar__left">
      <div class="title-bar__logo">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <span class="title-bar__name">人员管理系统</span>
    </div>

    <!-- 右侧：窗口控制按钮 -->
    <div class="title-bar__controls">
      <button class="title-bar__btn" title="最小化" @click="handleMinimize">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <rect x="1" y="5.5" width="10" height="1" fill="currentColor"/>
        </svg>
      </button>
      <button class="title-bar__btn" :title="isMaximized ? '还原' : '最大化'" @click="handleMaximize">
        <svg v-if="isMaximized" viewBox="0 0 12 12" width="12" height="12">
          <rect x="2.5" y="0.5" width="7" height="7" rx="0.5" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="0.5" y="3.5" width="7" height="7" rx="0.5" fill="currentColor" stroke="currentColor" stroke-width="0.5"/>
        </svg>
        <svg v-else viewBox="0 0 12 12" width="12" height="12">
          <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
      <button class="title-bar__btn title-bar__btn--close" title="关闭" @click="handleClose">
        <svg viewBox="0 0 12 12" width="12" height="12">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isMaximized = ref(false)

async function handleMinimize() {
  await window.userAPI.minimize()
}

async function handleMaximize() {
  await window.userAPI.maximize()
}

async function handleClose() {
  await window.userAPI.close()
}

onMounted(async () => {
  isMaximized.value = await window.userAPI.isMaximized()
  window.userAPI.onMaximizeChange((state: boolean) => {
    isMaximized.value = state
  })
})
</script>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  background: linear-gradient(135deg, #1a73e8, #0d5bbd);
  padding: 0 15px;
  user-select: none;
  -webkit-app-region: drag;  /* 可拖拽移动窗口 */
  flex-shrink: 0;
}

.title-bar__left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  -webkit-app-region: no-drag;
}

.title-bar__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 4px;
}

.title-bar__name {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.title-bar__controls {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;  /* 按钮区域不可拖拽 */
}

.title-bar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 28px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.85);
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.title-bar__btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.title-bar__btn--close:hover {
  background: #e81123;
  color: #fff;
}
</style>
