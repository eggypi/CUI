import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { ChatMessage, ChatContent } from '@shared/types'

interface MessageBubbleProps {
  message: ChatMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`mb-4 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-card px-4 py-3 ${
          isUser
            ? 'bg-dark-accent text-white'
            : 'bg-dark-card border border-dark-border'
        }`}
      >
        {message.content.map((block, idx) => (
          <ContentBlock key={idx} block={block} isUser={isUser} />
        ))}
      </div>
    </div>
  )
}

function ContentBlock({ block, isUser }: { block: ChatContent; isUser: boolean }) {
  if (block.type === 'text') {
    if (isUser) {
      return <div className="text-sm whitespace-pre-wrap">{block.text}</div>
    }
    return (
      <div className="text-sm prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
        >
          {block.text}
        </ReactMarkdown>
      </div>
    )
  }

  if (block.type === 'tool_use') {
    return <ToolUseBlock name={block.name} input={block.input} />
  }

  if (block.type === 'tool_result') {
    return (
      <div className="mt-2 text-xs bg-dark-bg rounded-lg p-2 border border-dark-border">
        <div className="text-dark-muted mb-1">工具结果:</div>
        <pre className="whitespace-pre-wrap text-dark-text overflow-x-auto">
          {block.content}
        </pre>
        {block.is_error && (
          <span className="text-dark-error text-xs">错误</span>
        )}
      </div>
    )
  }

  return null
}

function ToolUseBlock({ name, input }: { name: string; input: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)

  const getToolIcon = (toolName: string) => {
    if (toolName.toLowerCase().includes('bash') || toolName.toLowerCase().includes('command')) return '>'
    if (toolName.toLowerCase().includes('edit')) return 'E'
    if (toolName.toLowerCase().includes('write')) return 'W'
    if (toolName.toLowerCase().includes('read')) return 'R'
    if (toolName.toLowerCase().includes('glob') || toolName.toLowerCase().includes('search')) return 'S'
    return 'T'
  }

  return (
    <div className="my-2 bg-dark-bg rounded-lg border border-dark-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-dark-hover transition-colors"
      >
        <span className="w-5 h-5 rounded bg-dark-accent/20 text-dark-accent text-xs flex items-center justify-center font-mono">
          {getToolIcon(name)}
        </span>
        <span className="text-dark-accent font-medium">{name}</span>
        {input.command ? (
          <span className="text-dark-muted text-xs truncate flex-1 text-left font-mono">
            {String(input.command).slice(0, 60)}
          </span>
        ) : null}
        {input.file_path ? (
          <span className="text-dark-muted text-xs truncate flex-1 text-left">
            {String(input.file_path)}
          </span>
        ) : null}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`text-dark-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-dark-border">
          <pre className="text-xs text-dark-text mt-2 whitespace-pre-wrap overflow-x-auto font-mono">
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
