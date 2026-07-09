<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="handleCancel">
        <div class="modal-backdrop"></div>
        <div class="modal-panel" style="width:420px">
          <div class="modal-header">
            <h3 class="modal-title">{{ mode === 'create' ? '记一笔' : '编辑账单' }}</h3>
            <button class="modal-close" @click="handleCancel">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="mdb-row">
              <label class="mdb-label">类型</label>
              <div class="mdb-type-btns">
                <button
                  :class="['mdb-type-btn', formData.type === 'expense' ? 'mdb-type-btn--expense' : '']"
                  @click="formData.type = 'expense'; onTypeChange()"
                >支出</button>
                <button
                  :class="['mdb-type-btn', formData.type === 'income' ? 'mdb-type-btn--income' : '']"
                  @click="formData.type = 'income'; onTypeChange()"
                >收入</button>
              </div>
            </div>

            <div class="mdb-row">
              <label class="mdb-label">金额</label>
              <div class="mdb-amount-wrap">
                <span class="mdb-amount-prefix">¥</span>
                <input
                  ref="amountRef"
                  :value="amountDisplay"
                  type="text"
                  class="mdb-amount-input"
                  placeholder="0.00"
                  @input="onAmountInput"
                  @blur="onAmountBlur"
                  @focus="onAmountFocus"
                  maxlength="10"
                />
              </div>
            </div>

            <div class="mdb-row">
              <label class="mdb-label">分类</label>
              <el-select
                v-model="formData.categoryId"
                placeholder="请选择分类"
                class="mdb-select"
              >
                <el-option
                  v-for="cat in currentCategories"
                  :key="cat.id"
                  :label="cat.name"
                  :value="cat.id"
                >
                  <div class="mdb-option">
                    <span class="mdb-option-dot" :style="{ background: getCatColor(cat.name) }"></span>
                    {{ cat.name }}
                  </div>
                </el-option>
              </el-select>
            </div>

            <div class="mdb-row">
              <label class="mdb-label">描述</label>
              <input v-model="formData.description" type="text" class="mdb-input" placeholder="输入账单描述..." maxlength="100" />
            </div>

            <div class="mdb-row">
              <label class="mdb-label">日期</label>
              <el-date-picker
                style="width: 100%;"
                v-model="formData.transDate"
                type="date"
                placeholder="选择日期"
                format="YYYY-MM-DD"
                value-format="YYYY-MM-DD"
                class="mdb-date"
              />
            </div>

            <div class="mdb-row">
              <label class="mdb-label">备注（可选）</label>
              <textarea v-model="formData.note" class="mdb-textarea" rows="2" placeholder="添加备注..." maxlength="200"></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button class="mdb-btn-cancel" @click="handleCancel">取消</button>
            <button class="mdb-btn-submit" :disabled="!canSubmit || submitting" @click="handleSubmit">
              {{ submitting ? '提交中...' : (mode === 'create' ? '确认记账' : '保存修改') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, nextTick } from 'vue'
import { useTransactionStore } from '../stores/transactionStore'
import { useCategoryStore } from '../stores/categoryStore'
import { useLedgerStore } from '../stores/ledgerStore'
import dayjs from 'dayjs'

const CAT_COLORS = ['#FF8C00', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6B7280', '#6366F1', '#14B8A6', '#F97316', '#06B6D4']

const props = defineProps<{ visible: boolean; mode: 'create' | 'edit'; editData: Record<string, unknown> | null }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'success'): void }>()

const transactionStore = useTransactionStore()
const categoryStore = useCategoryStore()
const ledgerStore = useLedgerStore()

const amountRef = ref<HTMLInputElement>()
const amountDisplay = ref('')
const submitting = ref(false)
const catColorCache = new Map<string, string>()
let catIdx = 0

const formData = reactive({
  type: 'expense' as string,
  amount: 0,
  categoryId: undefined as number | undefined,
  description: '',
  transDate: dayjs().format('YYYY-MM-DD') as string,
  note: ''
})

const currentCategories = computed(() => {
  return formData.type === 'income' ? categoryStore.incomeCategories : categoryStore.expenseCategories
})

const canSubmit = computed(() => {
  return formData.amount > 0 && formData.amount <= 999999.99 && formData.categoryId !== undefined && formData.transDate && ledgerStore.currentId > 0
})

function getCatColor(name: string): string {
  if (!catColorCache.has(name)) {
    catColorCache.set(name, CAT_COLORS[catIdx++ % CAT_COLORS.length])
  }
  const color = catColorCache.get(name)
  return color ?? CAT_COLORS[0]
}

function onTypeChange() {
  formData.categoryId = undefined
}

function onAmountInput(e: Event) {
  const target = e.target as HTMLInputElement
  let val = target.value.replace(/[^\d.]/g, '')
  const parts = val.split('.')
  if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('')
  if (parts.length === 2 && parts[1].length > 2) val = parts[0] + '.' + parts[1].slice(0, 2)
  const num = parseFloat(val)
  if (!isNaN(num) && num > 999999.99) {
    val = '999999.99'
  }
  amountDisplay.value = val
  formData.amount = parseFloat(val) || 0
}

function onAmountFocus() {
  amountRef.value?.select()
}

