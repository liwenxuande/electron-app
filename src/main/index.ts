import { app, BrowserWindow, shell, Notification, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { registerTransactionController } from './controller/transactionController'
import { registerCategoryController } from './controller/categoryController'
import { registerLedgerController } from './controller/ledgerController'
import { registerAIController } from './controller/aiController'
import { startMCPServer, stopMCPServer } from './mcp/mcp-server'
import DbManager from './db/database'
import { logger, initFileTransport } from './utils/logger'
import { initAILogTransport } from './utils/aiLogger'

// Windows 下修复控制台中文乱码（切换代码页为 UTF-8）
import { execSync } from 'child_process'
if (process.platform === 'win32') {
  try { execSync('chcp 65001', { stdio: 'ignore' }) } catch {}
  try { process.stdout.setEncoding('utf-8') } catch {}
  try { process.stderr.setEncoding('utf-8') } catch {}
}

// 设置应用名称和 Windows 通知标识（必须在 app.whenReady 之前）
app.setName('个人记账')
if (process.platform === 'win32' && app.isPackaged) {
  app.setAppUserModelId('com.electron.personal-finance')
}

/**
 * Electron 主进程入口
 * 启动顺序：显示启动动画 → 初始化日志 → 初始化数据库 → 注册IPC → 创建主窗口（后台加载）→ ready-to-show 后关闭动画显示主窗口
 */

// 单实例锁：只允许运行一个应用实例
if (!app.requestSingleInstanceLock()) {
  process.exit(0)
}

// 安全设置：不允许渲染进程直接使用 Node.js API
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let bootStart = 0

/** 创建启动动画窗口 */
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 280,
    frame: false,
    backgroundColor: '#E07800',
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 开发/生产模式加载 splash 页面
  if (process.env['ELECTRON_RENDERER_URL']) {
    splashWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/splash.html`)
  } else {
    splashWindow.loadFile(path.join(process.resourcesPath, 'splash.html'))
  }

  splashWindow.center()
}

/** 创建主窗口 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    title: '个人记账',
    show: false,            // 先隐藏，ready-to-show 后再显示
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'icon.ico')
      : path.join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      // 预加载脚本：在渲染进程中安全暴露API
      preload: path.join(__dirname, '../preload/index.mjs'),
      // 安全隔离：禁止渲染进程直接访问 Node API
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    frame: false,           // 无边框窗口，自定义标题栏
    backgroundColor: '#FFF8F0',
    autoHideMenuBar: true
  })

  // 窗口控制 IPC（最小化 / 最大化 / 关闭）
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
  ipcMain.handle('window:toggleDevTools', () => mainWindow?.webContents.toggleDevTools())

  // 防止窗口标题被页面 <title> 覆盖
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  // 最大化/还原时通知渲染进程切换图标
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximizeChange', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximizeChange', false))

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

  // 主窗口就绪后关闭启动动画
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
    mainWindow?.show()
    logger.info(`[启动耗时] 主窗口就绪: ${Date.now() - bootStart}ms`)
    // 开发模式自动打开 DevTools
    if (!app.isPackaged) {
      mainWindow?.webContents.openDevTools()
    }
  })

  logger.info('主窗口创建完成')
}

// ========== 应用生命周期 ==========

app.whenReady().then(() => {
  bootStart = Date.now()
  // ① 第一时间显示启动动画（避免白屏，必须在所有耗时操作之前）
  createSplashWindow()

  // ② 初始化文件日志（延迟，因 app.getPath 需 ready 后调用）
  initFileTransport()
  initAILogTransport()

  // ③ 初始化数据库（统一放 userData，升级不丢数据）
  const dbFile = app.isPackaged ? 'data.db' : 'data.dev.db'
  const dbDir = app.getPath('userData')
  fs.mkdirSync(dbDir, { recursive: true })
  const dbPath = path.join(dbDir, dbFile)

  // 迁移旧数据：如果安装目录下有旧 db 且 userData 下还没有，自动迁移
  if (app.isPackaged) {
    const oldDbPath = path.join(path.dirname(app.getPath('exe')), 'data', dbFile)
    if (fs.existsSync(oldDbPath) && !fs.existsSync(dbPath)) {
      fs.copyFileSync(oldDbPath, dbPath)
      logger.info('检测到旧版本数据，已自动迁移到 userData')
    }
  }

  DbManager.getInstance().init(dbPath)

  // ④ 注册 IPC 通信控制器
  registerCategoryController()
  registerLedgerController()
  registerTransactionController()
  registerAIController()

  // ⑤ 启动 MCP HTTP 服务（外部 AI 通过 mcp-agent.cjs → localhost:19527 访问）
  startMCPServer()

  // ⑥ 注册系统通知 IPC（测试用）
  ipcMain.handle('notification:show', (_event, title: string, body: string) => {
    try {
      const notif = new Notification({ title, body })
      notif.show()
      logger.info(`[IPC] notification:show 发送成功: ${title}`)
      return { code: 0, data: null, msg: '通知已发送' }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.error(`[IPC] notification:show 异常: ${errMsg}`)
      return { code: -1, data: null, msg: `通知失败: ${errMsg}` }
    }
  })

  // ⑦ 创建渲染窗口（后台加载）
  createWindow()

  // macOS：点击 dock 图标重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  logger.info('应用启动完成')
})

// 二次启动时将已有窗口提到最前
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// 所有窗口关闭时退出（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 退出前清理
app.on('before-quit', () => {
  stopMCPServer()
  logger.info('应用即将退出')
})
