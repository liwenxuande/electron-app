<template>
  <div class="user-list-container">
    <!-- 操作栏：搜索 + 新增 -->
    <div class="toolbar">
      <div class="search-bar">
        <el-input
          v-model="keyword"
          placeholder="请输入姓名搜索"
          clearable
          style="width: 260px"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" @click="handleSearch">搜索</el-button>
      </div>
      <el-button type="primary" @click="handleCreate">新增人员</el-button>
      <el-button type="warning" @click="handleTestNotify">🔔 系统通知测试</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table
      :data="store.list"
      v-loading="store.loading"
      border
      stripe
      style="width: 100%; flex: 1"
      empty-text="暂无数据"
    >
      <el-table-column prop="id" label="ID" width="70" align="center" />
      <el-table-column prop="name" label="姓名" min-width="120" />
      <el-table-column prop="phone" label="手机号" min-width="140" />
      <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip />
      <el-table-column prop="create_time" label="创建时间" width="170" />
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button size="small" link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="store.currentPage"
        v-model:page-size="store.pageSize"
        :total="store.total"
        :page-sizes="[5, 10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="handlePageChange"
        @size-change="handlePageChange"
      />
    </div>

    <!-- 新增/编辑弹窗 -->
    <UserDialog
      v-model:visible="dialogVisible"
      :mode="dialogMode"
      :editData="currentEditData"
      @success="handleDialogSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useUserStore } from '../stores/userStore'
import UserDialog from '../components/UserDialog.vue'

const store = useUserStore()

const keyword = ref('')

/** 弹窗相关状态 */
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const currentEditData = ref<any>(null)

/** 页面初始化：加载列表 */
onMounted(() => {
  store.fetchUserList()
})

/** 搜索 */
function handleSearch() {
  store.search(keyword.value)
}

/** 新增 */
function handleCreate() {
  dialogMode.value = 'create'
  currentEditData.value = null
  dialogVisible.value = true
}

/** 编辑（回显选中行数据） */
function handleEdit(row: any) {
  dialogMode.value = 'edit'
  currentEditData.value = { ...row }
  dialogVisible.value = true
}

/** 删除（二次确认） */
function handleDelete(row: any) {
  ElMessageBox.confirm(`确定要删除【${row.name}】吗？此操作不可恢复。`, '删除确认', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      store.deleteUser(row.id)
    })
    .catch(() => {
      // 用户取消
    })
}

/** 分页切换 */
function handlePageChange() {
  store.fetchUserList()
}

/** 测试系统通知 */
async function handleTestNotify() {
  const res = await window.userAPI.showNotification('测试通知', `这是一条来自 Electron 的系统消息\n时间: ${new Date().toLocaleTimeString()}`)
  if (res.code === 0) {
    ElMessage.success('系统通知已发送')
  } else {
    ElMessage.error(res.msg)
  }
}

/** 弹窗操作成功后刷新列表 */
function handleDialogSuccess() {
  dialogVisible.value = false
  store.fetchUserList()
}
</script>

<style scoped>
.user-list-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
  overflow: hidden;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-bar {
  display: flex;
  gap: 10px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 10px 0;
}
</style>
