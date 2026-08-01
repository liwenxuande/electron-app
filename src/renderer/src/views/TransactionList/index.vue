<template>
  <div class="txn-page">
    <div class="txn-header">
      <div class="txn-header-left">
        <h1 class="txn-title">账单明细</h1>
        <BookSwitcher />
      </div>
      <div class="txn-header-actions">
        <button class="txn-outline-btn" @click="handleImportCsv">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          导入 CSV
        </button>
        <button class="txn-outline-btn" @click="handleManageCategories">分类管理</button>
        <button class="txn-primary-btn" @click="handleCreate">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          记一笔
        </button>
      </div>
    </div>

    <div class="txn-body">
      <!-- Summary Bar -->
      <div class="txn-summary-bar">
        <div class="txn-summary-item">
          <span class="txn-summary-label">支出</span>
          <span class="txn-summary-value">¥{{ formatAmount(Math.abs(transactionStore.monthlyStats.totalExpense)) }}</span>
        </div>
        <div class="txn-summary-item">
          <span class="txn-summary-label">收入</span>
          <span class="txn-summary-value income">¥{{ formatAmount(Math.abs(transactionStore.monthlyStats.totalIncome)) }}</span>
        </div>
        <div class="txn-summary-item">
          <span class="txn-summary-label">笔数</span>
          <span class="txn-summary-value">{{ transactionStore.total }}</span>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="txn-filter-bar">
        <div class="txn-filter-top-row">
          <el-date-picker
            v-model="transactionStore.filter.startDate"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            class="txn-date-input"
            size="small"
            @change="onDateChange"
          />
          <div class="txn-type-toggle">
            <button class="txn-type-btn" :class="{ active: !transactionStore.filter.type }" @click="setTypeFilter(undefined)">全部</button>
            <button class="txn-type-btn" :class="{ active: transactionStore.filter.type === 'expense' }" @click="setTypeFilter('expense')">支出</button>
            <button class="txn-type-btn" :class="{ active: transactionStore.filter.type === 'income' }" @click="setTypeFilter('income')">收入</button>
          </div>
          <div class="txn-search-box">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input v-model="transactionStore.filter.keyword" type="text" placeholder="搜索描述..." @keyup.enter="handleSearch" @input="onKeywordInput" />
          </div>
        </div>
        <div class="txn-filter-cat-row" @wheel.prevent="onCatScroll">
          <span class="txn-pill" :class="{ active: !transactionStore.filter.categoryId }" @click="setCategoryFilter(undefined)">全部</span>
          <span
            v-for="cat in filteredCategories"
            :key="cat.id"
            class="txn-pill"
            :class="{ active: transactionStore.filter.categoryId === cat.id }"
            :style="transactionStore.filter.categoryId === cat.id ? { borderColor: cat._color, background: cat._bg, color: cat._color } : { borderColor: cat._color + '66', color: cat._color }"
            @click="setCategoryFilter(cat.id)"
          >
            <span class="txn-pill-dot" :style="{ background: cat._color }"></span>
            {{ cat.name }}
          </span>
        </div>
      </div>

      <TransactionTable
        :list="transactionStore.list"
        :loading="transactionStore.loading"
        :total="transactionStore.total"
        :current-page="transactionStore.currentPage"
        :total-pages="totalPages"
        :page-numbers="pageNumbers"
        :get-cat-color="getCatColor"
        :get-cat-bg="getCatBg"
        @edit="handleEdit"
        @delete="handleDelete"
        @go-page="goPage"
      />
    </div>

    <TransactionDialog v-model:visible="dialogVisible" :mode="dialogMode" :editData="currentEditData" @success="handleDialogSuccess" />
    <CsvImportDialog v-model:visible="csvImportVisible" @success="handleCsvImportSuccess" />
    <CategoryManagerDialog v-model:visible="categoryDialogVisible" @close="fetchCategoryData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useTransactionStore } from '@/stores/transactionStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useLedgerStore } from '@/stores/ledgerStore'
import TransactionDialog from '@/components/TransactionDialog.vue'
import CsvImportDialog from '@/components/CsvImportDialog.vue'
import CategoryManagerDialog from '@/components/CategoryManagerDialog.vue'
import BookSwitcher from '@/components/BookSwitcher.vue'
import { formatAmount } from '@/utils/format'
import { useCategoryColors } from './composables/useCategoryColors'
import { useTransactionPaginator } from './composables/useTransactionPaginator'
import TransactionTable from './components/TransactionTable.vue'

// ---- Composables ----
const { getCatColor, getCatBg, cache: catColorCache } = useCategoryColors()
const { totalPages, pageNumbers, goPage } = useTransactionPaginator()

// ---- Stores ----
const transactionStore = useTransactionStore()
const categoryStore = useCategoryStore()
const ledgerStore = useLedgerStore()

// ---- Local state ----
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const currentEditData = ref<Record<string, unknown> | null>(null)
const csvImportVisible = ref(false)
const categoryDialogVisible = ref(false)

let keywordTimer: ReturnType<typeof setTimeout> | null = null

// ---- Computed ----
/** 按类型过滤的分类列表（为每个分类预分配颜色） */
const filteredCategories = computed(() => {
  const all = [...categoryStore.expenseCategories, ...categoryStore.incomeCategories]
  let list = all
  if (transactionStore.filter.type === 'expense') list = all.filter(c => c.type === 'expense')
  else if (transactionStore.filter.type === 'income') list = all.filter(c => c.type === 'income')

  return list.map(cat => ({
    ...cat,
    _color: getCatColor(cat.name || ''),
    _bg: getCatBg(cat.name || ''),
  }))
})

// ---- Event handlers ----
function onCatScroll(e: WheelEvent) {
  const el = e.currentTarget as HTMLElement
  el.scrollLeft += e.deltaY
}