function onAmountBlur() {
  if (formData.amount > 0) {
    amountDisplay.value = formData.amount.toFixed(2)
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    submitting.value = false
    if (props.mode === 'edit' && props.editData) {
      formData.type = props.editData.type || 'expense'
      formData.amount = props.editData.amount || 0
      formData.categoryId = props.editData.category_id
      formData.description = props.editData.description || ''
      formData.transDate = props.editData.trans_date || dayjs().format('YYYY-MM-DD')
      formData.note = props.editData.note || ''
      amountDisplay.value = formData.amount > 0 ? String(formData.amount) : ''
    } else {
      formData.type = 'expense'
      formData.amount = 0
      formData.categoryId = undefined
      formData.description = ''
      formData.transDate = dayjs().format('YYYY-MM-DD')
      formData.note = ''
      amountDisplay.value = ''
      nextTick(() => amountRef.value?.focus())
    }
  }
})

async function handleSubmit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const data = {
      type: formData.type,
      amount: formData.amount,
      categoryId: formData.categoryId as number,
      ledgerId: ledgerStore.currentId,
      transDate: formData.transDate,
      description: formData.description.trim(),
      note: formData.note.trim()
    }
    let ok = false
    if (props.mode === 'create') {
      ok = await transactionStore.createTransaction(data)
    } else {
      ok = await transactionStore.updateTransaction(props.editData.id, data)
    }
    if (ok) emit('success')
  } finally {
    submitting.value = false
  }
}

function handleCancel() {
  emit('update:visible', false)
}

onMounted(() => {
  categoryStore.fetchAllCategories()
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
  position: relative; background: #fff;
  border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  overflow: hidden; max-height: 85vh; display: flex; flex-direction: column;
}

.modal-header {
  padding: 20px 24px 14px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid #F0F2F5;
}

.modal-title {
  font-size: 0.9375rem; font-weight: 600; color: #1A1A2E;
}

.modal-close {
  width: 28px; height: 28px; border-radius: 6px; border: none;
  background: transparent; cursor: pointer; color: #9CA3AF;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.modal-close:hover { background: #F5F7FA; color: #6B7280; }

.modal-body {
  padding: 20px 24px; overflow-y: auto; flex: 1;
}

.modal-footer {
  padding: 14px 24px 20px; display: flex; justify-content: flex-end;
  gap: 8px; border-top: 1px solid #F0F2F5;
}

.mdb-row { margin-bottom: 16px; }
.mdb-row:last-child { margin-bottom: 0; }

.mdb-label {
  font-size: 0.8125rem; font-weight: 500; color: #6B7280;
  display: block; margin-bottom: 6px;
}

.mdb-type-btns { display: flex; gap: 6px; }

.mdb-type-btn {
  flex: 1; padding: 8px; border-radius: 8px; font-size: 0.8125rem;
  font-weight: 500; cursor: pointer; font-family: inherit;
  border: 2px solid rgba(235,238,242,0.6);
  background: transparent; color: #6B7280;
  transition: all 0.15s;
}

.mdb-type-btn--expense {
  border-color: #EF4444; background: rgba(239,68,68,0.06); color: #EF4444;
}

.mdb-type-btn--income {
  border-color: #10B981; background: rgba(16,185,129,0.06); color: #10B981;
}

.mdb-amount-wrap { position: relative; }

.mdb-amount-prefix {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  font-size: 0.9375rem; font-weight: 700; color: #1A1A2E; pointer-events: none;
}

.mdb-amount-input {
  width: 100%; padding: 8px 12px 8px 30px;
  border: 1px solid rgba(235,238,242,0.7); border-radius: 6px;
  font-size: 0.9375rem; font-weight: 600; color: #1A1A2E;
  background: transparent; outline: none; font-family: inherit;
  box-sizing: border-box; font-variant-numeric: tabular-nums;
}
.mdb-amount-input:focus { border-color: #FF8C00; }
.mdb-amount-input::placeholder { color: #9CA3AF; font-weight: 400; }

.mdb-select {
  width: 100%;
}

.mdb-select :deep(.el-input__wrapper) {
  border-radius: 6px;
}

.mdb-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mdb-option-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mdb-date {
  width: 100%;
}

.mdb-date :deep(.el-input__wrapper) {
  border-radius: 6px;
}

.mdb-input {
  width: 100%; padding: 8px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; background: transparent; outline: none;
  font-family: inherit; box-sizing: border-box;
}
.mdb-input:focus { border-color: #FF8C00; }

.mdb-textarea {
  width: 100%; padding: 8px 12px; border-radius: 6px;
  border: 1px solid rgba(235,238,242,0.7); font-size: 0.8125rem;
  color: #1A1A2E; background: transparent; outline: none;
  font-family: inherit; resize: vertical; box-sizing: border-box;
}
.mdb-textarea:focus { border-color: #FF8C00; }
.mdb-textarea::placeholder { color: #9CA3AF; }

.mdb-btn-cancel {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; font-family: inherit; border: 1px solid rgba(235,238,242,0.7);
  background: transparent; color: #6B7280; transition: all 0.15s;
}
.mdb-btn-cancel:hover { border-color: #FFAD42; color: #FF8C00; }

.mdb-btn-submit {
  padding: 7px 18px; border-radius: 6px; font-size: 0.8125rem; font-weight: 600;
  cursor: pointer; font-family: inherit; border: none;
  background: #FF8C00; color: #fff; transition: all 0.15s;
  box-shadow: 0 2px 6px rgba(255,140,0,0.25);
}
.mdb-btn-submit:hover { background: #E07800; }
.mdb-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
