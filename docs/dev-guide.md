# 二次开发指南

> 基于本脚手架添加业务功能的完整流程。以加一张 `department`（部门）表为例，走完所有步骤。

---

## 一、加一张新表（以 department 为例）

假设要加一个「部门管理」功能，新建表 `department`：

```sql
CREATE TABLE IF NOT EXISTS department (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  manager     TEXT    NOT NULL,
  create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
)
```

### 步骤 1：DB 底层 —— 建表

[src/main/db/database.ts](../src/main/db/database.ts)

在 `init()` 方法的 `exec()` 里追加建表语句：

```ts
init(dbPath: string): void {
  this.db = new Database(dbPath)
  this.db.pragma('journal_mode = WAL')

  this.db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      phone       TEXT    NOT NULL,
      address     TEXT    NOT NULL,
      create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );

    -- 新增 ↓
    CREATE TABLE IF NOT EXISTS department (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      manager     TEXT    NOT NULL,
      create_time TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)
  // ...
}
```

以后每次启动，如果表不存在就自动创建。

### 步骤 2：Repository 仓储层

新建 `src/main/repository/departmentRepository.ts`：

```ts
import DbManager from '../db/database'

export interface DepartmentRow {
  id: number
  name: string
  manager: string
  create_time: string
}

export interface PaginatedResult {
  list: DepartmentRow[]
  total: number
}

export class DepartmentRepository {
  private db: DbManager

  constructor(db: DbManager) {
    this.db = db
  }

  insert(name: string, manager: string, createTime: string) {
    return this.db.getDb().prepare(`
      INSERT INTO department (name, manager, create_time) VALUES (?, ?, ?)
    `).run(name, manager, createTime)
  }

  selectById(id: number): DepartmentRow | undefined {
    return this.db.get<DepartmentRow>(
      'SELECT * FROM department WHERE id = ?', [id]
    )
  }

  selectList(searchName: string, page: number, pageSize: number): PaginatedResult {
    const offset = (page - 1) * pageSize
    const like = `%${searchName}%`

    const totalRow = this.db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM department WHERE name LIKE ?`, [like]
    )
    const total = totalRow?.count ?? 0
    const list = this.db.all<DepartmentRow>(
      `SELECT * FROM department WHERE name LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [like, pageSize, offset]
    )
    return { list, total }
  }

  update(id: number, name: string, manager: string) {
    return this.db.getDb().prepare(
      `UPDATE department SET name = ?, manager = ? WHERE id = ?`
    ).run(name, manager, id)
  }

  deleteById(id: number) {
    return this.db.getDb().prepare('DELETE FROM department WHERE id = ?').run(id)
  }
}
```

**关键约定**：
- 构造函数接收 `DbManager`（依赖注入）
- 只写 SQL，不写校验、事务
- 查询类方法返回类型明确

### 步骤 3：Service 业务层

新建 `src/main/service/departmentService.ts`：

```ts
import dayjs from 'dayjs'
import { DepartmentRepository } from '../repository/departmentRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'

interface ApiResponse<T = any> {
  code: number
  data: T
  msg: string
}

export interface DepartmentInput {
  name: string
  manager: string
}

export class DepartmentService {
  private repository: DepartmentRepository
  private dbManager: DbManager

  constructor(repository: DepartmentRepository, dbManager: DbManager) {
    this.repository = repository
    this.dbManager = dbManager
  }

  validate(input: DepartmentInput): string | null {
    if (!input.name?.trim()) return '部门名称不能为空'
    if (input.name.length > 50) return '部门名称不能超过50个字符'
    if (!input.manager?.trim()) return '负责人不能为空'
    if (input.manager.length > 50) return '负责人不能超过50个字符'
    return null
  }

  private ok<T>(data: T, msg = '操作成功'): ApiResponse<T> {
    return { code: 0, data, msg }
  }
  private fail(msg: string): ApiResponse<null> {
    return { code: -1, data: null, msg }
  }

  async create(input: DepartmentInput): Promise<ApiResponse> {
    const err = this.validate(input)
    if (err) return this.fail(err)
    try {
      const time = dayjs().format('YYYY-MM-DD HH:mm:ss')
      await this.dbManager.transaction(() => {
        this.repository.insert(input.name.trim(), input.manager.trim(), time)
      })
      logger.info(`Created department: ${input.name}`)
      return this.ok(null, '新增成功')
    } catch (e: any) {
      logger.error(`Failed to create department: ${e.message}`)
      return this.fail(`新增失败: ${e.message}`)
    }
  }

  async update(id: number, input: DepartmentInput): Promise<ApiResponse> {
    const err = this.validate(input)
    if (err) return this.fail(err)
    try {
      if (!this.repository.selectById(id)) return this.fail('该部门不存在')
      await this.dbManager.transaction(() => {
        this.repository.update(id, input.name.trim(), input.manager.trim())
      })
      return this.ok(null, '编辑成功')
    } catch (e: any) {
      return this.fail(`编辑失败: ${e.message}`)
    }
  }

  async delete(id: number): Promise<ApiResponse> {
    try {
      if (!this.repository.selectById(id)) return this.fail('该部门不存在')
      await this.dbManager.run('DELETE FROM department WHERE id = ?', [id])
      return this.ok(null, '删除成功')
    } catch (e: any) {
      return this.fail(`删除失败: ${e.message}`)
    }
  }

  getList(params: { searchName?: string; page?: number; pageSize?: number }): ApiResponse {
    try {
      const result = this.repository.selectList(
        params.searchName || '', params.page || 1, params.pageSize || 10
      )
      return this.ok(result, '查询成功')
    } catch (e: any) {
      return this.fail(`查询失败: ${e.message}`)
    }
  }
}
```

**关键约定**：
- 前端传什么字段就校验什么，不信任任何输入
- 新增/编辑走 `dbManager.transaction()`
- 删除走 `dbManager.run()`（单条语句不需要事务）
- 统一 `{code: 0|-1, data, msg}` 返回

### 步骤 4：Controller 控制器层

新建 `src/main/controller/departmentController.ts`：

```ts
import { ipcMain } from 'electron'
import { DepartmentService, DepartmentInput } from '../service/departmentService'
import { DepartmentRepository } from '../repository/departmentRepository'
import DbManager from '../db/database'
import { logger } from '../utils/logger'

export function registerDepartmentController(): void {
  const db = DbManager.getInstance()
  const repository = new DepartmentRepository(db)
  const service = new DepartmentService(repository, db)

  ipcMain.handle('department:list', async (_e, params) => {
    try { return service.getList(params) }
    catch (e: any) { return { code: -1, data: null, msg: `系统异常: ${e.message}` } }
  })

  ipcMain.handle('department:create', async (_e, data: DepartmentInput) => {
    try { return await service.create(data) }
    catch (e: any) { return { code: -1, data: null, msg: `系统异常: ${e.message}` } }
  })

  ipcMain.handle('department:update', async (_e, id: number, data: DepartmentInput) => {
    try { return await service.update(id, data) }
    catch (e: any) { return { code: -1, data: null, msg: `系统异常: ${e.message}` } }
  })

  ipcMain.handle('department:delete', async (_e, id: number) => {
    try { return await service.delete(id) }
    catch (e: any) { return { code: -1, data: null, msg: `系统异常: ${e.message}` } }
  })

  logger.info('Department IPC controller registered')
}
```

然后在 `src/main/index.ts` 中注册：

```ts
import { registerDepartmentController } from './controller/departmentController'

// 在 app.whenReady() 里，registerUserController() 后面加：
registerDepartmentController()
```

### 步骤 5：Preload 桥接

在 [src/preload/index.ts](../src/preload/index.ts) 的 `contextBridge.exposeInMainWorld` 对象里追加：

```ts
contextBridge.exposeInMainWorld('userAPI', {
  // ... 原有 user API ...

  // 新增 ↓
  getDepartmentList: (params) => ipcRenderer.invoke('department:list', params),
  createDepartment: (data) => ipcRenderer.invoke('department:create', data),
  updateDepartment: (id, data) => ipcRenderer.invoke('department:update', id, data),
  deleteDepartment: (id) => ipcRenderer.invoke('department:delete', id),
})
```

同时在 [src/renderer/src/env.d.ts](../src/renderer/src/env.d.ts) 的 `UserAPI` 接口中补充类型：

```ts
interface UserAPI {
  // ... 原有方法 ...
  getDepartmentList(params: ListParams): Promise<ApiResponse<PaginatedResult>>
  createDepartment(data: DepartmentInput): Promise<ApiResponse<null>>
  updateDepartment(id: number, data: DepartmentInput): Promise<ApiResponse<null>>
  deleteDepartment(id: number): Promise<ApiResponse<null>>
}
```

### 步骤 6：Pinia Store

新建 `src/renderer/src/stores/departmentStore.ts`（仿照 userStore.ts）：

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

interface DeptRow { id: number; name: string; manager: string; create_time: string }

export const useDepartmentStore = defineStore('department', () => {
  const list = ref<DeptRow[]>([])
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(10)
  const searchName = ref('')
  const loading = ref(false)

  async function fetchList() {
    loading.value = true
    try {
      const res = await window.userAPI.getDepartmentList({
        searchName: searchName.value, page: currentPage.value, pageSize: pageSize.value
      })
      if (res.code === 0) {
        list.value = res.data.list
        total.value = res.data.total
      } else {
        ElMessage.error(res.msg)
      }
    } catch (e: any) {
      ElMessage.error('查询失败: ' + e.message)
    } finally {
      loading.value = false
    }
  }

  async function create(data: { name: string; manager: string }) {
    const res = await window.userAPI.createDepartment(data)
    if (res.code === 0) { ElMessage.success(res.msg); await fetchList(); return true }
    else { ElMessage.error(res.msg); return false }
  }

  async function update(id: number, data: { name: string; manager: string }) {
    const res = await window.userAPI.updateDepartment(id, data)
    if (res.code === 0) { ElMessage.success(res.msg); await fetchList(); return true }
    else { ElMessage.error(res.msg); return false }
  }

  async function remove(id: number) {
    const res = await window.userAPI.deleteDepartment(id)
    if (res.code === 0) { ElMessage.success(res.msg); await fetchList() }
    else ElMessage.error(res.msg)
  }

  return { list, total, currentPage, pageSize, searchName, loading, fetchList, create, update, remove }
})
```

### 步骤 7：Vue 页面

新建 `src/renderer/src/views/DepartmentList.vue`，仿照 UserList.vue 套用表格+弹窗模板。核心改动：表格列改为 name, manager，表单字段改为部门名称 + 负责人。

### 步骤 8：接入 App.vue

```vue
<!-- src/renderer/src/App.vue -->
<template>
  <div id="app-root">
    <TitleBar />
    <div class="app-body">
      <UserList />           <!-- 已有 -->
      <DepartmentList />     <!-- 新增 -->
    </div>
  </div>
</template>
```

如果需要页面切换而非同屏展示，引入 `vue-router`，但轻量场景直接在 App.vue 用一个 tab 切换就够了。

---

## 二、加一个 IPC 通道（模板）

不是所有 IPC 都走四层。像窗口控制、系统通知这类不操作数据库的通道，直接在 `main/index.ts` 注册即可：

```ts
// main — 注册
ipcMain.handle('my-feature:doSomething', async (_event, param: string) => {
  try {
    // 业务逻辑
    const result = doSomething(param)
    return { code: 0, data: result, msg: '成功' }
  } catch (e: any) {
    return { code: -1, data: null, msg: `失败: ${e.message}` }
  }
})

// preload — 暴露
doSomething: (param: string) => ipcRenderer.invoke('my-feature:doSomething', param),

// renderer — 调用
const res = await window.userAPI.doSomething('hello')
```

**约定**：命名用 `模块:动作` 格式（如 `user:list`、`window:minimize`）。

---

## 三、加一个新页面

1. 在 `src/renderer/src/views/` 下新建 `.vue` 文件
2. 如需 Pinia store，在 `src/renderer/src/stores/` 新建
3. 在 `App.vue` 中 `import` 并注册到 `<template>`
4. 无需手动配路由（目前无 vue-router，直接在 App.vue 组合组件）

---

## 四、前端开发约定

### Pinia Store 写法模板

```ts
export const useXxxStore = defineStore('xxx', () => {
  // state：用 ref 声明
  const list = ref<XxxRow[]>([])
  const loading = ref(false)

  // action：async function，调 window.userAPI.xxx()
  async function fetchList() {
    loading.value = true
    try {
      const res = await window.userAPI.getXxxList(params)
      if (res.code === 0) { /* 成功处理 */ }
      else { ElMessage.error(res.msg) }
    } catch (e: any) {
      ElMessage.error('操作失败: ' + e.message)
    } finally {
      loading.value = false
    }
  }

  return { list, loading, fetchList }  // 组合式 API 返回
})
```

### 表单校验写法

```ts
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入名称', trigger: 'blur' },
    { max: 50, message: '不能超过50个字符', trigger: 'blur' }
  ]
}
```

前端校验是用户体验，后端 service 层校验是安全保障。两者都不可少。

### 消息提示

```ts
import { ElMessage, ElMessageBox } from 'element-plus'

