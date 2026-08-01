<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <div class="modal-backdrop"></div>
        <div class="modal-panel" style="width:540px">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">导入 CSV 文件</h3>
              <p class="modal-desc">支持 .csv 格式的账单数据，可预览前 5 条记录</p>
            </div>
            <button class="modal-close" @click="handleClose">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :limit="1"
              accept=".csv"
              :on-change="handleFileChange"
              :on-remove="handleFileRemove"
              :file-list="fileList"
              :show-file-list="false"
            >
              <div class="csv-upload-zone">
                <div class="csv-upload-icon">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#FF8C00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <p class="csv-upload-text">点击选择 CSV 文件</p>
                <p class="csv-upload-hint">支持 .csv 格式，单文件最大 10MB</p>
              </div>
            </el-upload>

            <div v-if="fileName" class="csv-file-card">
              <div class="csv-file-icon">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div class="csv-file-info">
                <p class="csv-file-name">{{ fileName }}</p>
                <p class="csv-file-meta" v-if="csvPreview.length > 0">{{ csvPreview.length }} 条预览记录</p>
              </div>
              <button class="csv-file-remove" @click="handleFileRemove">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div v-if="csvPreview.length > 0" class="csv-preview-section">
              <p class="csv-preview-title">数据预览（前 5 条）</p>
              <div class="csv-preview-wrap">
                <table class="csv-preview-table">
                  <thead>
                    <tr>
                      <th>日期</th><th>分类</th><th>描述</th><th style="text-align:right">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, idx) in csvPreview" :key="idx">
                      <td style="color:#6B7280">{{ row.date }}</td>
                      <td>
                        <span style="display:inline-flex;align-items:center;gap:4px">
                          <span style="width:6px;height:6px;border-radius:50%;background:#FF8C00"></span>
                          {{ row.category }}
                        </span>
                      </td>
                      <td>{{ row.desc }}</td>
                      <td style="text-align:right;font-weight:500" :style="{ color: row.type === '收入' ? '#10B981' : '#1A1A2E' }">
                        {{ row.type === '收入' ? '+' : '-' }}{{ row.amount }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div v-if="importResult" class="csv-result" :class="importResult.failCount > 0 ? 'csv-result--warn' : 'csv-result--ok'">
              <p>导入完成：成功 {{ importResult.successCount }} 条，失败 {{ importResult.failCount }} 条</p>
            </div>
          </div>

          <div class="modal-footer">
            <button class="mdb-btn-cancel" @click="handleClose">取消</button>
            <button class="mdb-btn-submit" :disabled="!csvText || importing" @click="handleImport">
              {{ importing ? '导入中...' : '开始导入' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { UploadFile, UploadInstance } from 'element-plus'
import { useTransactionStore } from '../stores/transactionStore'
import { useLedgerStore } from '../stores/ledgerStore'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'success'): void }>()

const transactionStore = useTransactionStore()
const ledgerStore = useLedgerStore()

const uploadRef = ref<UploadInstance>()
const fileList = ref<UploadFile[]>([])
const csvText = ref('')
const csvPreview = ref<any[]>([])
const fileName = ref('')
const importing = ref(false)
const importResult = ref<any>(null)

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current); current = '' }
      else current += ch
    }
  }
  result.push(current)
  return result
}

function handleFileChange(file: UploadFile) {
  importResult.value = null
  csvPreview.value = []
  csvText.value = ''
  fileName.value = file.name || ''

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    csvText.value = text
    const lines = text.trim().split(/\r?\n/)
    const previewLines = lines.slice(1, Math.min(6, lines.length))
    csvPreview.value = previewLines.map(line => {
      const cols = parseCsvLine(line)
      return {
        date: cols[0] || '',
        type: cols[1] || '',
        category: cols[2] || '',
        amount: cols[3] || '',
        desc: cols[4] || ''
      }
    })
  }
  if (file.raw) {
    reader.readAsText(file.raw)
  }
}

function handleFileRemove() {
  csvText.value = ''
  csvPreview.value = []
  fileName.value = ''
  importResult.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
}

async function handleImport() {
  if (!csvText.value) return
  importing.value = true
  try {
    const result = await transactionStore.importCsv(csvText.value, ledgerStore.currentId)
    if (result) {
      importResult.value = result
      emit('success')
    }
  } finally {
    importing.value = false
  }
}

