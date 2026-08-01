/**
 * 账本创建/编辑表单状态管理。
 * dialogVisible、formData、create/edit 切换、提交与重置。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export type FormMode = 'create' | 'edit'

export function useLedgerForm(onSaved: () => Promise<void>) {
  const dialogVisible = ref(false)
  const dialogMode = ref<FormMode>('create')
  const submitting = ref(false)
  const currentEditId = ref<number>(0)

  const formData = ref({ name: '', description: '' })

  function openCreate() {
    dialogMode.value = 'create'
    formData.value = { name: '', description: '' }
    dialogVisible.value = true
  }

  function openEdit(lb: { id: number; name: string; description?: string }) {
    dialogMode.value = 'edit'
    currentEditId.value = lb.id
    formData.value = { name: lb.name, description: lb.description || '' }
    dialogVisible.value = true
  }

  async function handleSubmit() {
    if (!formData.value.name.trim() || submitting.value) return

    submitting.value = true
    try {
      let res: ApiResponse
      if (dialogMode.value === 'create') {
        res = await window.ledgerAPI.createLedger(formData.value.name.trim(), formData.value.description.trim())
      } else {
        res = await window.ledgerAPI.updateLedger(currentEditId.value, formData.value.name.trim(), formData.value.description.trim())
      }
      if (res.code === 0) {
        ElMessage.success(dialogMode.value === 'create' ? '创建成功' : '保存成功')
        dialogVisible.value = false
        await onSaved()
      } else {
        ElMessage.error(res.msg)
      }
    } finally {
      submitting.value = false
    }
  }

  return {
    dialogVisible, dialogMode, submitting, currentEditId, formData,
    openCreate, openEdit, handleSubmit,
  }
}
