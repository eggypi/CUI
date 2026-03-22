import { useState, useEffect } from 'react'
import { PermissionRequest } from '@shared/types'

export default function PermissionDialog() {
  const [requests, setRequests] = useState<PermissionRequest[]>([])

  useEffect(() => {
    const handler = (...args: unknown[]) => {
      const request = args[0] as PermissionRequest
      setRequests(prev => [...prev, request])
    }
    window.electronAPI.on('claude:permissionRequest', handler)
    return () => {
      window.electronAPI.off('claude:permissionRequest', handler)
    }
  }, [])

  const handleResponse = (requestId: string, allowed: boolean) => {
    window.electronAPI.invoke('claude:permissionResponse', { requestId, allowed })
    setRequests(prev => prev.filter(r => r.id !== requestId))
  }

  if (requests.length === 0) return null

  const current = requests[0]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-card border border-dark-border rounded-card p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-dark-warning/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M10 2L2 18h16L10 2z"
                stroke="#ff9800"
                strokeWidth="1.5"
                fill="none"
              />
              <path d="M10 8v4M10 14v1" stroke="#ff9800" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-dark-text">权限请求</h3>
            <p className="text-xs text-dark-muted">
              Claude 请求执行以下操作
              {requests.length > 1 && ` (${requests.length} 个待处理)`}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-dark-bg rounded-lg p-3 mb-4 border border-dark-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-dark-accent">{current.toolName}</span>
          </div>
          {current.command && (
            <div className="mb-2">
              <div className="text-xs text-dark-muted mb-1">命令:</div>
              <code className="text-xs text-dark-text font-mono bg-dark-card px-2 py-1 rounded block overflow-x-auto">
                {current.command}
              </code>
            </div>
          )}
          {current.filePath && (
            <div className="mb-2">
              <div className="text-xs text-dark-muted mb-1">文件:</div>
              <code className="text-xs text-dark-text font-mono">{current.filePath}</code>
            </div>
          )}
          <div className="text-xs text-dark-muted">{current.description}</div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => handleResponse(current.id, false)}
            className="flex-1 py-2.5 border border-dark-border text-dark-text rounded-lg text-sm hover:bg-dark-hover transition-colors"
          >
            拒绝
          </button>
          <button
            onClick={() => handleResponse(current.id, true)}
            className="flex-1 py-2.5 bg-dark-accent hover:bg-dark-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            允许
          </button>
        </div>
      </div>
    </div>
  )
}
