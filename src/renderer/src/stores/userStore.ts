import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

/** 用户数据行 */
interface UserRow {
  id: number
  name: string
  phone: string
  address: string
  create_time: string
}

/**
 * Pinia 状态管理 —— 用户模块
 * 封装所有API调用，管理列表分页和搜索状态
 */
export const useUserStore = defineStore('user', () => {
  // ===== 状态 =====
  const list = ref<UserRow[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(10)
  const searchName = ref('')
  const loading = ref(false)

  // ===== 操作 =====

  /** 查询用户列表（分页 + 模糊搜索） */
  async function fetchUserList() {
    loading.value = true
    try {
      const res = await window.userAPI.getUserList({
        searchName: searchName.value,
        page: currentPage.value,
        pageSize: pageSize.value
      })
      if (res.code === 0) {
        list.value = res.data.list
        total.value = res.data.total
      } else {
        ElMessage.error(res.msg)
      }
    } catch (error: any) {
      ElMessage.error('查询失败: ' + error.message)
    } finally {
      loading.value = false
    }
  }

  /** 新增用户 */
  async function createUser(data: { name: string; phone: string; address: string }) {
    try {
      const res = await window.userAPI.createUser(data)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchUserList()
        return true
      } else {
        ElMessage.error(res.msg)
        return false
      }
    } catch (error: any) {
      ElMessage.error('新增失败: ' + error.message)
      return false
    }
  }

  /** 编辑用户 */
  async function updateUser(id: number, data: { name: string; phone: string; address: string }) {
    try {
      const res = await window.userAPI.updateUser(id, data)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchUserList()
        return true
      } else {
        ElMessage.error(res.msg)
        return false
      }
    } catch (error: any) {
      ElMessage.error('编辑失败: ' + error.message)
      return false
    }
  }

  /** 删除用户 */
  async function deleteUser(id: number) {
    try {
      const res = await window.userAPI.deleteUser(id)
      if (res.code === 0) {
        ElMessage.success(res.msg)
        await fetchUserList()
      } else {
        ElMessage.error(res.msg)
      }
    } catch (error: any) {
      ElMessage.error('删除失败: ' + error.message)
    }
  }

  /** 搜索（重置到第一页） */
  async function search(keyword: string) {
    searchName.value = keyword
    currentPage.value = 1
    await fetchUserList()
  }

  /** 切换页码 */
  async function goPage(page: number) {
    currentPage.value = page
    await fetchUserList()
  }

  return {
    // 状态
    list,
    total,
    currentPage,
    pageSize,
    searchName,
    loading,
    // 操作
    fetchUserList,
    createUser,
    updateUser,
    deleteUser,
    search,
    goPage
  }
})
