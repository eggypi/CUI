import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { registerConfigHandlers } from './config'
import { registerClaudeProcessHandlers } from './claude-process'
import { registerDocPreviewHandlers } from './doc-preview'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#e0e0e0',
      height: 36,
    },
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'bottom' })
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }

  // Register IPC handlers that need mainWindow
  registerClaudeProcessHandlers(mainWindow)
}

// IPC: Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

app.whenReady().then(() => {
  // 在 app ready 之后注册，确保 app.getPath('userData') 可用
  registerConfigHandlers()
  registerDocPreviewHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
