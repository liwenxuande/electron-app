import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { registerUserController } from './controller/userController'
import DbManager from './db/database'
import { logger, initFileTransport } from './utils/logger'

/**
 * Electron 主进程入口
 * 启动顺序：初始化数据库 → 注册IPC控制器 → 创建渲染窗口
 */

// 安全设置：不允许渲染进程直接使用 Node.js API
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

let mainWindow: BrowserWindow | null = null

/** 创建主窗口 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: '人员管理系统',
    webPreferences: {
      // 预加载脚本：在渲染进程中安全暴露API
      preload: path.join(__dirname, '../preload/index.js'),
      // 安全隔离：禁止渲染进程直接访问 Node API
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 防止窗口标题被页面 <title> 覆盖
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  // 外部链接使用系统默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 根据运行模式加载页面
  if (process.env['ELECTRON_RENDERER_URL']) {
    // 开发模式：加载 vite dev server
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    // 生产模式：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  logger.info('主窗口创建完成')
}

// ========== 应用生命周期 ==========

app.whenReady().then(() => {
  // ① 初始化文件日志（延迟，因 app.getPath 需 ready 后调用）
  initFileTransport()

  // ② 初始化数据库（全局单例，路径为 userData/data.db）
  const dbPath = path.join(app.getPath('userData'), 'data.db')
  DbManager.getInstance().init(dbPath)

  // ③ 注册 IPC 通信控制器
  registerUserController()

  // ④ 创建渲染窗口
  createWindow()

  // macOS：点击 dock 图标重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  logger.info('应用启动完成')
})

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 退出前清理
app.on('before-quit', () => {
  logger.info('应用即将退出')
})
