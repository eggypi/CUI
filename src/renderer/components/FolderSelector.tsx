import { useState, useRef, useEffect } from 'react'

interface FolderSelectorProps {
  currentFolder: string | null
  recentFolders: string[]
  onSelect: (folder: string) => void
}

export default function FolderSelector({ currentFolder, recentFolders, onSelect }: FolderSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleBrowse = async () => {
    const folder = await window.electronAPI.openFolder()
    if (folder) {
      onSelect(folder)
      setShowDropdown(false)
    }
  }

  const shortenPath = (path: string) => {
    const parts = path.replace(/\\/g, '/').split('/')
    if (parts.length <= 3) return path.replace(/\\/g, '/')
    return `.../${parts.slice(-2).join('/')}`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-1.5 text-xs text-dark-muted hover:text-dark-text transition-colors px-2 py-1 rounded hover:bg-dark-hover"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M1.5 3.5v7a1 1 0 001 1h9a1 1 0 001-1v-5a1 1 0 00-1-1h-4l-1.5-1.5h-3.5a1 1 0 00-1 1z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
        </svg>
        <span className="max-w-[200px] truncate">
          {currentFolder ? shortenPath(currentFolder) : '选择文件夹'}
        </span>
        <svg width="10" height="10" viewBox="0 0 10 10">
          <path d="M3 4l2 2 2-2" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-dark-card border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            onClick={handleBrowse}
            className="w-full px-3 py-2.5 text-sm text-left hover:bg-dark-hover transition-colors flex items-center gap-2 text-dark-accent"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            浏览文件夹...
          </button>

          {recentFolders.length > 0 && (
            <>
              <div className="border-t border-dark-border" />
              <div className="px-3 py-1.5 text-xs text-dark-muted">最近使用</div>
              {recentFolders.map(folder => (
                <button
                  key={folder}
                  onClick={() => { onSelect(folder); setShowDropdown(false) }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-dark-hover transition-colors truncate ${
                    folder === currentFolder ? 'text-dark-accent' : 'text-dark-text'
                  }`}
                >
                  {shortenPath(folder)}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
