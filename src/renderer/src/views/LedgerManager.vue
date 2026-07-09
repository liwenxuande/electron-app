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

      <div class="ledger-default-card" v-if="defaultLedger">
        <div class="ledger-default-icon">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#FF8C00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="8" y1="7" x2="16" y2="7"/>
            <line x1="8" y1="11" x2="13" y2="11"/>
          </svg>
        </div>

        <div class="ledger-default-body">
          <div class="ledger-default-name-row">
            <h2 class="ledger-default-name">{{ defaultLedger.name }}</h2>
            <span class="ledger-badge">默认</span>
          </div>
          <p class="ledger-default-desc">{{ defaultLedger.description || '记录日常生活收支' }}</p>
          <div class="ledger-default-stats" v-if="defaultStats">
            <span class="ledger-stat">共 <strong>{{ defaultStats.count }}</strong> 笔</span>
            <span class="ledger-stat-divider"></span>
            <span class="ledger-stat">本月 <strong class="ledger-stat-amount">¥{{ formatAmount(defaultStats.monthlyExpense) }}</strong></span>
          </div>
        </div>

        <button class="ledger-edit-btn" @click="openEdit(defaultLedger)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑
        </button>
      </div>

      <div class="ledger-section-header" v-if="otherLedgers.length > 0">
        <h3 class="ledger-section-title">其它账本</h3>
        <span class="ledger-section-count">共 {{ otherLedgers.length }} 个账本</span>
      </div>

      <div class="ledger-grid">
        <TransitionGroup name="ledger-card">
          <div
            v-for="lb in otherLedgers"
            :key="lb.id"
            class="ledger-card"
            @click="handleSelectLedger(lb)"
          >
            <div class="ledger-card-top">
              <div class="ledger-card-icon" :style="{ background: getIconBg(lb.id), color: getIconColor(lb.id) }">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  <line x1="8" y1="7" x2="16" y2="7"/>
                  <line x1="8" y1="11" x2="13" y2="11"/>
                </svg>
              </div>
              <button class="ledger-menu-btn" @click.stop="handleMenuClick(lb, $event)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="5" r="1"/>
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="12" cy="19" r="1"/>
                </svg>
              </button>
            </div>
            <div class="ledger-card-body">
              <h4 class="ledger-card-name">{{ lb.name }}</h4>
              <p class="ledger-card-desc">{{ lb.description || '暂无描述' }}</p>
            </div>
            <div class="ledger-card-footer">
              <span class="ledger-stat">共 <strong>{{ getBookStats(lb.id).count }}</strong> 笔</span>
              <span class="ledger-stat-divider"></span>
              <span class="ledger-stat">本月 <strong :style="{ color: getIconColor(lb.id) }">¥{{ formatAmount(getBookStats(lb.id).monthlyExpense) }}</strong></span>
            </div>
          </div>
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

    <Teleport to="body">
      <Transition name="dialog-fade">
        <div v-if="menuVisible" class="ledger-menu-overlay" @click="menuVisible = false">
          <Transition name="dialog-scale">
            <div v-if="menuVisible" class="ledger-menu-pop" :style="menuStyle" @click.stop>
              <button class="ledger-menu-item" @click="menuEdit">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                编辑
              </button>
              <button class="ledger-menu-item ledger-menu-item--danger" @click="menuDelete">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                删除
              </button>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="dialogVisible" class="modal-overlay" @click.self="dialogVisible = false; resetForm()">
          <div class="modal-backdrop"></div>
          <div class="modal-panel" style="width:400px">
            <div class="modal-header">
              <h3 class="modal-title">{{ dialogMode === 'create' ? '新建账本' : '编辑账本' }}</h3>
              <button class="modal-close" @click="dialogVisible = false; resetForm()">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <div class="ldb-row">
                <label class="ldb-label">名称</label>
                <input v-model="formData.name" class="ldb-input" placeholder="请输入账本名称" maxlength="30" @keyup.enter="handleSubmit" />
              </div>
              <div class="ldb-row">
                <label class="ldb-label">描述（选填）</label>
                <textarea v-model="formData.description" class="ldb-textarea" rows="2" placeholder="描述账本用途..." maxlength="100"></textarea>
              </div>
            </div>
            <div class="modal-footer">
              <button class="ldb-btn-cancel" @click="dialogVisible = false; resetForm()">取消</button>
              <button class="ldb-btn-submit" :disabled="!formData.name.trim() || submitting" @click="handleSubmit">
                {{ submitting ? '提交中...' : (dialogMode === 'create' ? '创建' : '保存') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLedgerStore } from '../stores/ledgerStore'
import BookSwitcher from '../components/BookSwitcher.vue'
import dayjs from 'dayjs'

const ICON_COLORS = [
  { bg: 'rgba(59,130,246,0.1)', color: '#3B82F6' },
  { bg: 'rgba(16,185,129,0.1)', color: '#10B981' },
  { bg: 'rgba(139,92,246,0.1)', color: '#8B5CF6' },
  { bg: 'rgba(245,158,11,0.1)', color: '#F59E0B' },
  { bg: 'rgba(239,68,68,0.1)', color: '#EF4444' },
  { bg: 'rgba(236,72,153,0.1)', color: '#EC4899' },
]

const ledgerStore = useLedgerStore()
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const submitting = ref(false)
const currentEditId = ref<number>(0)
const statsCache = ref<Record<number, { count: number; monthlyExpense: number }>>({})

const menuVisible = ref(false)
const menuTarget = ref<Record<string, unknown> | null>(null)
const menuStyle = ref({ top: '0px', left: '0px' })

const formData = reactive({ name: '', description: '' })

const defaultLedger = computed(() => ledgerStore.list.find(l => l.id === 1) || null)
const otherLedgers = computed(() => ledgerStore.list.filter(l => l.id !== 1))

const defaultStats = computed(() => getBookStats(1))

onMounted(() => {
  fetchLedgers()
})

async function fetchLedgers() {
  await ledgerStore.fetchList()
  ledgerStore.list.forEach(lb => {
    fetchBookStats(lb.id)
  })
}

async function fetchBookStats(ledgerId: number) {
  try {
    const yearMonth = dayjs().format('YYYY-MM')
    const res = await window.transactionAPI.getTransactionList({
      page: 1, pageSize: 9999, ledgerId
    })
    const count = res.code === 0 ? res.data.total : 0

    const statsRes = await window.transactionAPI.getStats(
      `${yearMonth}-01`,
      dayjs().endOf('month').format('YYYY-MM-DD'),
      undefined,
      ledgerId
    )
    const monthlyExpense = statsRes.code === 0
      ? (statsRes.data.expenseCategoryStats || []).reduce((s: number, c: any) => s + c.total, 0)
      : 0

    statsCache.value = { ...statsCache.value, [ledgerId]: { count, monthlyExpense } }
  } catch {
    statsCache.value = { ...statsCache.value, [ledgerId]: { count: 0, monthlyExpense: 0 } }
  }
}

function getBookStats(ledgerId: number) {
  return statsCache.value[ledgerId] || { count: 0, monthlyExpense: 0 }
}

function getIconBg(id: number) {
  return ICON_COLORS[id % ICON_COLORS.length].bg
}

function getIconColor(id: number) {
  return ICON_COLORS[id % ICON_COLORS.length].color
}

function handleSelectLedger(lb: { id: number; name: string }) {
  ledgerStore.setCurrentId(lb.id)
  ElMessage.success(`已切换到「${lb.name}」`)
}

function openCreate() {
  dialogMode.value = 'create'
  dialogVisible.value = true
}

function openEdit(lb: { id: number; name: string; description?: string }) {
  dialogMode.value = 'edit'
  currentEditId.value = lb.id
  formData.name = lb.name
  formData.description = lb.description || ''
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formData.name.trim() || submitting.value) return

  submitting.value = true
  try {
    let res: ApiResponse
    if (dialogMode.value === 'create') {
      res = await window.ledgerAPI.createLedger(formData.name.trim(), formData.description.trim())
    } else {
      res = await window.ledgerAPI.updateLedger(currentEditId.value, formData.name.trim(), formData.description.trim())
    }
    if (res.code === 0) {
      ElMessage.success(dialogMode.value === 'create' ? '创建成功' : '保存成功')
      dialogVisible.value = false
      await fetchLedgers()
    } else {
      ElMessage.error(res.msg)
    }
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  formData.name = ''
  formData.description = ''
}

function handleMenuClick(lb: Record<string, unknown>, clickEvent?: MouseEvent) {
  menuTarget.value = lb
  const el = clickEvent?.currentTarget as HTMLElement
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
  if (lb.id === 1) {
    ElMessage.warning('默认账本不可删除')
    return
  }
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

function formatAmount(val: number): string {
  return val.toFixed(2)
}
</script>

<style scoped>
.ledger-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ledger-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 40px;
  flex-shrink: 0;
}

.ledger-header-left {
  min-width: 0;
}

.ledger-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.ledger-title {
  font-size: 2rem;
  font-weight: 700;
  color: #1A1A2E;
  letter-spacing: -0.02em;
  line-height: 1.3;
  margin-bottom: 4px;
}

.ledger-subtitle {
  font-size: 0.8125rem;
  color: #6B7280;
}

.ledger-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 40px 32px;
}

