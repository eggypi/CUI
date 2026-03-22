// Claude Code stream-json event types

export interface StreamEvent {
  type: string
  [key: string]: unknown
}

export interface InitEvent extends StreamEvent {
  type: 'init'
  session_id: string
  model: string
}

export interface MessageStartEvent extends StreamEvent {
  type: 'message_start'
  message: {
    id: string
    role: 'assistant'
  }
}

export interface ContentBlockStart extends StreamEvent {
  type: 'content_block_start'
  index: number
  content_block: {
    type: 'text' | 'tool_use'
    id?: string
    name?: string
    text?: string
  }
}

export interface ContentBlockDelta extends StreamEvent {
  type: 'content_block_delta'
  index: number
  delta: {
    type: 'text_delta' | 'input_json_delta'
    text?: string
    partial_json?: string
  }
}

export interface ContentBlockStop extends StreamEvent {
  type: 'content_block_stop'
  index: number
}

export interface ResultEvent extends StreamEvent {
  type: 'result'
  result: string
  session_id: string
  cost_usd: number
  duration_ms: number
  duration_api_ms: number
  is_error: boolean
  num_turns: number
}

// Chat message types for UI rendering
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: ChatContent[]
  timestamp: number
}

export type ChatContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

// Session types
export interface Session {
  id: string
  title: string
  created_at: number
  updated_at: number
  messages: ChatMessage[]
}

// File modification tracking
export interface FileModification {
  filePath: string
  type: 'edit' | 'write' | 'create'
  oldContent?: string
  newContent?: string
  diff?: string
  timestamp: number
}

// Config types
export interface AppConfig {
  baseUrl: string
  modelName: string
  apiKey: string
}

// Permission request types
export interface PermissionRequest {
  id: string
  toolName: string
  command?: string
  filePath?: string
  description: string
  timestamp: number
}
