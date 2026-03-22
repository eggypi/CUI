import { spawn, ChildProcess } from 'child_process'
import { ipcMain, BrowserWindow } from 'electron'
import { EventEmitter } from 'events'

interface ClaudeProcessOptions {
  workingFolder: string
  permissionMode: 'plan' | 'acceptEdits'
  sessionId?: string
}

class ClaudeProcessManager extends EventEmitter {
  private process: ChildProcess | null = null
  private mainWindow: BrowserWindow | null = null
  private currentOptions: ClaudeProcessOptions | null = null
  private buffer: string = ''

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  start(options: ClaudeProcessOptions) {
    this.stop()
    this.currentOptions = options

    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--permission-mode', options.permissionMode,
    ]

    if (options.sessionId) {
      args.push('--resume', options.sessionId)
    }

    try {
      this.process = spawn('claude', args, {
        cwd: options.workingFolder,
        shell: true,
        env: { ...process.env },
      })

      this.buffer = ''

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleStdout(data.toString())
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        this.sendToRenderer('claude:stderr', data.toString())
      })

      this.process.on('close', (code: number | null) => {
        this.sendToRenderer('claude:processExit', { code })
        this.process = null
      })

      this.process.on('error', (err: Error) => {
        this.sendToRenderer('claude:processError', { message: err.message })
        this.process = null
      })

      this.sendToRenderer('claude:processStarted', { pid: this.process.pid })
    } catch (err) {
      this.sendToRenderer('claude:processError', {
        message: `Failed to start claude: ${err}`,
      })
    }
  }

  stop() {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }

  restart() {
    if (this.currentOptions) {
      this.start(this.currentOptions)
    }
  }

  sendMessage(text: string) {
    if (!this.process?.stdin) return

    const message = JSON.stringify({
      type: 'user_message',
      message: {
        role: 'user',
        content: text,
      },
    })
    this.process.stdin.write(message + '\n')
  }

  sendPermissionResponse(requestId: string, allowed: boolean) {
    if (!this.process?.stdin) return

    const response = JSON.stringify({
      type: 'control_response',
      id: requestId,
      permission: allowed ? 'allow' : 'deny',
    })
    this.process.stdin.write(response + '\n')
  }

  isRunning(): boolean {
    return this.process !== null
  }

  private handleStdout(data: string) {
    this.buffer += data
    const lines = this.buffer.split('\n')
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const event = JSON.parse(trimmed)
        this.processEvent(event)
      } catch {
        // Not JSON, forward as raw text
        this.sendToRenderer('claude:rawOutput', trimmed)
      }
    }
  }

  private processEvent(event: Record<string, unknown>) {
    const type = event.type as string

    switch (type) {
      case 'init':
        this.sendToRenderer('claude:init', event)
        break

      case 'message_start':
        this.sendToRenderer('claude:messageStart', event)
        break

      case 'content_block_start':
        this.sendToRenderer('claude:contentBlockStart', event)
        break

      case 'content_block_delta':
        this.sendToRenderer('claude:contentBlockDelta', event)
        break

      case 'content_block_stop':
        this.sendToRenderer('claude:contentBlockStop', event)
        break

      case 'message_delta':
        this.sendToRenderer('claude:messageDelta', event)
        break

      case 'result':
        this.sendToRenderer('claude:result', event)
        break

      default:
        // Check for permission/control events
        if (type === 'control' || type === 'permission_request') {
          this.sendToRenderer('claude:permissionRequest', {
            id: event.id || `perm-${Date.now()}`,
            toolName: event.tool_name || event.name || 'unknown',
            command: event.command,
            filePath: event.file_path,
            description: event.description || `${event.tool_name || 'Tool'} 请求权限`,
            timestamp: Date.now(),
          })
        } else {
          this.sendToRenderer('claude:event', event)
        }
    }
  }

  private sendToRenderer(channel: string, data: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}

const manager = new ClaudeProcessManager()

export function registerClaudeProcessHandlers(mainWindow: BrowserWindow) {
  manager.setMainWindow(mainWindow)

  ipcMain.handle('claude:start', (_event, options: ClaudeProcessOptions) => {
    manager.start(options)
    return true
  })

  ipcMain.handle('claude:stop', () => {
    manager.stop()
    return true
  })

  ipcMain.handle('claude:restart', () => {
    manager.restart()
    return true
  })

  ipcMain.handle('claude:sendMessage', (_event, text: string) => {
    manager.sendMessage(text)
    return true
  })

  ipcMain.handle('claude:permissionResponse', (_event, data: { requestId: string; allowed: boolean }) => {
    manager.sendPermissionResponse(data.requestId, data.allowed)
    return true
  })

  ipcMain.handle('claude:isRunning', () => {
    return manager.isRunning()
  })

  ipcMain.handle('claude:getSkills', async () => {
    // Try to get skills from claude CLI
    return new Promise((resolve) => {
      try {
        const proc = spawn('claude', ['skills', '--output-format', 'json'], {
          shell: true,
          timeout: 10000,
        })
        let output = ''
        proc.stdout?.on('data', (data: Buffer) => { output += data.toString() })
        proc.on('close', () => {
          try {
            const skills = JSON.parse(output)
            resolve(Array.isArray(skills) ? skills : [])
          } catch {
            resolve([])
          }
        })
        proc.on('error', () => resolve([]))
      } catch {
        resolve([])
      }
    })
  })

  ipcMain.handle('claude:getSessions', async () => {
    return new Promise((resolve) => {
      try {
        const proc = spawn('claude', ['sessions', '--output-format', 'json'], {
          shell: true,
          timeout: 10000,
        })
        let output = ''
        proc.stdout?.on('data', (data: Buffer) => { output += data.toString() })
        proc.on('close', () => {
          try {
            const sessions = JSON.parse(output)
            resolve(Array.isArray(sessions) ? sessions : [])
          } catch {
            resolve([])
          }
        })
        proc.on('error', () => resolve([]))
      } catch {
        resolve([])
      }
    })
  })
}

export function getProcessManager() {
  return manager
}
