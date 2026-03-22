import { spawn, ChildProcess } from 'child_process'
import { ipcMain, BrowserWindow } from 'electron'
import { EventEmitter } from 'events'
import { getConfig } from './config'

class ClaudeProcessManager extends EventEmitter {
  private process: ChildProcess | null = null
  private mainWindow: BrowserWindow | null = null
  private buffer: string = ''

  // 持久状态
  private workingFolder: string | null = null
  private permissionMode: 'plan' | 'acceptEdits' = 'plan'
  private sessionId: string | null = null

  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  setWorkingFolder(folder: string) {
    // 切换文件夹时重启进程
    const changed = this.workingFolder !== folder
    this.workingFolder = folder
    if (changed) {
      this.restartProcess()
    }
  }

  setPermissionMode(mode: 'plan' | 'acceptEdits') {
    const changed = this.permissionMode !== mode
    this.permissionMode = mode
    if (changed) {
      this.restartProcess()
    }
  }

  /**
   * 长连接模式：启动一次 claude 进程，保持 stdin 打开
   * 通过 stdin 发送 stream-json 消息，通过 stdout 接收回复
   * 这样 plan 模式的权限拦截能正常工作
   */
  private startProcess() {
    if (!this.workingFolder) return
    this.stop()

    const args = [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--permission-mode', this.permissionMode,
    ]

    if (this.sessionId) {
      args.push('--resume', this.sessionId)
    }

    const config = getConfig()
    const childEnv = { ...process.env }
    if (config) {
      childEnv.ANTHROPIC_BASE_URL = config.baseUrl
      childEnv.ANTHROPIC_API_KEY = config.apiKey
      childEnv.ANTHROPIC_MODEL = config.modelName
    }

    console.log('[ClaudeProcess] Starting long-lived process')
    console.log('[ClaudeProcess] Args:', args.join(' '))
    console.log('[ClaudeProcess] CWD:', this.workingFolder)
    console.log('[ClaudeProcess] Permission mode:', this.permissionMode)

    try {
      this.process = spawn('claude', args, {
        cwd: this.workingFolder,
        shell: true,
        env: childEnv,
      })

      this.buffer = ''
      this.sendToRenderer('claude:processStarted', { pid: this.process.pid })

      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        console.log('[ClaudeProcess] stdout chunk:', text.slice(0, 200))
        this.handleStdout(text)
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        console.error('[ClaudeProcess] stderr:', text)
        this.sendToRenderer('claude:stderr', text)
      })

      this.process.on('close', (code: number | null) => {
        console.log('[ClaudeProcess] exited with code:', code)
        this.sendToRenderer('claude:processExit', { code })
        this.process = null
      })

      this.process.on('error', (err: Error) => {
        console.error('[ClaudeProcess] spawn error:', err.message)
        this.sendToRenderer('claude:processError', { message: err.message })
        this.process = null
      })
    } catch (err) {
      this.sendToRenderer('claude:processError', {
        message: `Failed to start claude: ${err}`,
      })
    }
  }

  private restartProcess() {
    if (this.workingFolder) {
      this.startProcess()
    }
  }

  /**
   * 通过 stdin 发送用户消息（stream-json 格式）
   * 如果进程未启动，先启动
   */
  sendMessage(text: string) {
    if (!this.workingFolder) {
      this.sendToRenderer('claude:processError', { message: '请先选择工作文件夹' })
      return
    }

    // 如果进程不在运行，先启动
    if (!this.process) {
      this.startProcess()
      // 等进程启动后再发消息
      const waitAndSend = () => {
        if (this.process?.stdin) {
          this.writeUserMessage(text)
        } else {
          setTimeout(waitAndSend, 100)
        }
      }
      setTimeout(waitAndSend, 500)
      return
    }

    this.writeUserMessage(text)
  }

  private writeUserMessage(text: string) {
    if (!this.process?.stdin) return

    // stream-json stdin 格式：匹配输出格式结构
    const message = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text }],
      },
    })
    console.log('[ClaudeProcess] Sending via stdin:', message.slice(0, 100))
    this.process.stdin.write(message + '\n')
  }

  /** 发送权限审批响应 */
  sendPermissionResponse(requestId: string, allowed: boolean) {
    if (!this.process?.stdin) return

    const response = JSON.stringify({
      type: 'control_response',
      id: requestId,
      permission: allowed ? 'allow' : 'deny',
    })
    console.log('[ClaudeProcess] Sending permission response:', response)
    this.process.stdin.write(response + '\n')
  }

  stop() {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }

  /** 重置会话（新建任务） */
  resetSession() {
    this.sessionId = null
    this.restartProcess()
  }

  isRunning(): boolean {
    return this.process !== null
  }

  private handleStdout(data: string) {
    this.buffer += data
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const event = JSON.parse(trimmed)
        this.processEvent(event)
      } catch {
        this.sendToRenderer('claude:rawOutput', trimmed)
      }
    }
  }

  private processEvent(event: Record<string, unknown>) {
    const type = event.type as string

    // 提取 session_id 用于后续 --resume
    if (event.session_id && typeof event.session_id === 'string') {
      this.sessionId = event.session_id
    }

    switch (type) {
      case 'system':
        this.sendToRenderer('claude:init', event)
        break

      case 'assistant':
        this.sendToRenderer('claude:assistantMessage', event)
        break

      case 'user':
        // 工具执行结果
        this.sendToRenderer('claude:event', event)
        break

      case 'result':
        this.sendToRenderer('claude:result', event)
        break

      // 兼容增量 stream 事件
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

      default:
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

  ipcMain.handle('claude:setWorkingFolder', (_event, folder: string) => {
    manager.setWorkingFolder(folder)
    return true
  })

  ipcMain.handle('claude:setPermissionMode', (_event, mode: 'plan' | 'acceptEdits') => {
    manager.setPermissionMode(mode)
    return true
  })

  ipcMain.handle('claude:sendMessage', (_event, text: string) => {
    manager.sendMessage(text)
    return true
  })

  ipcMain.handle('claude:stop', () => {
    manager.stop()
    return true
  })

  ipcMain.handle('claude:resetSession', () => {
    manager.resetSession()
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