function handleClose() { emit('update:visible', false) }
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
  position: relative; background: $color-bg-white; border-radius: $radius-2xl;
  box-shadow: $shadow-xl; overflow: hidden;
  display: flex; flex-direction: column; max-height: 85vh;
}
.modal-header {
  padding: 24px 28px 16px; display: flex; align-items: center;
  justify-content: space-between; border-bottom: 1px solid $color-bg-page;
}
.modal-title { font-size: $font-xl; font-weight: $font-semibold; color: $color-text-primary; }
.modal-desc { font-size: $font-base; color: $color-text-secondary; margin-top: 4px; }
.modal-close {
  width: 32px; height: 32px; border-radius: $radius-lg; border: none;
  background: transparent; cursor: pointer; color: $color-text-muted;
  display: flex; align-items: center; justify-content: center;
  transition: $transition-base; flex-shrink: 0;
}
.modal-close:hover { background: $color-bg-hover; color: $color-text-secondary; }

.modal-body { padding: 24px 28px; overflow-y: auto; flex: 1; }

.modal-footer {
  padding: 16px 28px 24px; display: flex; justify-content: flex-end;
  gap: 10px; border-top: 1px solid $color-bg-page;
}

.csv-upload-zone {
  border: 2px dashed rgba($color-border-light,0.7); border-radius: $radius-xl;
  padding: 36px 24px; text-align: center; cursor: pointer;
  transition: $transition-slow; margin-bottom: 16px;
}
.csv-upload-zone:hover { border-color: $color-primary; background: rgba($color-primary,0.03); }

.modal-body :deep(.el-upload) {
  width: 100%;
  display: block;
}

.modal-body :deep(.el-upload-dragger) {
  width: 100%;
}

.csv-upload-icon {
  width: 48px; height: 48px; border-radius: 50%; background: $color-primary-light;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 12px;
}

.csv-upload-text { font-size: $font-base; font-weight: $font-medium; color: $color-text-primary; margin-bottom: 4px; }
.csv-upload-hint { font-size: $font-sm; color: $color-text-muted; }

.csv-file-card {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 16px; background: $color-primary-light; border-radius: $radius-lg; margin-bottom: 20px;
}

.csv-file-icon {
  width: 32px; height: 32px; border-radius: $radius-sm; background: $color-primary;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}

.csv-file-info { flex: 1; min-width: 0; }
.csv-file-name { font-size: $font-base; font-weight: $font-medium; color: $color-text-primary; }
.csv-file-meta { font-size: $font-sm; color: $color-text-secondary; margin-top: 1px; }

.csv-file-remove {
  width: 24px; height: 24px; border: none; background: transparent;
  cursor: pointer; color: $color-text-muted; display: flex; align-items: center;
  justify-content: center;
}
.csv-file-remove:hover { color: $color-danger; }

.csv-preview-section { margin-bottom: 16px; }
.csv-preview-title { font-size: $font-base; font-weight: $font-semibold; color: $color-text-primary; margin-bottom: 10px; }

.csv-preview-wrap {
  border: 1px solid rgba($color-border-light,0.7); border-radius: $radius-lg; overflow: hidden;
}

.csv-preview-table { width: 100%; border-collapse: collapse; font-size: $font-sm; }
.csv-preview-table th {
  text-align: left; padding: 8px 12px; font-weight: $font-semibold; color: $color-text-muted;
  border-bottom: 1px solid rgba($color-border-light,0.7); background: rgba(0,0,0,0.01);
}
.csv-preview-table td {
  padding: 8px 12px; border-bottom: 1px solid rgba($color-border-light,0.4);
  color: $color-text-primary;
}
.csv-preview-table tr:last-child td { border-bottom: none; }

.csv-result {
  padding: 10px 16px; border-radius: $radius-lg; font-size: $font-base; font-weight: $font-medium;
}
.csv-result--ok { background: rgba($color-success,0.08); color: $color-success; }
.csv-result--warn { background: rgba(245,158,11,0.08); color: $color-warning; }

.mdb-btn-cancel {
  padding: 8px 20px; border-radius: $radius-lg; font-size: $font-base; font-weight: $font-medium;
  cursor: pointer; font-family: inherit; border: 1px solid rgba($color-border-light,0.7);
  background: transparent; color: $color-text-secondary; transition: $transition-base;
}
.mdb-btn-cancel:hover { border-color: $color-primary-border; color: $color-primary; }

.mdb-btn-submit {
  padding: 8px 20px; border-radius: $radius-lg; font-size: $font-base; font-weight: $font-semibold;
  cursor: pointer; font-family: inherit; border: none;
  background: $color-primary; color: #fff; transition: $transition-base;
  box-shadow: 0 2px 6px rgba($color-primary,0.25);
}
.mdb-btn-submit:hover { background: $color-primary-hover; }
.mdb-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-fade-enter-active { transition: opacity 0.2s ease; }
.modal-fade-leave-active { transition: opacity 0.15s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
