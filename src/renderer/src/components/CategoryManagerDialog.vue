<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-backdrop"></div>
        <div class="modal-panel">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">分类管理</h3>
              <p class="modal-desc">管理账单分类，支持添加、编辑、删除</p>
            </div>
            <button class="modal-close" @click="handleClose">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Tab Bar -->
          <div class="mdc-tabs">
            <button :class="['mdc-tab', { active: activeTab === 'expense' }]" @click="activeTab = 'expense'">支出分类</button>
            <button :class="['mdc-tab', { active: activeTab === 'income' }]" @click="activeTab = 'income'">收入分类</button>
          </div>

          <!-- Category List -->
          <div class="mdc-list">
            <template v-for="cat in currentList" :key="cat.id">
              <!-- Normal row -->
              <div v-if="editingId !== cat.id" class="mdc-row">
                <span class="mdc-dot" :style="{ background: getCatColor(cat.name) }"></span>
                <span class="mdc-name">{{ cat.name }}</span>
                <span class="mdc-count" v-if="cat.transactionCount !== undefined">{{ cat.transactionCount }} 笔</span>
                <div class="mdc-actions">
                  <button class="mdc-act mdc-act-edit" @click="startEdit(cat)" title="编辑">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button class="mdc-act mdc-act-del" @click="handleDelete(cat)" title="删除">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              <!-- Editing row -->
              <div v-else class="mdc-row mdc-row--editing">
                <span class="mdc-dot" :style="{ background: getCatColor(editingName) }"></span>
                <input
                  ref="editInputRef"
                  v-model="editingName"
                  class="mdc-edit-input"
                  maxlength="20"
                  @keyup.enter="saveEdit"
                  @keyup.escape="cancelEdit"
                />
                <div class="mdc-actions">
                  <button class="mdc-act mdc-act-save" @click="saveEdit" title="保存">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                  <button class="mdc-act mdc-act-cancel" @click="cancelEdit" title="取消">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            </template>

            <div v-if="currentList.length === 0" class="mdc-empty">暂无分类</div>
          </div>

          <!-- Footer -->
          <div class="modal-footer">
            <div class="mdc-add-row">
              <input
                v-model="newName"
                class="mdc-add-input"
                placeholder="新分类名称"
                maxlength="20"
                @keyup.enter="handleAdd"
              />
              <button class="mdc-add-btn" @click="handleAdd">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                添加
              </button>
            </div>
            <button class="mdb-btn-submit" @click="handleClose">完成</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useCategoryStore } from '../stores/categoryStore'
import { CHART_COLORS } from '@/const'

const CAT_COLORS = CHART_COLORS

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'close'): void }>()

const categoryStore = useCategoryStore()

const activeTab = ref<'expense' | 'income'>('expense')
const newName = ref('')

// Inline editing state
const editingId = ref<number | null>(null)
const editingName = ref('')
const editInputRef = ref<HTMLInputElement[]>()

const catColorCache = new Map<string, string>()
let catIdx = 0

const currentList = computed(() => {
  const list = activeTab.value === 'expense'
    ? categoryStore.expenseCategories
    : categoryStore.incomeCategories
  return list.map((cat) => {
    if (!catColorCache.has(cat.name)) {
      catColorCache.set(cat.name, CAT_COLORS[catIdx++ % CAT_COLORS.length])
    }
    return cat
  })
})

function getCatColor(name: string): string {
  if (!catColorCache.has(name)) {
    catColorCache.set(name, CAT_COLORS[catIdx++ % CAT_COLORS.length])
  }
  const color = catColorCache.get(name)
  return color ?? CAT_COLORS[0]
}

function startEdit(cat: { id: number; name: string; type: string }) {
  editingId.value = cat.id
  editingName.value = cat.name
  nextTick(() => {
    const input = editInputRef.value
    if (input) {
      const el = Array.isArray(input) ? input[0] : input
      el?.focus()
      el?.select()
    }
  })
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}

async function saveEdit() {
  if (editingId.value === null || !editingName.value.trim()) return
  await categoryStore.updateCategory(editingId.value, editingName.value.trim(), '', 0)
  editingId.value = null
  editingName.value = ''
}

async function handleAdd() {
  if (!newName.value.trim()) return
  await categoryStore.createCategory(newName.value.trim(), activeTab.value)
  newName.value = ''
}

