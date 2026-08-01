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

<style scoped>
.ai-tool-status {
  display: flex; align-items: center; gap: 6px;
  width: 100%; max-width: 720px; padding: 0 32px; box-sizing: border-box;
  font-size: 0.75rem; color: #6B7280;
}

.ai-tool-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid #E5E7EB; border-top-color: #FF8C00; border-radius: 50%;
  animation: ai-spin 0.8s linear infinite;
}

@keyframes ai-spin { to { transform: rotate(360deg); } }

.ai-tool-done { color: #10B981; font-size: 0.875rem; }

.ai-tool-label { color: #374151; }

.ai-tool-phase { color: #9CA3AF; }
</style>
