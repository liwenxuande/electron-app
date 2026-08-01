<template>
  <div class="ledger-page">
    <div class="ledger-header">
      <div class="ledger-header-left">
        <h1 class="ledger-title">账本管理</h1>
        <p class="ledger-subtitle">管理你的所有账本，切换默认账本</p>
      </div>
      <div class="ledger-header-actions">
        <BookSwitcher />
        <button class="ledger-create-btn" @click="openCreate">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新建账本
        </button>
      </div>
    </div>

    <div class="ledger-body">
      <div class="ledger-content">

        <LedgerDefaultCard
          :ledger="defaultLedger"
          :stats="defaultStats"
          @edit="openEdit(defaultLedger!)"
        />

        <div class="ledger-section-header" v-if="otherLedgers.length > 0">
          <h3 class="ledger-section-title">其它账本</h3>
          <span class="ledger-section-count">共 {{ otherLedgers.length }} 个账本</span>
        </div>

        <div class="ledger-grid">
          <TransitionGroup name="ledger-card">
            <LedgerCard
              v-for="lb in otherLedgers"
              :key="lb.id"
              :ledger="lb"
              :stats="getBookStats(lb.id)"
              :icon-bg="getIconBg(lb.id)"
              :icon-color="getIconColor(lb.id)"
              @select="handleSelectLedger(lb)"
              @menu="handleMenuClick(lb, $event)"
            />
          </TransitionGroup>

          <div class="ledger-card ledger-card--create" @click="openCreate">
            <div class="ledger-create-icon">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <span class="ledger-create-label">创建新账本</span>
            <span class="ledger-create-hint">旅行、投资、家庭...</span>
          </div>
        </div>
      </div>
    </div>

    <LedgerFormDialog
      :visible="dialogVisible"
      :mode="dialogMode"
      v-model:form-data="formData"
      :submitting="submitting"
      @submit="handleSubmit"
      @close="closeDialog"
    />

    <LedgerContextMenu
      :visible="menuVisible"
      :position="menuStyle"
      @close="menuVisible = false"
      @edit="menuEdit"
      @delete="menuDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLedgerStore } from '@/stores/ledgerStore'
import BookSwitcher from '@/components/BookSwitcher.vue'
import { useBookStats } from './composables/useBookStats'
import { useLedgerForm } from './composables/useLedgerForm'
import LedgerDefaultCard from './components/LedgerDefaultCard.vue'
import LedgerCard from './components/LedgerCard.vue'
import LedgerFormDialog from './components/LedgerFormDialog.vue'
import LedgerContextMenu from './components/LedgerContextMenu.vue'
import { makeIconColors } from '@/const'

const ICON_COLORS = makeIconColors(
  ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'],
  0.1
)

const ledgerStore = useLedgerStore()
const { fetchBookStats, getBookStats } = useBookStats()
const { dialogVisible, dialogMode, submitting, formData, openCreate, openEdit, handleSubmit } =
  useLedgerForm(async () => { await fetchLedgers() })

const defaultLedger = computed(() => ledgerStore.list.find(l => l.id === 1) || null)
const otherLedgers = computed(() => ledgerStore.list.filter(l => l.id !== 1))
const defaultStats = computed(() => getBookStats(1))

function getIconBg(id: number) { return ICON_COLORS[id % ICON_COLORS.length].bg }
function getIconColor(id: number) { return ICON_COLORS[id % ICON_COLORS.length].color }

function closeDialog() {
  dialogVisible.value = false
  formData.value = { name: '', description: '' }
}

// ---- Context menu ----
const menuVisible = ref(false)
const menuTarget = ref<Record<string, unknown> | null>(null)
const menuStyle = ref({ top: '0px', left: '0px' })

function handleMenuClick(lb: Record<string, unknown>, event: MouseEvent) {
  menuTarget.value = lb
  const el = event.currentTarget as HTMLElement
  if (el) {
    const rect = el.getBoundingClientRect()
    menuStyle.value = { top: `${rect.bottom + 4}px`, left: `${rect.left - 80}px` }
  }
  menuVisible.value = true
}