.ledger-content {
  position: relative;
  z-index: 1;
}

.ledger-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: #FF8C00;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(255, 140, 0, 0.3);
  white-space: nowrap;
}

.ledger-create-btn:hover {
  background: #E07800;
  box-shadow: 0 4px 12px rgba(255, 140, 0, 0.4);
}

.ledger-default-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  padding: 28px 32px;
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 28px;
  transition: box-shadow 0.2s ease;
}

.ledger-default-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.ledger-default-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #FFF5E6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ledger-default-body {
  flex: 1;
  min-width: 0;
}

.ledger-default-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.ledger-default-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1A1A2E;
}

.ledger-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 9999px;
  background: #FFF5E6;
  color: #FF8C00;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.ledger-default-desc {
  font-size: 0.8125rem;
  color: #6B7280;
  margin-bottom: 10px;
}

.ledger-default-stats {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.8125rem;
}

.ledger-stat {
  color: #9CA3AF;
}

.ledger-stat strong {
  color: #1A1A2E;
  font-weight: 600;
}

.ledger-stat-amount {
  color: #FF8C00;
}

.ledger-stat-divider {
  width: 1px;
  height: 14px;
  background: rgba(235,238,242,0.7);
}

.ledger-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  background: transparent;
  color: #6B7280;
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}

