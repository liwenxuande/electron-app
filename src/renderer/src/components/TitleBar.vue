<template>
  <div class="title-bar">
    <div class="title-bar__spacer"></div>
    <div class="title-bar__controls">
      <button class="title-bar__btn" title="最小化" @click="handleMinimize">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
      <button class="title-bar__btn title-bar__btn--close" title="关闭" @click="handleClose">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
async function handleMinimize() {
  await window.electronAPI.minimize()
}

async function handleClose() {
  await window.electronAPI.close()
}
</script>

<style lang="scss" scoped>
.title-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 40px;
  background: transparent;
  padding: 0 12px;
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
  position: relative;
  z-index: 50;
}

.title-bar__spacer {
  flex: 1;
}

.title-bar__controls {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.title-bar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: $color-text-muted;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: $transition-base;
}

.title-bar__btn:hover {
  background: $color-bg-hover;
  color: $color-text-secondary;
}

.title-bar__btn--close:hover {
  background: $color-danger;
  color: #fff;
}
</style>
