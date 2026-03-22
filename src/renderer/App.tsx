import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatPanel from './components/ChatPanel'
import RightPanel from './components/RightPanel'
import SetupWizard from './components/SetupWizard'
import { useClaudeProcess } from './hooks/useClaudeProcess'
import { Session, AppConfig } from '@shared/types'

function App() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [workingFolder, setWorkingFolder] = useState<string | null>(null)
  const [recentFolders, setRecentFolders] = useState<string[]>([])
  const [permissionMode, setPermissionMode] = useState<'plan' | 'acceptEdits'>('plan')

  const {
    messages,
    fileModifications,
    isRunning,
    sendMessage,
    clearMessages,
  } = useClaudeProcess()

  // Check config on mount
  useEffect(() => {
    window.electronAPI.invoke('config:check').then((result: unknown) => {
      setConfigured(result as boolean)
    }).catch(() => {
      setConfigured(false)
    })

    const saved = localStorage.getItem('recentFolders')
    if (saved) {
      try { setRecentFolders(JSON.parse(saved)) } catch { /* ignore */ }
    }

    window.electronAPI.invoke('claude:getSessions').then((result: unknown) => {
      const rawSessions = result as Array<Record<string, unknown>>
      if (rawSessions?.length) {
        setSessions(rawSessions.map(s => ({
          id: s.id as string || `session-${Date.now()}`,
          title: (s.title as string) || (s.first_message as string)?.slice(0, 30) || '未命名会话',
          created_at: (s.created_at as number) || Date.now(),
          updated_at: (s.updated_at as number) || Date.now(),
          messages: [],
        })))
      }
    }).catch(() => {})
  }, [])

  // 选文件夹时通知主进程
  const handleFolderSelect = useCallback(async (folder: string) => {
    setWorkingFolder(folder)
    window.electronAPI.invoke('claude:setWorkingFolder', folder)
    const updated = [folder, ...recentFolders.filter(f => f !== folder)].slice(0, 5)
    setRecentFolders(updated)
    localStorage.setItem('recentFolders', JSON.stringify(updated))
  }, [recentFolders])

  // 切换模式时通知主进程
  const handlePermissionModeChange = useCallback((mode: 'plan' | 'acceptEdits') => {
    setPermissionMode(mode)
    window.electronAPI.invoke('claude:setPermissionMode', mode)
  }, [])

  const handleConfigSave = (_config: AppConfig) => {
    setConfigured(true)
    setShowSettings(false)
  }

  const handleNewSession = useCallback(() => {
    const newSession: Session = {
      id: `session-${Date.now()}`,
      title: '新会话',
      created_at: Date.now(),
      updated_at: Date.now(),
      messages: [],
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)
    clearMessages()
    window.electronAPI.invoke('claude:resetSession')
  }, [clearMessages])

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
    clearMessages()
    // TODO: resume session via --resume
  }, [clearMessages])

  const handleSendMessage = useCallback((text: string) => {
    sendMessage(text)

    if (activeSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId && s.title === '新会话') {
          return { ...s, title: text.slice(0, 30), updated_at: Date.now() }
        }
        return s
      }))
    }
  }, [sendMessage, activeSessionId])

  if (configured === null) {
    return (
      <div className="h-screen w-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-muted">加载中...</div>
      </div>
    )
  }

  if (!configured || showSettings) {
    return <SetupWizard onSave={handleConfigSave} onCancel={showSettings ? () => setShowSettings(false) : undefined} />
  }

  return (
    <div className="h-screen w-screen bg-dark-bg text-dark-text flex overflow-hidden">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onOpenSettings={() => setShowSettings(true)}
      />
      <ChatPanel
        messages={messages}
        workingFolder={workingFolder}
        recentFolders={recentFolders}
        permissionMode={permissionMode}
        isProcessRunning={isRunning}
        onSendMessage={handleSendMessage}
        onFolderSelect={handleFolderSelect}
        onPermissionModeChange={handlePermissionModeChange}
        setIsProcessRunning={() => {}}
      />
      <RightPanel
        fileModifications={fileModifications}
        workingFolder={workingFolder}
      />
    </div>
  )
}

export default App
