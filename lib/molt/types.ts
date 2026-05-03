export type MoltResponseMode = "streaming" | "blocking"

export interface MoltChatRequestUser {
  id: string
  name?: string
  extra?: Record<string, unknown>
}

export interface MoltChatAttachment {
  type: string
  transfer_method: "url" | "base64" | "upload_id" | string
  url?: string
  data?: string
  upload_id?: string
  filename?: string
  mime_type?: string
}

export interface MoltChatRequest {
  message: string
  conversation_id?: string
  response_mode: MoltResponseMode
  routing_mode?: "matrix"
  user: MoltChatRequestUser
  attachments?: MoltChatAttachment[]
  options?: Record<string, unknown>
}

export interface MoltUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  thinking_tokens?: number
}

export interface MoltAttachment {
  type: string
  url: string
  filename?: string
  mime_type?: string
  resource_id?: string
}

export interface MoltChatBlockingResponse {
  message_id: string
  conversation_id: string
  agent_id: string
  answer: string
  attachments: MoltAttachment[]
  created_at: number
  metadata: {
    model?: string
    usage: MoltUsage
    tools_used: string[]
    duration_ms: number
    [key: string]: unknown
  }
  idempotency_hit?: boolean
}

export type MoltSseEventName =
  | "conversation_created"
  | "thinking"
  | "tool_start"
  | "tool_end"
  | "subagent_start"
  | "subagent_end"
  | "message"
  | "attachment"
  | "error"
  | "message_end"
  | "done"
  | string

export interface MoltSseEvent<T = unknown> {
  event: MoltSseEventName
  data: T
}

export interface MoltConversation {
  id: string
  agentId?: string
  userId?: string
  title?: string
  createdAt?: number
  updatedAt?: number
  messageCount?: number
  [key: string]: unknown
}

export interface MoltConversationListResponse {
  data: MoltConversation[]
  total: number
  limit: number
  offset: number
}

export interface MoltConversationMessage {
  id: string
  role?: "user" | "assistant" | string
  content?: string
  created_at?: number | string
  attachments?: MoltAttachment[]
  metadata?: Record<string, unknown>
  [key: string]: unknown
}

export interface MoltConversationMessagesResponse {
  data: MoltConversationMessage[]
  total: number
  limit?: number
  offset?: number
}

export interface MoltAgentInfo {
  id: string
  name?: string
  description?: string
  model?: string
  capabilities?: {
    streaming?: boolean
    thinking?: boolean
    tools?: boolean
    file_upload?: boolean
    subagents?: boolean
    workspace_modes?: string[]
    [key: string]: unknown
  }
  skills?: string[]
  status?: "online" | "offline" | string
  [key: string]: unknown
}

export interface MoltAgentListResponse {
  data: MoltAgentInfo[]
}

export interface MoltUploadResponse {
  upload_id: string
  filename: string
  mime_type: string
  size: number
  created_at: number
}

export interface MoltErrorBody {
  error: {
    code: string
    message: string
    status: number
    details?: unknown
  }
}
