import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

export const useCategoryStore = defineStore('category', () => {
  const list = ref<CategoryRow[]>([])
  const expenseCategories = ref<CategoryRow[]>([])
  const incomeCategories = ref<CategoryRow[]>([])
  const loading = ref(false)

  async function fetchAllCategories() {
    loading.value = true
    try {
      const res = await window.categoryAPI.getCategoryList()
      if (res.code === 0) {
        list.value = res.data
        expenseCategories.value = res.data.filter((c) => c.type === 'expense')
        incomeCategories.value = res.data.filter((c) => c.type === 'income')
      }
    } finally {
      loading.value = false
    }
  }

  async function createCategory(name: string, type: string, icon?: string): Promise<boolean> {
    try {
      const res = await window.categoryAPI.createCategory(name, type, icon || '', 0)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchAllCategories()
        return true
      } else {
        ElMessage.error(res.msg)
        return false
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('新增分类失败: ' + errMsg)
      return false
    }
  }

  async function updateCategory(id: number, name: string, icon: string, sortOrder: number): Promise<boolean> {
    try {
      const res = await window.categoryAPI.updateCategory(id, name, icon, sortOrder)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchAllCategories()
        return true
      } else {
        ElMessage.error(res.msg)
        return false
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('编辑分类失败: ' + errMsg)
      return false
    }
  }

  async function deleteCategory(id: number): Promise<boolean> {
    try {
      const res = await window.categoryAPI.deleteCategory(id)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchAllCategories()
        return true
      } else {
        ElMessage.error(res.msg)
        return false
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      ElMessage.error('删除分类失败: ' + errMsg)
      return false
    }
  }

  return {
    list,
    expenseCategories,
    incomeCategories,
    loading,
    fetchAllCategories,
    createCategory,
    updateCategory,
    deleteCategory
  }
})
