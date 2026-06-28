<template>
  <el-dialog
    :model-value="visible"
    :title="mode === 'create' ? '新增人员' : '编辑人员'"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="80px"
      label-position="right"
    >
      <el-form-item label="姓名" prop="name">
        <el-input v-model="formData.name" placeholder="请输入姓名" maxlength="50" show-word-limit />
      </el-form-item>

      <el-form-item label="手机号" prop="phone">
        <el-input v-model="formData.phone" placeholder="请输入11位手机号" maxlength="11" />
      </el-form-item>

      <el-form-item label="地址" prop="address">
        <el-input
          v-model="formData.address"
          type="textarea"
          placeholder="请输入地址"
          :rows="3"
          maxlength="200"
          show-word-limit
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ mode === 'create' ? '确认新增' : '保存修改' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useUserStore } from '../stores/userStore'

/** 组件 Props */
const props = defineProps<{
  visible: boolean
  mode: 'create' | 'edit'
  editData: any | null
}>()

/** 组件 Emits */
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'success'): void
}>()

const store = useUserStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)

/** 表单数据 */
const formData = reactive({
  name: '',
  phone: '',
  address: ''
})

/**
 * 表单校验规则
 * 前端第一层校验，后端 service 层做第二层校验
 */
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { max: 50, message: '姓名不能超过50个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  address: [
    { required: true, message: '请输入地址', trigger: 'blur' },
    { max: 200, message: '地址不能超过200个字符', trigger: 'blur' }
  ]
}

/**
 * 监听弹窗打开：编辑模式回显数据；新增模式清空
 */
watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.mode === 'edit' && props.editData) {
        formData.name = props.editData.name || ''
        formData.phone = props.editData.phone || ''
        formData.address = props.editData.address || ''
      } else {
        formData.name = ''
        formData.phone = ''
        formData.address = ''
      }
      // 清除上次校验结果
      formRef.value?.resetFields()
    }
  }
)

/** 提交表单 */
async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (props.mode === 'create') {
      const ok = await store.createUser({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim()
      })
      if (ok) emit('success')
    } else {
      const ok = await store.updateUser(props.editData.id, {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim()
      })
      if (ok) emit('success')
    }
  } finally {
    submitting.value = false
  }
}

/** 关闭弹窗 */
function handleClose() {
  emit('update:visible', false)
}
</script>
