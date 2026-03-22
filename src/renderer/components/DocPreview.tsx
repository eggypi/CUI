import { useState, useEffect } from 'react'

interface DocFile {
  name: string
  path: string
}

interface DocPreviewProps {
  workingFolder: string | null
}

export default function DocPreview({ workingFolder }: DocPreviewProps) {
  const [docFiles, setDocFiles] = useState<DocFile[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scan for .docx files
  useEffect(() => {
    if (!workingFolder) {
      setDocFiles([])
      return
    }
    window.electronAPI.invoke('docs:scanDocx', workingFolder)
      .then((files: unknown) => setDocFiles(files as DocFile[]))
      .catch(() => setDocFiles([]))
  }, [workingFolder])

  // Load selected document
  const handleSelectDoc = async (docPath: string) => {
    setSelectedDoc(docPath)
    setLoading(true)
    setError(null)
    try {
      const html = await window.electronAPI.invoke('docs:convertDocx', docPath)
      setHtmlContent(html as string)
    } catch (err) {
      setError(`文档转换失败: ${err}`)
      setHtmlContent('')
    } finally {
      setLoading(false)
    }
  }

  if (!workingFolder) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-dark-muted">
        <div className="text-xs">请先选择工作文件夹</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* File list */}
      <div className="border-b border-dark-border">
        {docFiles.length === 0 ? (
          <div className="px-3 py-4 text-xs text-dark-muted text-center">
            未找到 .docx 文件
          </div>
        ) : (
          docFiles.map(doc => (
            <button
              key={doc.path}
              onClick={() => handleSelectDoc(doc.path)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-hover transition-colors flex items-center gap-2 ${
                selectedDoc === doc.path ? 'bg-dark-accent/10 text-dark-accent' : 'text-dark-text'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 1.5h6l3 3v8a1 1 0 01-1 1H3a1 1 0 01-1-1v-10a1 1 0 011-1z" stroke="currentColor" strokeWidth="1" />
                <path d="M9 1.5v3h3" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span className="truncate">{doc.name}</span>
            </button>
          ))
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-dark-muted text-sm py-8">加载中...</div>
        ) : error ? (
          <div className="text-center text-dark-error text-sm py-8">{error}</div>
        ) : htmlContent ? (
          <div
            className="prose prose-invert prose-sm max-w-none doc-preview"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        ) : (
          <div className="text-center text-dark-muted text-xs py-8">
            选择文件以预览
          </div>
        )}
      </div>
    </div>
  )
}