function setCategoryFilter(id: number | undefined) {
  transactionStore.filter.categoryId = id
  handleSearch()
}

function setTypeFilter(type: string | undefined) {
  transactionStore.filter.type = type
  nextTick(() => {
    if (transactionStore.filter.categoryId !== undefined) {
      const exists = filteredCategories.value.some(c => c.id === transactionStore.filter.categoryId)
      if (!exists) transactionStore.filter.categoryId = undefined
    }
    handleSearch()
  })
}

function onDateChange() {
  transactionStore.filter.endDate = transactionStore.filter.startDate
  handleSearch()
}

function onKeywordInput() {
  if (keywordTimer) clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => handleSearch(), 300)
}

function handleSearch() { void transactionStore.search() }
function handleCreate() { dialogMode.value = 'create'; currentEditData.value = null; dialogVisible.value = true }
function handleEdit(row: Record<string, unknown>) { dialogMode.value = 'edit'; currentEditData.value = { ...row }; dialogVisible.value = true }
function handleDelete(row: { id: number; amount: number }) {
  ElMessageBox.confirm(`确定要删除该记录吗？金额: ¥${row.amount.toFixed(2)}`, '删除确认', {
    confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning'
  }).then(() => transactionStore.deleteTransaction(row.id)).catch(() => {})
}
function handleDialogSuccess() { dialogVisible.value = false }
function handleImportCsv() { csvImportVisible.value = true }
function handleCsvImportSuccess() { csvImportVisible.value = false }
function handleManageCategories() { categoryDialogVisible.value = true }
async function fetchCategoryData() { await categoryStore.fetchAllCategories() }

// ---- Lifecycle ----
onMounted(() => {
  fetchCategoryData()
  ledgerStore.fetchList().then(() => transactionStore.setLedgerId(ledgerStore.currentId))
  transactionStore.fetchMonthlyStats()
})
watch(() => ledgerStore.currentId, (newId) => transactionStore.setLedgerId(newId))

defineExpose({
  openCreateDialog() { dialogMode.value = 'create'; currentEditData.value = null; dialogVisible.value = true },
  openCsvImport() { csvImportVisible.value = true }
})
</script>

<style scoped>
.txn-page { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.txn-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 40px; flex-shrink: 0; }
.txn-header-left { display: flex; align-items: center; gap: 24px; }
.txn-title { font-size: 2rem; font-weight: 700; color: #1A1A2E; letter-spacing: -0.02em; line-height: 1.3; white-space: nowrap; }
.txn-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.txn-body { flex: 1; display: flex; flex-direction: column; padding: 0 40px 20px; gap: 14px; min-height: 0; }

.txn-outline-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7); border-radius: 8px;
  font-size: 0.8125rem; font-weight: 500; color: #6B7280;
  cursor: pointer; transition: all 0.15s; font-family: inherit; white-space: nowrap;
}
.txn-outline-btn:hover { border-color: #FFAD42; color: #FF8C00; }

.txn-primary-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px;
  background: #FF8C00; color: #fff; border: none; border-radius: 8px;
  font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
  font-family: inherit; box-shadow: 0 2px 8px rgba(255,140,0,0.25); white-space: nowrap;
}
.txn-primary-btn:hover { background: #E07800; box-shadow: 0 4px 12px rgba(255,140,0,0.35); }

.txn-summary-bar {
  display: flex; gap: 28px;
  background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7); border-radius: 12px;
  padding: 14px 24px; flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.txn-summary-item { display: flex; flex-direction: column; gap: 3px; }
.txn-summary-label { font-size: 0.6875rem; color: #9CA3AF; font-weight: 500; }
.txn-summary-value { font-size: 1rem; font-weight: 700; color: #1A1A2E; }
.txn-summary-value.income { color: #10B981; }

.txn-filter-bar {
  background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7); border-radius: 12px;
  padding: 10px 16px; flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.txn-filter-top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.txn-filter-top-row:last-child { margin-bottom: 0; }

.txn-date-input { width: 140px; }

.txn-type-toggle {
  display: inline-flex; border: 1px solid rgba(235,238,242,0.7);
  border-radius: 6px; overflow: hidden; background: transparent;
}
.txn-type-btn {
  padding: 4px 12px; font-size: 0.75rem; font-weight: 500; border: none;
  background: transparent; color: #6B7280; cursor: pointer;
  font-family: inherit; transition: all 0.15s;
}
.txn-type-btn.active { background: #FF8C00; color: #fff; }

.txn-search-box {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 12px; border: 1px solid rgba(235,238,242,0.7);
  border-radius: 6px; width: 180px; margin-left: auto;
}
.txn-search-box input {
  border: none; outline: none; background: transparent;
  font-size: 0.8125rem; color: #1A1A2E; font-family: inherit; flex: 1; min-width: 0;
}
.txn-search-box input::placeholder { color: #9CA3AF; }

.txn-filter-cat-row {
  display: flex; gap: 6px; overflow-x: auto;
  padding-bottom: 2px; cursor: grab;
}
.txn-filter-cat-row::-webkit-scrollbar { height: 0; }

.txn-pill {
  padding: 4px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: 500;
  border: 1px solid rgba(235,238,242,0.7); background: transparent; color: #9CA3AF;
  cursor: pointer; transition: all 0.15s; display: inline-flex;
  align-items: center; gap: 5px; flex-shrink: 0; white-space: nowrap;
}
.txn-pill:hover { border-color: #FFAD42; color: #FF8C00; }
.txn-pill.active { border-color: #FF8C00; background: #FFF5E6; color: #FF8C00; }
.txn-pill-dot { width: 6px; height: 6px; border-radius: 50%; }

</style>
