// Dify API 服务
export interface DifyMessage {
  role: 'user' | 'assistant'
  content: string
  files?: Array<{
    type: 'image' | 'document'
    transfer_method: 'remote_url' | 'local_file'
    url?: string
    upload_file_id?: string
  }>
}

export interface DifyResponse {
  event: string
  message_id: string
  conversation_id: string
  answer: string
  created_at: number
}

export interface DifyStreamResponse {
  event: 'message' | 'message_end' | 'error'
  message_id?: string
  conversation_id?: string
  answer?: string
  created_at?: number
  error?: string
}

export class DifyAPI {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = "http://192.144.232.60/v1"
    this.apiKey = "app-P0zICVDnPuLSteB4iM7SClQi"
  }

  // 发送消息到Dify
  async sendMessage(
    message: string, 
    conversationId?: string,
    files?: Array<{
      type: 'image' | 'document'
      transfer_method: 'remote_url' | 'local_file'
      url?: string
      upload_file_id?: string
    }>
  ): Promise<AsyncGenerator<DifyStreamResponse>> {
    const response = await fetch(`${this.baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: 'streaming',
        conversation_id: conversationId,
        user: 'user-123',
        files: files || []
      }),
    })

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status} ${response.statusText}`)
    }

    return this.parseStreamResponse(response)
  }

  // 解析流式响应
  private async* parseStreamResponse(response: Response): AsyncGenerator<DifyStreamResponse> {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              yield data as DifyStreamResponse
            } catch (e) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // 上传文件到Dify
  async uploadFile(file: File): Promise<{ id: string; name: string }> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('user', 'user-123')

    const response = await fetch(`${this.baseUrl}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`File upload error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return {
      id: result.id,
      name: result.name
    }
  }

  // 获取对话历史
  async getConversationMessages(conversationId: string): Promise<DifyMessage[]> {
    const response = await fetch(`${this.baseUrl}/messages?conversation_id=${conversationId}&limit=100`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Get messages error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return result.data || []
  }
}

// 创建单例实例
export const difyAPI = new DifyAPI()
