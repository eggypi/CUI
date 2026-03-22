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
      // 每个事件包含累积的 content 数组，用 message.id 去重更新
      'claude:assistantMessage': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        const message = event.message as Record<string, unknown>
        if (!message) return

        const msgId = (message.id as string) || `assistant-${Date.now()}`
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
                setFileModifications(prev => {
                  // 避免重复添加同一文件修改
                  if (prev.some(m => m.filePath === filePath && m.timestamp > Date.now() - 5000)) return prev
                  return [...prev, {
                    filePath,
                    type: toolName === 'edit' ? 'edit' : 'write',
                    newContent: (input.new_string as string) || (input.content as string) || '',
                    oldContent: (input.old_string as string) || undefined,
                    timestamp: Date.now(),
                  }]
                })
              }
            }
          }
          // 跳过 thinking 块，不展示给用户
        }

        if (chatContent.length === 0) return

        // 用 message ID 去重：更新已有消息或追加新消息
        setMessages(prev => {
          const existingIdx = prev.findIndex(m => m.id === msgId)
          if (existingIdx >= 0) {
            const updated = [...prev]
            updated[existingIdx] = { ...updated[existingIdx], content: chatContent }
            return updated
          }
          return [...prev, {
            id: msgId,
            role: 'assistant' as const,
            content: chatContent,
            timestamp: Date.now(),
          }]
        })
      },

      // 工具执行结果（user 类型事件中的 tool_result）
      'claude:event': (...args: unknown[]) => {
        const event = args[0] as Record<string, unknown>
        const type = event.type as string
        if (type === 'user') {
          const message = event.message as Record<string, unknown>
          if (!message) return
          const contentArr = message.content as Array<Record<string, unknown>>
          if (!contentArr || !Array.isArray(contentArr)) return

          for (const block of contentArr) {
            if (block.type === 'tool_result') {
              const toolUseId = block.tool_use_id as string
              const content = block.content as string || ''
              const isError = block.is_error as boolean || false

              // 把工具结果追加到对应的 assistant 消息里
              setMessages(prev => {
                // 找到包含这个 tool_use_id 的 assistant 消息
                const msgIdx = prev.findIndex(m =>
                  m.role === 'assistant' && m.content.some(c => c.type === 'tool_use' && c.id === toolUseId)
                )
                if (msgIdx >= 0) {
                  const updated = [...prev]
                  const msg = { ...updated[msgIdx] }
                  msg.content = [...msg.content, {
                    type: 'tool_result' as const,
                    tool_use_id: toolUseId,
                    content: content.slice(0, 2000), // 截断过长输出
                    is_error: isError,
                  }]
                  updated[msgIdx] = msg
                  return updated
                }
                return prev
              })
            }
          }
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
      },

      'claude:stderr': (...args: unknown[]) => {
        const text = String(args[0] || '').trim()
        if (!text) return
        // 只显示真正的错误，过滤掉 warning
        if (text.toLowerCase().includes('error') && !text.toLowerCase().includes('warning')) {
          setMessages(prev => [...prev, {
            id: `stderr-${Date.now()}`,
            role: 'system',
            content: [{ type: 'text', text: `[错误] ${text}` }],
            timestamp: Date.now(),
          }])
        }
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