ElMessage.success('新增成功')
ElMessage.error(res.msg)
ElMessageBox.confirm('确定删除？', '确认', { type: 'warning' }).then(() => { /* 执行删除 */ })
```

---

## 五、常见扩展场景

### 导入导出 Excel

- 安装 `exceljs`（主进程依赖，读/写 .xlsx）
- 在主进程写解析逻辑，通过 IPC 暴露给渲染进程
- 导出时生成文件 → `dialog.showSaveDialog` 选路径 → `fs.writeFile`

### 系统托盘

```ts
import { Tray, Menu } from 'electron'

const tray = new Tray(iconPath)
tray.setToolTip('人员管理系统')
tray.setContextMenu(Menu.buildFromTemplate([
  { label: '显示窗口', click: () => mainWindow.show() },
  { label: '退出', click: () => app.quit() }
]))

// 点击托盘图标显示窗口
tray.on('click', () => mainWindow.show())

// 关闭窗口时隐藏到托盘而不是退出
mainWindow.on('close', (e) => {
  e.preventDefault()
  mainWindow.hide()
})
```

### 自动更新

- 安装 `electron-updater`
- 需要代码签名证书（Windows 每年 $300+）才能正常使用
- 小项目内部分发建议手动打包更新，省去证书成本

### 换图标 / 改应用名

1. 替换 `build/icon.ico` 和 `build/icon.icns`
2. 改 `electron-builder.yml` 中的 `appId`、`productName`、`executableName`
3. 改 `package.json` 的 `name`
4. 改 `main/index.ts` 中 `app.setName()` 和 `app.setAppUserModelId()`

---

## 六、打包发布 Checklist

- [ ] `package.json`：改 `name`、`version`
- [ ] `electron-builder.yml`：改 `appId`、`productName`、`executableName`
- [ ] `electron-builder.yml`：确认 `icon` 路径指向你的 .ico/.icns
- [ ] `main/index.ts`：`app.setAppUserModelId()` 与 `appId` 一致
- [ ] `build/icon.ico` 已替换（≥256×256）
- [ ] `build/icon.icns` 已替换（macOS 专用）
- [ ] 测试过 `pnpm dev` 正常
- [ ] 执行 `pnpm package:win`，输出在 `release/`
- [ ] 安装测试：卸载旧版 → 安装新版 → 数据库不丢
