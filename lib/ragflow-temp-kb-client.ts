/**
 * RAGFlow 临时知识库客户端
 * 用于管理用户临时知识图谱：创建知识库、添加知识片段、构建图谱
 */

export interface TempKbConfig {
  baseUrl: string
  apiKey: string
}

export interface CreateDatasetParams {
  name: string
  description?: string
  embeddingModel?: string
  chunkMethod?: string
  enableGraphRAG?: boolean
  graphRAGMethod?: 'light' | 'general'
  entityTypes?: string[]
}

export interface CreateDatasetResult {
  success: boolean
  data?: {
    id: string
    name: string
  }
  error?: string
}

export interface AddChunkParams {
  datasetId: string
  documentId: string
  content: string
  keywords?: string[]
}

export interface AddChunkResult {
  success: boolean
  data?: {
    chunkId: string
  }
  error?: string
}

export interface GraphData {
  nodes: Array<{
    id: string
    entity_name: string
    entity_type: string
    description?: string
    pagerank?: number
  }>
  edges: Array<{
    source: string
    target: string
    description?: string
    weight?: number
  }>
}

export interface GetGraphResult {
  success: boolean
  data?: {
    graph: GraphData
    nodeCount: number
    edgeCount: number
  }
  error?: string
}

/**
 * RAGFlow 临时知识库客户端
 */
export class RAGFlowTempKbClient {
  private config: TempKbConfig

