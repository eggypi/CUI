import { app, ipcMain } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

// 本地隔离配置：存在 Electron userData 目录，不影响全局 ~/.claude/
const CONFIG_DIR = join(app.getPath('userData'), 'config')
const CONFIG_PATH = join(CONFIG_DIR, 'connection.json')

export interface AppConfig {
  baseUrl: string
  modelName: string
  apiKey: string
}

// 运行时缓存，供 claude-process.ts 读取
let cachedConfig: AppConfig | null = null

async function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true })
  }
}

async function checkConfig(): Promise<boolean> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content) as AppConfig
    cachedConfig = config
    return !!(config.baseUrl && config.apiKey)
  } catch {
    return false
  }
}

async function saveConfig(config: AppConfig): Promise<void> {
  await ensureConfigDir()
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
  cachedConfig = config
}

async function loadConfig(): Promise<AppConfig | null> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content) as AppConfig
    cachedConfig = config
    return config
  } catch {
    return null
  }
}

/** 供 claude-process.ts 获取当前配置，注入到子进程环境变量 */
export function getConfig(): AppConfig | null {
  return cachedConfig
}

export function registerConfigHandlers() {
  ipcMain.handle('config:check', () => checkConfig())
  ipcMain.handle('config:save', (_event, config: AppConfig) => saveConfig(config))
  ipcMain.handle('config:load', () => loadConfig())
}
