<template>
  <el-table :data="categories" border stripe size="small" max-height="300">
    <el-table-column prop="name" label="名称" min-width="120" />
    <el-table-column label="操作" width="120" align="center">
      <template #default="{ row }">
        <el-button size="small" link type="primary" @click="$emit('edit', row)">编辑</el-button>
        <el-button size="small" link type="danger" @click="$emit('delete', row)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
defineProps<{
  categories: { id: number; name: string }[]
}>()

defineEmits<{
  (e: 'edit', row: { id: number; name: string }): void
  (e: 'delete', row: { id: number; name: string }): void
}>()
</script>
