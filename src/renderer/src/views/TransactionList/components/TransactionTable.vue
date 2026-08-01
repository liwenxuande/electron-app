<template>
  <div class="txn-table-card">
    <el-table
      :data="list"
      v-loading="loading"
      style="width: 100%"
      class="txn-table"
      empty-text="暂无数据"
      row-key="id"
    >
      <el-table-column prop="trans_date" label="日期" width="100" sortable>
        <template #default="{ row }">
          <span class="txn-cell-date">{{ formatDate(row.trans_date) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="分类" width="140">
        <template #default="{ row }">
          <span class="txn-cat-tag" :style="{ background: getCatBg(row.category_name), color: getCatColor(row.category_name) }">
            <span class="txn-cat-dot" :style="{ background: getCatColor(row.category_name) }"></span>
            {{ row.category_name }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="描述" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.description || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="金额" width="130" align="right">
        <template #default="{ row }">
          <span :class="row.type === 'income' ? 'txn-amount-income' : 'txn-amount-expense'">
            {{ row.type === 'income' ? '+' : '-' }}¥{{ Math.abs(row.amount).toFixed(2) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" align="center" fixed="right">
        <template #default="{ row }">
          <div class="txn-action-btns">
            <button class="txn-action-btn txn-action-edit" @click="$emit('edit', row)" title="编辑">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="txn-action-btn txn-action-delete" @click="$emit('delete', row)" title="删除">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="txn-pagination" v-if="total > 0">
      <span class="txn-pagination-info">共 {{ total }} 条记录，第 {{ currentPage }}/{{ totalPages }} 页</span>
      <div class="txn-pagination-btns">
        <button class="txn-page-btn" :disabled="currentPage <= 1" @click="$emit('goPage', currentPage - 1)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button v-for="p in pageNumbers" :key="p" class="txn-page-btn" :class="{ active: p === currentPage }" @click="$emit('goPage', p)">{{ p }}</button>
        <button class="txn-page-btn" :disabled="currentPage >= totalPages" @click="$emit('goPage', currentPage + 1)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '@/utils/format'

defineProps<{
  list: Record<string, unknown>[]
  loading: boolean
  total: number
  currentPage: number
  totalPages: number
  pageNumbers: number[]
  getCatColor: (name: string) => string
  getCatBg: (name: string) => string
}>()

defineEmits<{
  edit: [row: Record<string, unknown>]
  delete: [row: Record<string, unknown>]
  goPage: [page: number]
}>()
</script>

<style lang="scss" scoped>
.txn-table-card {
  background: rgba($color-bg-white, 0.85); backdrop-filter: blur(8px);
  border: 1px solid rgba($color-border-light,0.7); border-radius: $radius-xl;
  box-shadow: $shadow-sm; overflow: hidden;
  flex: 1; display: flex; flex-direction: column; min-height: 0;
}

.txn-table {
  --el-table-border-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-header-text-color: $color-text-muted;
  --el-table-text-color: $color-text-primary;
  --el-table-row-hover-bg-color: rgba(0,0,0,0.015);
  --el-table-current-row-bg-color: transparent;
  background: transparent;
  flex: 1;
}

.txn-table :deep(.el-table__header th) {
  padding: 12px 0 !important;
  font-size: $font-xs;
  font-weight: $font-semibold;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: $color-text-muted !important;
  background: rgba(255,255,255,0.95) !important;
  border-bottom: 1px solid rgba($color-border-light,0.7) !important;
}

.txn-table :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 2;
}

.txn-table :deep(.el-table__body td) {
  padding: 13px 0 !important;
  border-bottom: 1px solid rgba($color-border-light,0.4) !important;
}

.txn-table :deep(.el-table__body tr:last-child td) {
  border-bottom: none !important;
}

.txn-table :deep(.el-table__empty-block) {
  min-height: 200px;
}

.txn-table :deep(.el-table--border::after),
.txn-table :deep(.el-table--border::before),
.txn-table :deep(.el-table__inner-wrapper::before),
.txn-table :deep(.el-table__border-left-patch) {
  display: none !important;
}

.txn-table :deep(.el-table--border .el-table__cell) {
  border-right: none !important;
}

.txn-table :deep(.el-table__fixed-right),
.txn-table :deep(.el-table__fixed-right-patch) {
  background: transparent;
}

.txn-table :deep(.el-table__fixed-right::before) {
  display: none;
}

.txn-table :deep(.el-table .sort-caret) {
  display: none;
}

.txn-table :deep(.el-table .ascending .sort-caret),
.txn-table :deep(.el-table .descending .sort-caret) {
  display: none;
}

.txn-table :deep(.el-table .cell) {
  font-size: $font-base;
}

.txn-table :deep(.el-table__empty-text) {
  color: $color-text-muted;
}

.txn-cell-date { color: $color-text-secondary; font-size: $font-base; }

.txn-cat-tag {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: $radius-full; font-size: $font-sm; font-weight: $font-medium; white-space: nowrap;
}
.txn-cat-dot { width: 6px; height: 6px; border-radius: 50%; }

.txn-amount-income { color: $color-success; font-weight: $font-semibold; font-variant-numeric: tabular-nums; }
.txn-amount-expense { color: $color-text-primary; font-weight: $font-semibold; font-variant-numeric: tabular-nums; }

.txn-action-btns { display: inline-flex; gap: 2px; justify-content: center; }

.txn-action-btn {
  width: 28px; height: 28px; border-radius: $radius-md; display: inline-flex;
  align-items: center; justify-content: center; border: none; background: transparent;
  cursor: pointer; color: $color-text-muted; transition: $transition-base;
}
.txn-action-edit:hover { color: $color-primary; background: $color-primary-light; }
.txn-action-delete:hover { color: $color-danger; background: #FEF2F2; }

.txn-pagination {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-top: 1px solid rgba($color-border-light,0.7);
  flex-shrink: 0;
}
.txn-pagination-info { font-size: $font-sm; color: $color-text-muted; }
.txn-pagination-btns { display: flex; gap: 4px; }

.txn-page-btn {
  min-width: 30px; height: 30px; border-radius: $radius-md; display: inline-flex;
  align-items: center; justify-content: center;
  border: 1px solid rgba($color-border-light,0.7); background: transparent;
  color: $color-text-secondary; font-size: $font-sm; cursor: pointer;
  transition: $transition-fast; font-family: inherit; padding: 0 6px;
}
.txn-page-btn:hover { border-color: $color-primary-border; color: $color-primary; }
.txn-page-btn.active { background: $color-primary; border-color: $color-primary; color: #fff; }
.txn-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