  constructor(config: TempKbConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/$/, '')
    }
  }

  /**
   * 创建临时知识库（启用GraphRAG）
   */
  async createDataset(params: CreateDatasetParams): Promise<CreateDatasetResult> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets`
      
      const body: Record<string, any> = {
        name: params.name,
        description: params.description || '用户临时知识图谱',
        chunk_method: params.chunkMethod || 'naive',
        parser_config: {
          chunk_token_num: 512,
          delimiter: '\\n!?。；！？',
          graphrag: {
            use_graphrag: params.enableGraphRAG !== false,
            method: params.graphRAGMethod || 'light',
            entity_types: params.entityTypes || ['organization', 'person', 'geo', 'event', 'category'],
            resolution: false,
            community: false
          }
        }
      }

      if (params.embeddingModel) {
        body.embedding_model = params.embeddingModel
      }

      console.log('[TempKbClient] 创建知识库:', { url, name: params.name })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      })

      const result = await response.json()

      if (result.code === 0 && result.data) {
        console.log('[TempKbClient] 知识库创建成功:', result.data.id)
        return {
          success: true,
          data: {
            id: result.data.id,
            name: result.data.name
          }
        }
      }

      return {
        success: false,
        error: result.message || '创建知识库失败'
      }
    } catch (error) {
      console.error('[TempKbClient] 创建知识库异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建知识库异常'
      }
    }
  }

  /**
   * 创建初始文档（用于存储用户保存的知识片段）
   * 使用 multipart/form-data 上传一个简单的文本文件到知识库
   */
  async createVirtualDocument(datasetId: string, name: string = 'user_knowledge'): Promise<{
    success: boolean
    data?: { documentId: string }
    error?: string
  }> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets/${datasetId}/documents`

      console.log('[TempKbClient] 上传初始文档:', { datasetId, name })

      // 创建一个简单的文本内容作为初始文档
      const initialContent = `# 用户知识库\n\n此文档用于存储用户保存的知识片段。\n\n创建时间: ${new Date().toISOString()}`

      // 创建 Blob 和 FormData
      const blob = new Blob([initialContent], { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', blob, `${name}.txt`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          // 注意：不要手动设置 Content-Type，fetch 会自动设置 multipart/form-data 和 boundary
        },
        body: formData,
        signal: AbortSignal.timeout(30000)
      })

      const result = await response.json()
      console.log('[TempKbClient] 上传文档结果:', result)

      if (result.code === 0 && result.data && result.data.length > 0) {
        const documentId = result.data[0].id
        console.log('[TempKbClient] 获取到 document_id:', documentId)
        return {
          success: true,
          data: { documentId }
        }
      }

      return {
        success: false,
        error: result.message || '上传初始文档失败'
      }
    } catch (error) {
      console.error('[TempKbClient] 创建初始文档异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建初始文档异常'
      }
    }
  }

  /**
   * 添加知识片段到知识库
   */
  async addChunk(params: AddChunkParams): Promise<AddChunkResult> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets/${params.datasetId}/documents/${params.documentId}/chunks`

      console.log('[TempKbClient] 添加知识片段:', {
        datasetId: params.datasetId,
        documentId: params.documentId,
        contentLength: params.content.length
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: params.content,
          important_keywords: params.keywords || []
        }),
        signal: AbortSignal.timeout(30000)
      })

      const result = await response.json()

      if (result.code === 0 && result.data) {
        console.log('[TempKbClient] 知识片段添加成功')
        return {
          success: true,
          data: {
            chunkId: result.data.chunk?.id || result.data.id || 'unknown'
          }
        }
      }

      return {
        success: false,
        error: result.message || '添加知识片段失败'
      }
    } catch (error) {
      console.error('[TempKbClient] 添加知识片段异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '添加知识片段异常'
      }
    }
  }

  /**
   * 触发知识图谱构建
   */
  async runGraphRAG(datasetId: string): Promise<{
    success: boolean
    data?: { taskId: string }
    error?: string
  }> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets/${datasetId}/run_graphrag`

      console.log('[TempKbClient] 触发图谱构建:', { datasetId })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000)
      })

      const result = await response.json()

      if (result.code === 0) {
        console.log('[TempKbClient] 图谱构建已触发:', result.data?.graphrag_task_id)
        return {
          success: true,
          data: {
            taskId: result.data?.graphrag_task_id || ''
          }
        }
      }

      return {
        success: false,
        error: result.message || '触发图谱构建失败'
      }
    } catch (error) {
      console.error('[TempKbClient] 触发图谱构建异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '触发图谱构建异常'
      }
    }
  }

  /**
   * 获取图谱构建状态
   */
  async getGraphRAGStatus(datasetId: string): Promise<{
    success: boolean
    data?: { status: string; progress?: number }
    error?: string
  }> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets/${datasetId}/trace_graphrag`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(30000)
      })

      const result = await response.json()
      console.log('[TempKbClient] 图谱构建状态响应:', JSON.stringify(result).slice(0, 200))

      if (result.code === 0 && result.data) {
        const data = result.data
        let status = 'unknown'
        const progress = data.progress || 0

        // 检查进度
        if (progress >= 1) {
          status = 'completed'
        } else if (data.progress_msg?.includes('fail') || data.progress_msg?.includes('error')) {
          status = 'failed'
        } else {
          status = 'building'
        }

        console.log('[TempKbClient] 图谱状态:', { status, progress })
        return {
          success: true,
          data: { status, progress }
        }
      }

      // 如果 API 返回错误码，可能是没有构建任务
      if (result.code === 102 || result.message?.includes('not found')) {
        return {
          success: true,
          data: { status: 'completed', progress: 1 }
        }
      }

      return {
        success: false,
        error: result.message || '获取构建状态失败'
      }
    } catch (error) {
      console.error('[TempKbClient] 获取图谱状态异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取构建状态异常'
      }
    }
  }

  /**
   * 获取知识图谱数据
   */
  async getKnowledgeGraph(datasetId: string): Promise<GetGraphResult> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets/${datasetId}/knowledge_graph`

      console.log('[TempKbClient] 获取知识图谱:', { datasetId })

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(60000)
      })

      const result = await response.json()
      console.log('[TempKbClient] 知识图谱原始响应:', JSON.stringify(result).slice(0, 500))

      if (result.code === 0) {
        // RAGFlow 可能返回 result.data 直接是图谱，也可能是 result.data.graph
        const graph = result.data?.graph || result.data || {}
        const nodes = graph.nodes || graph.entity || []
        const edges = graph.edges || graph.relationship || []
        const nodeCount = nodes.length
        const edgeCount = edges.length

        console.log('[TempKbClient] 图谱获取成功:', { nodeCount, edgeCount })

        return {
          success: true,
          data: {
            graph: { nodes, edges },
            nodeCount,
            edgeCount
          }
        }
      }

      return {
        success: false,
        error: result.message || '获取知识图谱失败'
      }
    } catch (error) {
      console.error('[TempKbClient] 获取知识图谱异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取知识图谱异常'
      }
    }
  }

  /**
   * 删除知识库
   */
  async deleteDataset(datasetId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets`

      console.log('[TempKbClient] 删除知识库:', { datasetId })

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: [datasetId]
        }),
        signal: AbortSignal.timeout(30000)
      })

      const result = await response.json()

      if (result.code === 0) {
        console.log('[TempKbClient] 知识库删除成功')
        return { success: true }
      }

      return {
        success: false,
        error: result.message || '删除知识库失败'
      }
    } catch (error) {
      console.error('[TempKbClient] 删除知识库异常:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除知识库异常'
      }
    }
  }

  /**
   * 列出知识库的所有文档
   */
  async listDocuments(datasetId: string): Promise<{
    success: boolean
    data?: Array<{ id: string; name: string; status: string }>
    error?: string
  }> {
    try {
      const url = `${this.config.baseUrl}/api/v1/datasets/${datasetId}/documents`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(30000)
      })

      const result = await response.json()

      if (result.code === 0) {
        return {
          success: true,
          data: result.data || []
        }
      }

      return {
        success: false,
        error: result.message || '获取文档列表失败'
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取文档列表异常'
      }
    }
  }
}
