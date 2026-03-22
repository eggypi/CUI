import { useState } from 'react'
import { FileModification } from '@shared/types'
import FileChangesViewer from './FileChangesViewer'
import DocPreview from './DocPreview'

interface RightPanelProps {
  fileModifications: FileModification[]
  workingFolder: string | null
}

type Tab = 'changes' | 'docs'

export default function RightPanel({ fileModifications, workingFolder }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('changes')

  return (
    <div className="w-80 min-w-[260px] bg-dark-card border-l border-dark-border flex flex-col h-full">
      {/* Title bar drag area */}
      <div className="h-9 app-drag-region" />

      {/* Tab bar */}
      <div className="flex border-b border-dark-border px-2">
        <button
          onClick={() => setActiveTab('changes')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'changes'
              ? 'text-dark-accent'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          文件修改
          {fileModifications.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-dark-accent/20 text-dark-accent rounded-full">
              {fileModifications.length}
            </span>
          )}
          {activeTab === 'changes' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-dark-accent rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === 'docs'
              ? 'text-dark-accent'
              : 'text-dark-muted hover:text-dark-text'
          }`}
        >
          文档预览
          {activeTab === 'docs' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-dark-accent rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'changes' ? (
          <FileChangesViewer modifications={fileModifications} />
        ) : (
          <DocPreview workingFolder={workingFolder} />
        )}
      </div>
    </div>
  )
}
