import winston from 'winston'
import path from 'path'
import fs from 'fs'
import * as electron from 'electron/main'
const { app } = electron

/**
 * winston 日志模块
 * 同时输出到控制台和本地文件，记录SQL语句与业务报错
 * 注意：文件传输在 app.whenReady() 后由 initFileTransport() 延迟初始化
 */

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`
    })
  ),
  transports: [
    // 控制台输出（立即可用）
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `[${timestamp}] [${level}] ${message}`
        })
      )
    })
  ]
})

/** 延迟初始化文件日志传输（需在 app.whenReady 之后调用） */
export function initFileTransport(): void {
  const logsDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logsDir, { recursive: true })

  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    })
  )
}

export { logger }
