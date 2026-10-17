import { app } from 'electron'
import path from 'path'

export function getDataDir(): string {
  return app.getPath('userData')
}

export function getDbPath(): string {
  return path.join(getDataDir(), app.isPackaged ? 'data.db' : 'data.dev.db')
}

export function getConfigPath(): string {
  return path.join(getDataDir(), 'config.json')
}

export function getMcpAgentPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources', 'mcp-agent.cjs')
    : path.join(app.getAppPath(), 'resources', 'mcp-agent.cjs')
}
