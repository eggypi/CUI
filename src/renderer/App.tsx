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
    startProcess,
    stopProcess,
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

    // Load recent folders
    const saved = localStorage.getItem('recentFolders')
    if (saved) {
      try { setRecentFolders(JSON.parse(saved)) } catch { /* ignore */ }
    }

    // Load sessions
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

  // Start/restart claude process when folder or mode changes
  useEffect(() => {
    if (workingFolder && configured) {
      startProcess(workingFolder, permissionMode)
    }
    return () => {
      stopProcess()
    }
  }, [workingFolder, permissionMode, configured, startProcess, stopProcess])

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
    if (workingFolder) {
      stopProcess()
      startProcess(workingFolder, permissionMode)
    }
  }, [workingFolder, permissionMode, clearMessages, stopProcess, startProcess])

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId)
    clearMessages()
    if (workingFolder) {
      stopProcess()
      startProcess(workingFolder, permissionMode, sessionId)
    }
  }, [workingFolder, permissionMode, clearMessages, stopProcess, startProcess])

  const handleFolderSelect = useCallback(async (folder: string) => {
    setWorkingFolder(folder)
    const updated = [folder, ...recentFolders.filter(f => f !== folder)].slice(0, 5)
    setRecentFolders(updated)
    localStorage.setItem('recentFolders', JSON.stringify(updated))
  }, [recentFolders])

  const handleSendMessage = useCallback((text: string) => {
    sendMessage(text)

    // Update session title from first message
    if (activeSessionId) {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId && s.title === '新会话') {
          return { ...s, title: text.slice(0, 30), updated_at: Date.now() }
        }
        return s
      }))
    }
  }, [sendMessage, activeSessionId])

  const handlePermissionModeChange = useCallback((mode: 'plan' | 'acceptEdits') => {
    setPermissionMode(mode)
    // Process will restart via useEffect
  }, [])

  // Show setup wizard if not configured or settings requested
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
      {/* Left Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Chat Panel */}
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

      {/* Right Panel */}
      <RightPanel
        fileModifications={fileModifications}
        workingFolder={workingFolder}
      />
    </div>
  )
}

export default App
