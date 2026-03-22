import { useState, useEffect, useCallback, useRef } from 'react'
import { ChatMessage, ChatContent, FileModification } from '@shared/types'

interface UseClaudeProcessReturn {
  messages: ChatMessage[]
  fileModifications: FileModification[]
  isRunning: boolean
  sendMessage: (text: string) => void
  clearMessages: () => void
}

export function useClaudeProcess(): UseClaudeProcessReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [fileModifications, setFileModifications] = useState<FileModification[]>([])
  const [isRunning, setIsRunning] = useState(false)

  // Track current assistant message being streamed
  const currentAssistantMsg = useRef<ChatMessage | null>(null)
  const currentContentBlocks = useRef<Map<number, ChatContent>>(new Map())

  const flushAssistantMessage = useCallback(() => {
    if (currentAssistantMsg.current) {
      const blocks = Array.from(currentContentBlocks.current.entries())
        .sort(([a], [b]) => a - b)
        .map(([, block]) => block)

      const msg = { ...currentAssistantMsg.current, content: blocks }
      setMessages(prev => {
        const existing = prev.findIndex(m => m.id === msg.id)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = msg
          return updated
        }
        return [...prev, msg]
      })
    }
  }, [])

  useEffect(() => {
    const handlers: Record<string, (...args: unknown[]) => void> = {
      'claude:init': () => {
        // session_id is now tracked by main process
      },

      // --print --verbose 模式：收到完整的 assistant 消息
      'claude:assistantMessage': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        const message = event.message as Record<string, unknown>
        if (!message) return

        const contentArr = message.content as Array<Record<string, unknown>>
        if (!contentArr || !Array.isArray(contentArr)) return

        const chatContent: ChatContent[] = []
        for (const block of contentArr) {
          if (block.type === 'text') {
            chatContent.push({ type: 'text', text: block.text as string })
          } else if (block.type === 'tool_use') {
            chatContent.push({
              type: 'tool_use',
              id: block.id as string,
              name: block.name as string,
              input: (block.input as Record<string, unknown>) || {},
            })
            // Track file modifications
            const toolName = (block.name as string || '').toLowerCase()
            if (toolName === 'edit' || toolName === 'write') {
              const input = (block.input as Record<string, unknown>) || {}
              const filePath = (input.file_path as string) || ''
              if (filePath) {
                setFileModifications(prev => [...prev, {
                  filePath,
                  type: toolName === 'edit' ? 'edit' : 'write',
                  newContent: (input.new_string as string) || (input.content as string) || '',
                  oldContent: (input.old_string as string) || undefined,
                  timestamp: Date.now(),
                }])
              }
            }
          }
        }

        if (chatContent.length > 0) {
          setMessages(prev => [...prev, {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: chatContent,
            timestamp: Date.now(),
          }])
        }
      },

      'claude:messageStart': () => {
        currentAssistantMsg.current = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: [],
          timestamp: Date.now(),
        }
        currentContentBlocks.current = new Map()
      },

      'claude:contentBlockStart': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        const index = event.index as number
        const block = event.content_block as Record<string, unknown>

        if (block.type === 'text') {
          currentContentBlocks.current.set(index, {
            type: 'text',
            text: (block.text as string) || '',
          })
        } else if (block.type === 'tool_use') {
          currentContentBlocks.current.set(index, {
            type: 'tool_use',
            id: block.id as string,
            name: block.name as string,
            input: {},
          })
        }
        flushAssistantMessage()
      },

      'claude:contentBlockDelta': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        const index = event.index as number
        const delta = event.delta as Record<string, unknown>

        const existing = currentContentBlocks.current.get(index)
        if (!existing) return

        if (delta.type === 'text_delta' && existing.type === 'text') {
          existing.text += (delta.text as string) || ''
        } else if (delta.type === 'input_json_delta' && existing.type === 'tool_use') {
          // Accumulate partial JSON for tool input
          const partial = (delta.partial_json as string) || ''
          const prev = (existing as Record<string, unknown>)._rawJson as string || ''
          ;(existing as Record<string, unknown>)._rawJson = prev + partial
          try {
            existing.input = JSON.parse(prev + partial)
          } catch {
            // Partial JSON, will be complete later
          }
        }
        flushAssistantMessage()
      },

      'claude:contentBlockStop': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        const index = event.index as number
        const block = currentContentBlocks.current.get(index)

        // Track file modifications from tool_use
        if (block?.type === 'tool_use') {
          const toolName = block.name.toLowerCase()
          if (toolName === 'edit' || toolName === 'write') {
            const input = block.input
            const filePath = (input.file_path as string) || ''
            if (filePath) {
              const mod: FileModification = {
                filePath,
                type: toolName === 'edit' ? 'edit' : 'write',
                newContent: (input.new_string as string) || (input.content as string) || '',
                oldContent: (input.old_string as string) || undefined,
                timestamp: Date.now(),
              }
              // Generate simple diff
              if (mod.oldContent && mod.newContent) {
                mod.diff = generateUnifiedDiff(filePath, mod.oldContent, mod.newContent)
              }
              setFileModifications(prev => [...prev, mod])
            }
          }
        }
        flushAssistantMessage()
      },

      'claude:result': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        flushAssistantMessage()
        currentAssistantMsg.current = null
        currentContentBlocks.current = new Map()

        if (event.is_error) {
          setMessages(prev => [...prev, {
            id: `error-${Date.now()}`,
            role: 'system',
            content: [{ type: 'text', text: `错误: ${event.result}` }],
            timestamp: Date.now(),
          }])
        }
      },

      'claude:processStarted': () => {
        setIsRunning(true)
        setMessages(prev => [...prev, {
          id: `sys-started-${Date.now()}`,
          role: 'system',
          content: [{ type: 'text', text: 'Claude 进程已启动' }],
          timestamp: Date.now(),
        }])
      },

      'claude:stderr': (...args: unknown[]) => {
        const text = String(args[0] || '').trim()
        if (!text) return
        setMessages(prev => [...prev, {
          id: `stderr-${Date.now()}`,
          role: 'system',
          content: [{ type: 'text', text: `[stderr] ${text}` }],
          timestamp: Date.now(),
        }])
      },

      'claude:processExit': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        setIsRunning(false)
        flushAssistantMessage()
        currentAssistantMsg.current = null
        // code 0 = 正常完成，不显示消息；非 0 = 异常退出
        if (event.code !== 0 && event.code !== null) {
          setMessages(prev => [...prev, {
            id: `sys-exit-${Date.now()}`,
            role: 'system',
            content: [{ type: 'text', text: `Claude 进程异常退出 (code: ${event.code})` }],
            timestamp: Date.now(),
          }])
        }
      },

      'claude:processError': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        setIsRunning(false)
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          role: 'system',
          content: [{ type: 'text', text: `进程错误: ${event.message}` }],
          timestamp: Date.now(),
        }])
      },
    }

    // Register all handlers
    for (const [channel, handler] of Object.entries(handlers)) {
      window.electronAPI.on(channel, handler)
    }

    return () => {
      for (const [channel, handler] of Object.entries(handlers)) {
        window.electronAPI.off(channel, handler)
      }
    }
  }, [flushAssistantMessage])

  const sendMessage = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    window.electronAPI.invoke('claude:sendMessage', text)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setFileModifications([])
    currentAssistantMsg.current = null
    currentContentBlocks.current = new Map()
  }, [])

  return {
    messages,
    fileModifications,
    isRunning,
    sendMessage,
    clearMessages,
  }
}

function generateUnifiedDiff(filePath: string, oldStr: string, newStr: string): string {
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  const oldLines = oldStr.split('\n')
  const newLines = newStr.split('\n')

  let diff = `--- a/${fileName}\n+++ b/${fileName}\n`
  diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`

  for (const line of oldLines) {
    diff += `-${line}\n`
  }
  for (const line of newLines) {
    diff += `+${line}\n`
  }

  return diff
}