.ledger-edit-btn:hover {
  border-color: #FFAD42;
  color: #FF8C00;
}

.ledger-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ledger-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1A1A2E;
}

.ledger-section-count {
  font-size: 0.75rem;
  color: #9CA3AF;
}

.ledger-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.ledger-card {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ledger-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  transform: translateY(-2px);
}

.ledger-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.ledger-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.ledger-card:hover .ledger-card-icon {
  transform: scale(1.06);
}

.ledger-menu-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #9CA3AF;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.ledger-menu-btn:hover {
  background: #F5F7FA;
  color: #6B7280;
}

.ledger-card-body {
  min-width: 0;
}

.ledger-card-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1A1A2E;
  margin-bottom: 4px;
}

.ledger-card-desc {
  font-size: 0.75rem;
  color: #9CA3AF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ledger-card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.75rem;
  padding-top: 8px;
  border-top: 1px solid rgba(235,238,242,0.7);
}

.ledger-card--create {
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(8px);
  border: 2px dashed rgba(235,238,242,0.7);
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  transition: all 0.2s ease;
}

.ledger-card--create:hover {
  border-color: #FFAD42;
  background: #FFF5E6;
  transform: translateY(-2px);
}

.ledger-create-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #F5F7FA;
  border: 1px dashed #EBEEF2;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.ledger-card--create:hover .ledger-create-icon {
  background: #FF8C00;
  border-color: #FF8C00;
}

.ledger-card--create:hover .ledger-create-icon svg {
  stroke: #fff;
}

.ledger-create-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6B7280;
}

.ledger-create-hint {
  font-size: 0.75rem;
  color: #9CA3AF;
}

.ledger-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.ledger-menu-pop {
  position: fixed;
  background: rgba(255,255,255,0.95);
  border: 1px solid rgba(235,238,242,0.7);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  backdrop-filter: blur(12px);
  padding: 4px;
  min-width: 120px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ledger-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #1A1A2E;
  cursor: pointer;
  transition: background 0.12s ease;
  font-family: inherit;
}

.ledger-menu-item:hover {
  background: #F5F7FA;
}

.ledger-menu-item--danger {
  color: #EF4444;
}

.ledger-menu-item--danger:hover {
  background: #FEF2F2;
}

.ledger-card-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ledger-card-leave-active {
  transition: all 0.25s ease-in;
}

.ledger-card-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}

.ledger-card-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.ledger-card-move {
  transition: transform 0.3s ease;
}

.modal-overlay {
  position: fixed; inset: 0; z-index: 2000; display: flex;
  align-items: center; justify-content: center;
}
.modal-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
}
.modal-panel {
  position: relative; background: #fff; border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); overflow: hidden;
  display: flex; flex-direction: column; max-height: 85vh;
}
.modal-header {
  padding: 20px 24px 14px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid #F0F2F5;
}
.modal-title { font-size: 0.9375rem; font-weight: 600; color: #1A1A2E; }
.modal-close {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.modal-close:hover { background: #F5F7FA; color: #6B7280; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer {
  padding: 14px 24px 20px; display: flex; justify-content: flex-end;
  gap: 8px; border-top: 1px solid #F0F2F5;
}

.ldb-row { margin-bottom: 16px; }
.ldb-row:last-child { margin-bottom: 0; }
.ldb-label {
  font-size: 0.8125rem; font-weight: 500; color: #6B7280;
  display: block; margin-bottom: 6px;
}
.ldb-input {
  width: 100%; padding: 8px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; outline: none; font-family: inherit; box-sizing: border-box;
}
.ldb-input:focus { border-color: #FF8C00; }
.ldb-textarea {
  width: 100%; padding: 8px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; outline: none; font-family: inherit;
  resize: vertical; box-sizing: border-box;
}
.ldb-textarea:focus { border-color: #FF8C00; }
.ldb-textarea::placeholder { color: #9CA3AF; }
.ldb-btn-cancel {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; font-family: inherit; border: 1px solid rgba(235,238,242,0.7);
  background: transparent; color: #6B7280; transition: all 0.15s;
}
.ldb-btn-cancel:hover { border-color: #FFAD42; color: #FF8C00; }
.ldb-btn-submit {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; font-family: inherit; border: none;
  background: #FF8C00; color: #fff; transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(255,140,0,0.25);
}
.ldb-btn-submit:hover { background: #E07800; }
.ldb-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

.dialog-fade-enter-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-leave-active {
  transition: opacity 0.15s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-scale-enter-active {
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dialog-scale-leave-active {
  transition: all 0.12s ease-in;
}

.dialog-scale-enter-from,
.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
