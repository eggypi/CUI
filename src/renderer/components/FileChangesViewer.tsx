import { useState } from 'react'
import { FileModification } from '@shared/types'
import * as Diff2Html from 'diff2html'
import 'diff2html/bundles/css/diff2html.min.css'

interface FileChangesViewerProps {
  modifications: FileModification[]
}

export default function FileChangesViewer({ modifications }: FileChangesViewerProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState<'line-by-line' | 'side-by-side'>('line-by-line')

  if (modifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-dark-muted">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mb-2 opacity-30">
          <path d="M8 4h12l6 6v18a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M20 4v6h6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="text-xs">暂无文件修改</div>
      </div>
    )
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'edit': return '修改'
      case 'write': return '写入'
      case 'create': return '新建'
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'edit': return 'text-dark-warning'
      case 'write': return 'text-dark-accent'
      case 'create': return 'text-dark-success'
      default: return 'text-dark-muted'
    }
  }

  const renderDiff = (mod: FileModification) => {
    if (!mod.diff) {
      return (
        <pre className="text-xs font-mono text-dark-text p-3 whitespace-pre-wrap overflow-x-auto">
          {mod.newContent || '(空内容)'}
        </pre>
      )
    }

    const html = Diff2Html.html(mod.diff, {
      drawFileList: false,
      outputFormat: diffMode,
      matching: 'lines',
    })

    return (
      <div
        className="diff-viewer text-xs overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  return (
    <div>
      {/* Diff mode toggle */}
      <div className="px-3 py-2 flex items-center justify-end gap-2">
        <button
          onClick={() => setDiffMode('line-by-line')}
          className={`text-xs px-2 py-0.5 rounded ${diffMode === 'line-by-line' ? 'bg-dark-accent/20 text-dark-accent' : 'text-dark-muted'}`}
        >
          行内
        </button>
        <button
          onClick={() => setDiffMode('side-by-side')}
          className={`text-xs px-2 py-0.5 rounded ${diffMode === 'side-by-side' ? 'bg-dark-accent/20 text-dark-accent' : 'text-dark-muted'}`}
        >
          并排
        </button>
      </div>

      {/* File list */}
      {modifications.map(mod => {
        const fileName = mod.filePath.replace(/\\/g, '/').split('/').pop() || mod.filePath
        const isExpanded = expandedFile === mod.filePath

        return (
          <div key={mod.filePath + mod.timestamp} className="border-t border-dark-border">
            <button
              onClick={() => setExpandedFile(isExpanded ? null : mod.filePath)}
              className="w-full px-3 py-2 text-left hover:bg-dark-hover transition-colors flex items-center gap-2"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              >
                <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
              <span className="text-sm text-dark-text flex-1 truncate font-mono">{fileName}</span>
              <span className={`text-xs ${getTypeColor(mod.type)}`}>{getTypeLabel(mod.type)}</span>
            </button>
            {isExpanded && (
              <div className="bg-dark-bg border-t border-dark-border">
                <div className="text-xs text-dark-muted px-3 py-1 font-mono truncate">
                  {mod.filePath}
                </div>
                {renderDiff(mod)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
