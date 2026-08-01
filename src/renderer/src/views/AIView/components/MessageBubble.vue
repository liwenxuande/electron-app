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

<style lang="scss" scoped>
.ai-msg { display: flex; gap: 12px; width: 100%; max-width: 720px; padding: 0 32px; box-sizing: border-box; }
.ai-msg--user { flex-direction: row-reverse; }
.ai-msg--assistant { flex-direction: row; }

.ai-msg-avatar {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.ai-msg--assistant .ai-msg-avatar { background: rgba($color-primary,0.1); color: $color-primary; }
.ai-msg--user .ai-msg-avatar { background: $color-bg-page; color: $color-text-secondary; }

.ai-msg-content {
  padding: 1px 10px; border-radius: $radius-xl; font-size: $font-base; line-height: 1.7;
  color: $color-text-primary; max-width: 85%; min-width: 0;
}
.ai-msg--assistant .ai-msg-content { background: $color-bg-card; border-bottom-left-radius: 4px; }
.ai-msg--user .ai-msg-content { background: $color-primary; border-bottom-right-radius: 4px; }
/* 用户气泡内所有文字强制白色（x-markdown-vue 子元素颜色会覆盖继承） */
.ai-msg--user .ai-msg-content,
.ai-msg--user .ai-msg-content * { color: #fff !important; }

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

.ai-msg-content :deep(strong) { font-weight: $font-semibold; color: $color-primary; }
.ai-msg-content :deep(h4) { font-size: $font-md; font-weight: $font-bold; color: $color-text-primary; margin: 8px 0 4px; padding-bottom: 3px; border-bottom: 1px solid $color-bg-page; }
.ai-msg-content :deep(h5) { font-size: $font-base; font-weight: $font-semibold; color: $color-text-heading; margin: 6px 0 3px; }
.ai-msg-content :deep(p) { margin: 0 0 4px; }
.ai-msg-content :deep(hr) { border: none; border-top: 1px solid #E5E7EB; margin: 8px 0; }
.ai-msg-content :deep(blockquote) { margin: 4px 0; padding: 4px 10px; border-left: 3px solid #FF8C00; background: rgba($color-primary,0.04); border-radius: 0 4px 4px 0; color: $color-text-secondary; font-size: $font-base; }
.ai-msg-content :deep(ul),
.ai-msg-content :deep(ol) { margin: 2px 0; padding-left: 20px; }
.ai-msg-content :deep(ol) { list-style-position: outside; }
.ai-msg-content :deep(li) { margin: 1px 0; }
.ai-msg-content :deep(table) { width: 100%; border-collapse: collapse; font-size: $font-sm; margin: 6px 0; overflow-x: auto; }
.ai-msg-content :deep(th),
.ai-msg-content :deep(td) { padding: 5px 8px; border: 1px solid $color-border; text-align: left; }
.ai-msg--assistant .ai-msg-content :deep(th) { background: rgba($color-primary,0.06) !important; font-weight: $font-semibold; color: $color-text-heading; }
.ai-msg--user .ai-msg-content :deep(th) { background: rgba(255,255,255,0.15) !important; }
.ai-msg--user .ai-msg-content :deep(blockquote) { border-left-color: rgba(255,255,255,0.4) !important; }
.ai-msg--user .ai-msg-content :deep(code) { background: rgba(255,255,255,0.15) !important; }
.ai-msg--user .ai-msg-content :deep(h4) { border-bottom-color: rgba(255,255,255,0.2) !important; }
/* 修复 x-markdown-vue 默认 vertical-align:sub 导致行内代码上飘 */
.ai-msg-content :deep(.x-md-inline-code) { vertical-align: bottom; }
.ai-msg-content :deep(code) { padding: 1px 4px; border-radius: 3px; font-size: $font-sm; background: rgba($color-primary,0.06); color: $color-primary; font-family: monospace; }
</style>
