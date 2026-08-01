<template>
  <div :class="['ai-msg', role === 'user' ? 'ai-msg--user' : 'ai-msg--assistant']">
    <div class="ai-msg-avatar">
      <svg v-if="role === 'user'" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      </svg>
    </div>
    <div class="ai-msg-content" :class="{ 'ai-thinking-msg': thinking }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  role: 'user' | 'assistant'
  /** 思考中占位气泡，仅调整内容区最小高度/垂直居中，不影响头像 */
  thinking?: boolean
}>(), {
  thinking: false,
})
</script>

<style scoped>
.ai-msg { display: flex; gap: 12px; width: 100%; max-width: 720px; padding: 0 32px; box-sizing: border-box; }
.ai-msg--user { flex-direction: row-reverse; }
.ai-msg--assistant { flex-direction: row; }

.ai-msg-avatar {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.ai-msg--assistant .ai-msg-avatar { background: rgba(255,140,0,0.1); color: #FF8C00; }
.ai-msg--user .ai-msg-avatar { background: #F0F2F5; color: #6B7280; }

.ai-msg-content {
  padding: 1px 10px; border-radius: 12px; font-size: 0.8125rem; line-height: 1.7;
  color: #1A1A2E; max-width: 85%; min-width: 0;
}
.ai-msg--assistant .ai-msg-content { background: #F9FAFB; border-bottom-left-radius: 4px; }
.ai-msg--user .ai-msg-content { background: #FF8C00; color: #fff; border-bottom-right-radius: 4px; }
.ai-msg--user .ai-msg-content :deep(strong) { color: #fff; }

.ai-thinking-msg { min-height: 36px; display: flex; align-items: center; }

/* 清除 MarkdownRenderer 根容器背景 */
.ai-msg-content :deep(.x-md-renderer),
.ai-msg-content :deep(.x-markdown-renderer) { padding: 5px 7px 4px 7px !important; background-color: transparent !important; }

/* 代码块间距 */
.ai-msg-content :deep(.x-md-code-block),
.ai-msg-content :deep(.x-md-syntax-code-block) { margin: 6px 0; }
/* 代码块内 pre 标签间空白文本节点被 white-space:pre 渲染成空行，font-size:0 消除 */
.ai-msg-content :deep(.x-md-code-body pre),
.ai-msg-content :deep(.x-md-syntax-code-block pre) { font-size: 0; }
.ai-msg-content :deep(.x-md-code-body pre > *),
.ai-msg-content :deep(.x-md-syntax-code-block pre > *) { font-size: 14px; }

/* TODO: x-markdown-vue 0.0.201 版本 Mermaid 切到代码视图时源码内容为空（只有 &nbsp;），
   暂时隐藏 View/Code 切换按钮。升级 x-markdown-vue 后如果修复了可以去掉这行 */
.ai-msg-content :deep(.markdown-mermaid .segmented-control) { display: none !important; }

.ai-msg-content :deep(strong) { font-weight: 600; color: #FF8C00; }
.ai-msg-content :deep(h4) { font-size: 0.875rem; font-weight: 700; color: #1A1A2E; margin: 8px 0 4px; padding-bottom: 3px; border-bottom: 1px solid #F0F2F5; }
.ai-msg-content :deep(h5) { font-size: 0.8125rem; font-weight: 600; color: #374151; margin: 6px 0 3px; }
.ai-msg-content :deep(p) { margin: 0 0 4px; }
.ai-msg-content :deep(hr) { border: none; border-top: 1px solid #E5E7EB; margin: 8px 0; }
.ai-msg-content :deep(blockquote) { margin: 4px 0; padding: 4px 10px; border-left: 3px solid #FF8C00; background: rgba(255,140,0,0.04); border-radius: 0 4px 4px 0; color: #6B7280; font-size: 0.8125rem; }
.ai-msg-content :deep(ul),
.ai-msg-content :deep(ol) { margin: 2px 0; padding-left: 20px; }
.ai-msg-content :deep(ol) { list-style-position: outside; }
.ai-msg-content :deep(li) { margin: 1px 0; }
.ai-msg-content :deep(table) { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin: 6px 0; overflow-x: auto; }
.ai-msg-content :deep(th),
.ai-msg-content :deep(td) { padding: 5px 8px; border: 1px solid #E5E7EB; text-align: left; }
.ai-msg--assistant .ai-msg-content :deep(th) { background: rgba(255,140,0,0.06) !important; font-weight: 600; color: #374151; }
.ai-msg--user .ai-msg-content :deep(th) { background: rgba(255,255,255,0.15) !important; color: #fff; }
/* 修复 x-markdown-vue 默认 vertical-align:sub 导致行内代码上飘 */
.ai-msg-content :deep(.x-md-inline-code) { vertical-align: bottom; }
.ai-msg-content :deep(code) { padding: 1px 4px; border-radius: 3px; font-size: 0.75rem; background: rgba(255,140,0,0.06); color: #FF8C00; font-family: monospace; }
.ai-msg--user .ai-msg-content :deep(blockquote) { border-left-color: rgba(255,255,255,0.4); }
.ai-msg--user .ai-msg-content :deep(a) { color: rgba(255,255,255,0.85); }
.ai-msg--user .ai-msg-content :deep(code) { background: rgba(255,255,255,0.15); color: #fff; }
</style>
