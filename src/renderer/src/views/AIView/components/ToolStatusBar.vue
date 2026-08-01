<template>
  <div class="ai-tool-status">
    <span v-if="!toolDone" class="ai-tool-spinner"></span>
    <span v-else class="ai-tool-done">&#10003;</span>
    <span class="ai-tool-label">{{ TOOL_LABELS[toolName] || toolName }}</span>
    <span class="ai-tool-phase">{{ toolDone ? '完成' : '中...' }}</span>
  </div>
</template>

<script setup lang="ts">
import { TOOL_LABELS } from '../types'

defineProps<{
  toolName: string
  toolDone: boolean
}>()
</script>

<style lang="scss" scoped>
.ai-tool-status {
  display: flex; align-items: center; gap: 6px;
  width: 100%; max-width: 720px; padding: 0 32px; box-sizing: border-box;
  font-size: $font-sm; color: $color-text-secondary;
}

.ai-tool-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid #E5E7EB; border-top-color: $color-primary; border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
}

@keyframes ai-spin { to { transform: rotate(360deg); } }

.ai-tool-done { color: $color-success; font-size: $font-md; }

.ai-tool-label { color: $color-text-heading; }

.ai-tool-phase { color: $color-text-muted; }
</style>
