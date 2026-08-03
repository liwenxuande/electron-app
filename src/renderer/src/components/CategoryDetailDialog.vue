<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-backdrop"></div>
        <div class="modal-panel" style="width:560px">
          <div class="modal-header">
            <h3 class="modal-title">{{ categoryName }} 账单明细</h3>
            <button class="modal-close" @click="handleClose">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body" v-loading="loading" :class="{ 'cdd-scroll': list.length > 15 }">
            <table class="cdd-table" v-if="list.length > 0">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>金额</th>
                  <th>描述</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in list" :key="item.id">
                  <td>{{ item.trans_date }}</td>
                  <td :class="item.type === 'income' ? 'cdd-income' : 'cdd-expense'">¥{{ item.amount.toFixed(2) }}</td>
                  <td>{{ item.description || '-' }}</td>
                  <td>{{ item.note || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <el-empty v-else description="暂无数据" :image-size="60" />
          </div>

          <div class="modal-footer cdd-footer">
            <span class="cdd-summary">共 {{ list.length }} 笔，合计 ¥{{ totalAmount.toFixed(2) }}</span>
            <button class="cdd-btn-close" @click="handleClose">关闭</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface DetailItem {
  id: number
  type: string
  amount: number
  trans_date: string
  description: string
  note?: string
}

const props = defineProps<{
  visible: boolean
  categoryName: string
  categoryId: number
  startDate: string
  endDate: string
}>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void }>()

const list = ref<DetailItem[]>([])
const loading = ref(false)

const totalAmount = computed(() => list.value.reduce((s, i) => s + i.amount, 0))

watch(() => props.visible, async (val) => {
  if (val) {
    await fetchDetail()
  }
})

async function fetchDetail() {
  loading.value = true
  try {
    const res = await window.transactionAPI.getTransactionList({
      categoryId: props.categoryId,
      startDate: props.startDate,
      endDate: props.endDate,
      page: 1,
      pageSize: 1000
    })
    if (res.code === 0) {
      list.value = res.data.list
    } else {
      ElMessage.error(res.msg || '加载失败')
    }
  } catch {
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

function handleClose() {
  emit('update:visible', false)
}
</script>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: 2000; display: flex;
  align-items: center; justify-content: center;
}
.modal-backdrop {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
}
.modal-panel {
  position: relative; background: $color-bg-white;
  border-radius: $radius-2xl; box-shadow: $shadow-xl;
  overflow: hidden; max-height: 85vh; display: flex; flex-direction: column;
}
.modal-header {
  padding: 20px 24px 14px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid $color-bg-page;
}
.modal-title {
  font-size: $font-lg; font-weight: $font-semibold; color: $color-text-primary;
}
.modal-close {
  width: 28px; height: 28px; border-radius: $radius-md; border: none;
  background: transparent; cursor: pointer; color: $color-text-muted;
  display: flex; align-items: center; justify-content: center;
}
.modal-close:hover { background: $color-bg-hover; color: $color-text-secondary; }
.modal-body {
  padding: 16px 24px; overflow-y: auto; flex: 1;
}
.cdd-scroll { max-height: 420px; }
.cdd-table { width: 100%; border-collapse: collapse; }
.cdd-table th {
  text-align: left; font-size: $font-sm; font-weight: $font-medium; color: $color-text-muted;
  padding: 8px 12px; border-bottom: 1px solid $color-bg-page;
}
.cdd-table td {
  padding: 10px 12px; font-size: $font-base; color: $color-text-primary;
  border-bottom: 1px solid #F5F7FA;
}
.cdd-table tbody tr:hover { background: #FAFBFC; }
.cdd-income { color: $color-success; font-weight: $font-semibold; font-variant-numeric: tabular-nums; }
.cdd-expense { color: $color-primary; font-weight: $font-semibold; font-variant-numeric: tabular-nums; }
.cdd-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 24px 20px; border-top: 1px solid $color-bg-page;
}
.cdd-summary { font-size: $font-base; color: $color-text-secondary; }
.cdd-btn-close {
  padding: 7px 18px; border-radius: $radius-md; font-size: $font-base; font-weight: $font-medium;
  cursor: pointer; font-family: inherit; border: 1px solid rgba($color-border-light,0.7);
  background: transparent; color: $color-text-secondary; transition: $transition-base;
}
.cdd-btn-close:hover { border-color: $color-primary-border; color: $color-primary; }
.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
