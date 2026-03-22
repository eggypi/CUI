import { ipcMain } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CLAUDE_DIR = join(homedir(), '.claude')
const SETTINGS_PATH = join(CLAUDE_DIR, 'settings.json')
const CLAUDE_JSON_PATH = join(CLAUDE_DIR, '.claude.json')

interface AppConfig {
  baseUrl: string
  modelName: string
  apiKey: string
}

async function ensureClaudeDir() {
  if (!existsSync(CLAUDE_DIR)) {
    await mkdir(CLAUDE_DIR, { recursive: true })
  }
}

async function readJsonFile(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

async function checkConfig(): Promise<boolean> {
  try {
    const settings = await readJsonFile(SETTINGS_PATH)
    const env = settings.env as Record<string, string> | undefined
    return !!(env?.ANTHROPIC_BASE_URL)
  } catch {
    return false
  }
}

async function saveConfig(config: AppConfig): Promise<void> {
  await ensureClaudeDir()

  // Update settings.json
  const settings = await readJsonFile(SETTINGS_PATH)
  if (!settings.env) settings.env = {}
  const env = settings.env as Record<string, string>
  env.ANTHROPIC_BASE_URL = config.baseUrl
  env.ANTHROPIC_MODEL = config.modelName
  env.ANTHROPIC_API_KEY = config.apiKey
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')

  // Update .claude.json
  const claudeJson = await readJsonFile(CLAUDE_JSON_PATH)
  claudeJson.model = config.modelName
  await writeFile(CLAUDE_JSON_PATH, JSON.stringify(claudeJson, null, 2), 'utf-8')
}

async function loadConfig(): Promise<AppConfig | null> {
  try {
    const settings = await readJsonFile(SETTINGS_PATH)
    const env = settings.env as Record<string, string> | undefined
    if (!env?.ANTHROPIC_BASE_URL) return null
    return {
      baseUrl: env.ANTHROPIC_BASE_URL || '',
      modelName: env.ANTHROPIC_MODEL || '',
      apiKey: env.ANTHROPIC_API_KEY || '',
    }
  } catch {
    return null
  }
}

export function registerConfigHandlers() {
  ipcMain.handle('config:check', () => checkConfig())
  ipcMain.handle('config:save', (_event, config: AppConfig) => saveConfig(config))
  ipcMain.handle('config:load', () => loadConfig())
}
