import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@shared/types'
import MessageBubble from './MessageBubble'
import FolderSelector from './FolderSelector'
import ModeSwitch from './ModeSwitch'
import SkillSelector from './SkillSelector'
import PermissionDialog from './PermissionDialog'

interface ChatPanelProps {
  messages: ChatMessage[]
  workingFolder: string | null
  recentFolders: string[]
  permissionMode: 'plan' | 'acceptEdits'
  isProcessRunning: boolean
  onSendMessage: (text: string) => void
  onFolderSelect: (folder: string) => void
  onPermissionModeChange: (mode: 'plan' | 'acceptEdits') => void
  setIsProcessRunning: (running: boolean) => void
}

export default function ChatPanel({
  messages,
  workingFolder,
  recentFolders,
  permissionMode,
  isProcessRunning,
  onSendMessage,
  onFolderSelect,
  onPermissionModeChange,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState('')
  const [showSkillSelector, setShowSkillSelector] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
    }
  }, [inputText])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    // Detect "/" at start to show skill selector
    if (e.key === '/' && inputText === '') {
      setShowSkillSelector(true)
    }
  }

  const handleSend = () => {
    const trimmed = inputText.trim()
    if (!trimmed) return
    onSendMessage(trimmed)
    setInputText('')
    setShowSkillSelector(false)
  }

  const handleSkillSelect = (skillName: string) => {
    setInputText(`/${skillName} `)
    setShowSkillSelector(false)
    textareaRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputText(val)
    if (val.startsWith('/') && val.length > 1) {
      setShowSkillSelector(true)
    } else if (!val.startsWith('/')) {
      setShowSkillSelector(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      {/* Title bar drag area */}
      <div className="h-9 app-drag-region flex items-center justify-center">
        <span className="text-xs text-dark-muted">
          {workingFolder ? workingFolder.replace(/\\/g, '/').split('/').pop() : 'Claude Code UI'}
        </span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-dark-muted">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-4 opacity-30">
              <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2" />
              <path d="M4 16h40" stroke="currentColor" strokeWidth="2" />
              <circle cx="10" cy="12" r="1.5" fill="currentColor" />
              <circle cx="15" cy="12" r="1.5" fill="currentColor" />
              <circle cx="20" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <div className="text-sm">开始与 Claude 对话</div>
            <div className="text-xs mt-1">
              {workingFolder ? `工作目录: ${workingFolder}` : '请先选择工作文件夹'}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Permission dialog (overlaid when needed) */}
      <PermissionDialog />

      {/* Input area */}
      <div className="px-4 pb-4">
        <div className="bg-dark-card rounded-card border border-dark-border">
          {/* Top bar: folder selector + mode switch */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-dark-border">
            <FolderSelector
              currentFolder={workingFolder}
              recentFolders={recentFolders}
              onSelect={onFolderSelect}
            />
            <ModeSwitch
              mode={permissionMode}
              onChange={onPermissionModeChange}
            />
          </div>

          {/* Skill selector popup */}
          {showSkillSelector && (
            <SkillSelector
              filter={inputText.startsWith('/') ? inputText.slice(1) : ''}
              onSelect={handleSkillSelect}
              onClose={() => setShowSkillSelector(false)}
            />
          )}

          {/* Input row */}
          <div className="flex items-end gap-2 p-3">
            {/* Skill trigger button */}
            <button
              onClick={() => setShowSkillSelector(!showSkillSelector)}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-dark-hover hover:bg-dark-border text-dark-muted hover:text-dark-text transition-colors flex items-center justify-center"
              title="选择 Skill"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={workingFolder ? '输入消息... (Shift+Enter 换行)' : '请先选择工作文件夹'}
              disabled={!workingFolder}
              rows={1}
              className="flex-1 bg-transparent text-dark-text placeholder-dark-muted text-sm resize-none outline-none max-h-[200px] py-1.5 disabled:opacity-50"
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || !workingFolder}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-dark-accent hover:bg-dark-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* Status bar */}
          <div className="px-3 pb-2 flex items-center gap-2 text-xs text-dark-muted">
            <span className={`w-2 h-2 rounded-full ${isProcessRunning ? 'bg-dark-success' : 'bg-dark-muted'}`} />
            <span>{isProcessRunning ? '运行中' : '已停止'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