function menuEdit() {
  menuVisible.value = false
  if (menuTarget.value) openEdit(menuTarget.value)
}

async function menuDelete() {
  menuVisible.value = false
  if (!menuTarget.value) return
  const lb = menuTarget.value
  if (lb.id === 1) { ElMessage.warning('默认账本不可删除'); return }
  try {
    await ElMessageBox.confirm(`确定要删除账本「${lb.name}」吗？`, '确认删除', {
      type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消'
    })
  } catch { return }

  const res = await window.ledgerAPI.deleteLedger(lb.id)
  if (res.code === 0) {
    ElMessage.success('删除成功')
    await fetchLedgers()
  } else {
    ElMessage.error(res.msg)
  }
}

function handleSelectLedger(lb: { id: number; name: string }) {
  ledgerStore.setCurrentId(lb.id)
  ElMessage.success(`已切换到「${lb.name}」`)
}

async function fetchLedgers() {
  await ledgerStore.fetchList()
  ledgerStore.list.forEach(lb => { fetchBookStats(lb.id) })
}

onMounted(() => { fetchLedgers() })
</script>

<style lang="scss" scoped>
.ledger-page {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}
.ledger-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 16px 40px; flex-shrink: 0;
}
.ledger-header-left { min-width: 0; }
.ledger-header-actions {
  display: flex; align-items: center; gap: 12px; flex-shrink: 0;
}
.ledger-title {
  font-size: $font-4xl; font-weight: $font-bold; color: $color-text-primary;
  letter-spacing: -0.02em; line-height: 1.3; margin-bottom: 4px;
}
.ledger-subtitle { font-size: $font-base; color: $color-text-secondary; }

.ledger-body { flex: 1; overflow-y: auto; padding: 0 40px 32px; }
.ledger-content { position: relative; z-index: 1; }

.ledger-create-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 20px; background: $color-primary; color: #fff;
  border: none; border-radius: $radius-lg; font-size: $font-base;
  font-weight: $font-semibold; font-family: inherit; cursor: pointer;
  transition: $transition-slow; box-shadow: 0 2px 8px rgba(255, 140, 0, 0.3);
  white-space: nowrap;
}
.ledger-create-btn:hover {
  background: $color-primary-hover; box-shadow: 0 4px 12px rgba(255, 140, 0, 0.4);
}

.ledger-section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.ledger-section-title { font-size: $font-xl; font-weight: $font-semibold; color: $color-text-primary; }
.ledger-section-count { font-size: $font-sm; color: $color-text-muted; }

.ledger-grid {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 16px; margin-bottom: 28px;
}

.ledger-card--create {
  background: rgba($color-bg-white, 0.85); backdrop-filter: blur(8px);
  border: 2px dashed rgba($color-border-light,0.7); border-radius: $radius-xl;
  padding: 32px 24px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  min-height: 180px; cursor: pointer; transition: $transition-slow;
}
.ledger-card--create:hover {
  border-color: $color-primary-border; background: $color-primary-light; transform: translateY(-2px);
}

.ledger-create-icon {
  width: 44px; height: 44px; border-radius: $radius-lg;
  background: $color-bg-hover; border: 1px dashed #EBEEF2;
  display: flex; align-items: center; justify-content: center;
  transition: $transition-slow;
}
.ledger-card--create:hover .ledger-create-icon {
  background: $color-primary; border-color: $color-primary;
}
.ledger-card--create:hover .ledger-create-icon svg { stroke: #fff; }

.ledger-create-label { font-size: $font-base; font-weight: $font-medium; color: $color-text-secondary; }
.ledger-create-hint { font-size: $font-sm; color: $color-text-muted; }

/* TransitionGroup */
.ledger-card-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.ledger-card-leave-active { transition: all 0.25s ease-in; }
.ledger-card-enter-from {
  opacity: 0; transform: translateY(12px) scale(0.96);
}
.ledger-card-leave-to {
  opacity: 0; transform: scale(0.92);
}
.ledger-card-move { transition: transform 0.3s ease; }
</style>
