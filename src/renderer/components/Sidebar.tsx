import { Session } from '@shared/types'

interface SidebarProps {
  sessions: Session[]
  activeSessionId: string | null
  onNewSession: () => void
  onSelectSession: (id: string) => void
  onOpenSettings: () => void
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onOpenSettings,
}: SidebarProps) {
  const formatTime = (ts: number) => {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-60 min-w-[200px] bg-dark-card border-r border-dark-border flex flex-col h-full">
      {/* Title bar drag area */}
      <div className="h-9 flex items-center px-4 app-drag-region">
        <span className="text-sm font-semibold text-dark-accent">Claude Code UI</span>
      </div>

      {/* New session button */}
      <div className="px-3 py-2">
        <button
          onClick={onNewSession}
          className="w-full py-2 px-3 bg-dark-accent hover:bg-dark-accent-hover text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          新建任务
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {sessions.length === 0 ? (
          <div className="text-center text-dark-muted text-xs py-8">
            暂无会话
            <br />
            点击上方按钮开始
          </div>
        ) : (
          sessions.map(session => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                session.id === activeSessionId
                  ? 'bg-dark-accent/20 text-dark-accent'
                  : 'hover:bg-dark-hover text-dark-text'
              }`}
            >
              <div className="text-sm truncate">{session.title}</div>
              <div className="text-xs text-dark-muted mt-0.5">
                {formatTime(session.updated_at)}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Settings button */}
      <div className="px-3 py-3 border-t border-dark-border">
        <button
          onClick={onOpenSettings}
          className="w-full py-2 px-3 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6.5 1.5h3l.3 1.8.8.3 1.5-1 2.1 2.1-1 1.5.3.8 1.8.3v3l-1.8.3-.3.8 1 1.5-2.1 2.1-1.5-1-.8.3-.3 1.8h-3l-.3-1.8-.8-.3-1.5 1-2.1-2.1 1-1.5-.3-.8-1.8-.3v-3l1.8-.3.3-.8-1-1.5 2.1-2.1 1.5 1 .8-.3.3-1.8z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          设置
        </button>
      </div>
    </div>
  )
}
