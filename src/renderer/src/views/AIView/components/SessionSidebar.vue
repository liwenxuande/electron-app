<template>
  <aside class="ai-sidebar">
    <div class="ai-sidebar-top">
      <button class="ai-new-btn" @click="emit('new')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>新对话</span>
      </button>
    </div>
    <div class="ai-session-list">
      <div
        v-for="s in sessions"
        :key="s.sessionId"
        :class="['ai-session-item', { active: currentSessionId === s.sessionId }]"
        @click="emit('switch', s.sessionId)"
      >
        <div class="ai-session-title">{{ s.title }}</div>
        <div class="ai-session-meta">
          <span class="ai-session-time">{{ formatTime(s.updatedAt) }}</span>
        </div>
        <button class="ai-session-del" title="删除" @click.stop="emit('delete', s.sessionId)">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
      <div v-if="sessions.length === 0" class="ai-no-sessions">暂无对话记录</div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { SessionItem } from '@/stores/aiSessionStore'

defineProps<{
  sessions: SessionItem[]
  currentSessionId: string | null
  formatTime: (ts: number) => string
}>()

const emit = defineEmits<{
  new: []
  switch: [sessionId: string]
  delete: [sessionId: string]
}>()
</script>

<style lang="scss" scoped>
.ai-sidebar {
  width: 240px; flex-shrink: 0; display: flex; flex-direction: column;
  background: #F3F4F6; border-right: 1px solid #E5E7EB;
}
.ai-sidebar-top { padding: 14px; }
.ai-new-btn {
  width: 100%; padding: 9px 0; border-radius: $radius-lg; border: 1px dashed #D1D5DB;
  background: transparent; color: $color-text-secondary; font-size: $font-base; font-weight: $font-medium;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;
  font-family: inherit; transition: $transition-base;
}
.ai-new-btn:hover { background: #E5E7EB; color: $color-text-heading; border-color: $color-text-muted; }

.ai-session-list { flex: 1; overflow-y: auto; padding: 0 10px 10px; }
.ai-session-item {
  padding: 10px 12px; border-radius: $radius-lg; cursor: pointer; transition: $transition-fast;
  position: relative; margin-bottom: 2px;
}
.ai-session-item:hover { background: #E5E7EB; }
.ai-session-item.active { background: $color-bg-white; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }

.ai-session-title {
  font-size: $font-base; font-weight: $font-medium; color: $color-text-heading;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 20px;
}
.ai-session-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.ai-session-time { font-size: $font-xs; color: $color-text-muted; }

.ai-session-del {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border: none; background: transparent; cursor: pointer;
  color: $color-border-hover; border-radius: $radius-sm; display: flex; align-items: center; justify-content: center;
  opacity: 0; transition: $transition-base;
}
.ai-session-item:hover .ai-session-del { opacity: 1; }
.ai-session-del:hover { color: $color-danger; background: rgba($color-danger,0.08); }
.ai-no-sessions { text-align: center; padding: 20px; font-size: $font-sm; color: $color-text-muted; }
</style>