async function handleDelete(cat: { id: number }) {
  await categoryStore.deleteCategory(cat.id)
}

function handleClose() {
  emit('update:visible', false)
  emit('close')
}

onMounted(() => {
  categoryStore.fetchAllCategories()
})

watch(() => props.visible, (val) => {
  if (val) {
    editingId.value = null
    editingName.value = ''
    newName.value = ''
    activeTab.value = 'expense'
  }
})
</script>

<style scoped>
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
  display: flex; flex-direction: column; max-height: 80vh;
  width: 520px; max-width: 90vw;
}

.modal-header {
  padding: 24px 28px 16px; display: flex; align-items: center;
  justify-content: space-between;
}
.modal-title { font-size: 1rem; font-weight: 600; color: #1A1A2E; }
.modal-desc { font-size: 0.8125rem; color: #6B7280; margin-top: 4px; }
.modal-close {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.modal-close:hover { background: #F5F7FA; color: #6B7280; }

.mdc-tabs {
  display: flex; padding: 0 28px; border-bottom: 1px solid rgba(235,238,242,0.7);
  flex-shrink: 0;
}
.mdc-tab {
  padding: 10px 0; margin-right: 24px; font-size: 0.8125rem;
  font-weight: 500; color: #9CA3AF; border: none; background: none;
  cursor: pointer; position: relative; transition: color 0.15s;
  font-family: inherit;
}
.mdc-tab.active { color: #FF8C00; }
.mdc-tab.active::after {
  content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
  height: 2px; background: #FF8C00; border-radius: 1px;
}

.mdc-list {
  flex: 1; overflow-y: auto; padding: 16px 28px;
  min-height: 0;
}

.mdc-row {
  display: flex; align-items: center; padding: 12px 16px;
  border: 1px solid rgba(235,238,242,0.7); border-radius: 8px;
  margin-bottom: 8px; gap: 12px; transition: all 0.15s;
}
.mdc-row:hover { background: rgba(0,0,0,0.015); }
.mdc-row--editing {
  border-color: #FF8C00; background: rgba(255,140,0,0.02);
}

.mdc-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.mdc-name { flex: 1; font-weight: 500; font-size: 0.875rem; color: #1A1A2E; }
.mdc-count { font-size: 0.75rem; color: #9CA3AF; margin-right: 4px; }

.mdc-actions { display: flex; gap: 4px; }

.mdc-act {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.mdc-act-edit:hover { color: #FF8C00; background: rgba(255,140,0,0.08); }
.mdc-act-del:hover { color: #EF4444; background: rgba(239,68,68,0.08); }
.mdc-act-save:hover { color: #10B981; background: rgba(16,185,129,0.08); }
.mdc-act-cancel:hover { color: #6B7280; background: rgba(107,114,128,0.08); }

.mdc-edit-input {
  flex: 1; padding: 6px 10px; border: 1px solid #FF8C00; border-radius: 6px;
  font-size: 0.875rem; font-weight: 500; color: #1A1A2E;
  outline: none; font-family: inherit; background: transparent;
}

.mdc-empty {
  text-align: center; padding: 32px 0; font-size: 0.8125rem; color: #9CA3AF;
}

.mdc-add-row { display: flex; gap: 8px; flex: 1; }

.mdc-add-input {
  flex: 1; max-width: 200px; padding: 7px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; outline: none; font-family: inherit;
}
.mdc-add-input:focus { border-color: #FF8C00; }
.mdc-add-input::placeholder { color: #9CA3AF; }

.mdc-add-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 7px 14px; border-radius: 6px; border: 1px dashed rgba(235,238,242,0.7);
  background: transparent; color: #FF8C00; font-size: 0.8125rem;
  font-weight: 500; cursor: pointer; font-family: inherit;
  transition: all 0.15s; white-space: nowrap;
}
.mdc-add-btn:hover { border-color: #FF8C00; background: rgba(255,140,0,0.04); }

.modal-footer {
  padding: 14px 28px 20px; display: flex; align-items: center;
  justify-content: space-between; border-top: 1px solid rgba(235,238,242,0.7);
  flex-shrink: 0;
}

.mdb-btn-submit {
  padding: 7px 20px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; font-family: inherit; border: none;
  background: #FF8C00; color: #fff; transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(255,140,0,0.25);
}
.mdb-btn-submit:hover { background: #E07800; }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
