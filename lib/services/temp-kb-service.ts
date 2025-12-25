/**
 * 临时知识库服务
 * 管理用户临时知识图谱的完整生命周期
 */

import prisma from '@/lib/prisma'
import { RAGFlowTempKbClient, GraphData } from '@/lib/ragflow-temp-kb-client'
import { TempKbStatus } from '@prisma/client'

export interface SaveChunkParams {
  userId: string
  content: string
  keywords?: string[]
  sourceMessageId?: string
  sourceType?: 'assistant_reply' | 'reference' | 'user_input'
}

export interface SaveChunkResult {
  success: boolean
  data?: {
    chunkId: string
    tempKbId: string
    ragflowChunkId?: string
  }
  error?: string
}

export interface TempKbInfo {
  id: string
  ragflowKbId: string
  chunkCount: number
  nodeCount: number
  edgeCount: number
  status: TempKbStatus
  lastActiveAt: Date
  createdAt: Date
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
 * 临时知识库服务类
 */
export class TempKbService {
  private client: RAGFlowTempKbClient
  private ragflowUrl: string
  private apiKey: string

  constructor() {
    this.ragflowUrl = process.env.RAGFLOW_URL || ''
    this.apiKey = process.env.RAGFLOW_API_KEY || ''
    
    if (!this.ragflowUrl || !this.apiKey) {
      console.warn('[TempKbService] RAGFlow配置缺失')
    }
    
    this.client = new RAGFlowTempKbClient({
      baseUrl: this.ragflowUrl,
      apiKey: this.apiKey
    })
  }

  /**
   * 获取或创建用户的临时知识库
   */
  async getOrCreateTempKb(userId: string): Promise<{
    success: boolean
    data?: TempKbInfo
    error?: string
  }> {
    try {
      // 1. 检查是否已存在
      let tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      if (tempKb && tempKb.status === 'ACTIVE') {
        // 更新最后活跃时间
        await prisma.userTempKnowledgeBase.update({
          where: { id: tempKb.id },
          data: { lastActiveAt: new Date() }
        })
        
        return {
          success: true,
          data: this.mapToTempKbInfo(tempKb)
        }
      }

      // 2. 创建新的临时知识库
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, chineseName: true }
      })

      // 生成可读的知识库名称: 用户名_日期_temp_序号
      const now = new Date()
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
      const userName = user?.chineseName || user?.username || 'user'
      // 格式: 张三_20251225_1430_temp_kb
      const kbName = `${userName}_${dateStr}_${timeStr}_temp_kb`

      // 在RAGFlow中创建知识库
      const createResult = await this.client.createDataset({
        name: kbName,
        description: `用户 ${user?.chineseName || user?.username || userId} 的临时知识图谱 (创建于 ${now.toLocaleString('zh-CN')})`,
        enableGraphRAG: true,
        graphRAGMethod: 'light',
        entityTypes: ['organization', 'person', 'geo', 'event', 'category', 'concept']
      })

      if (!createResult.success || !createResult.data) {
        return {
          success: false,
          error: createResult.error || '创建RAGFlow知识库失败'
        }
      }

      // 创建虚拟文档
      const docResult = await this.client.createVirtualDocument(
        createResult.data.id,
        'user_saved_knowledge'
      )

      // 3. 保存到数据库
      const newTempKb = await prisma.userTempKnowledgeBase.create({
        data: {
          userId,
          ragflowKbId: createResult.data.id,
          ragflowDocId: docResult.data?.documentId || null,
          ragflowUrl: this.ragflowUrl,
          apiKey: this.apiKey,
          status: 'ACTIVE',
          chunkCount: 0,
          nodeCount: 0,
          edgeCount: 0
        }
      })

      console.log('[TempKbService] 临时知识库创建成功:', {
        userId,
        tempKbId: newTempKb.id,
        ragflowKbId: createResult.data.id
      })

      return {
        success: true,
        data: this.mapToTempKbInfo(newTempKb)
      }
    } catch (error) {
      console.error('[TempKbService] 获取/创建临时知识库失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '操作失败'
      }
    }
  }

  /**
   * 保存知识片段
   */
  async saveChunk(params: SaveChunkParams): Promise<SaveChunkResult> {
    try {
      // 1. 获取或创建临时知识库
      const kbResult = await this.getOrCreateTempKb(params.userId)
      if (!kbResult.success || !kbResult.data) {
        return {
          success: false,
          error: kbResult.error || '获取临时知识库失败'
        }
      }

      let tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId: params.userId }
      })

      if (!tempKb) {
        return {
          success: false,
          error: '临时知识库不存在'
        }
      }

      // 如果虚拟文档未创建，尝试创建
      if (!tempKb.ragflowDocId) {
        console.log('[TempKbService] 虚拟文档未创建，尝试创建...')
        const docResult = await this.client.createVirtualDocument(
          tempKb.ragflowKbId,
          'user_saved_knowledge'
        )

        if (docResult.success && docResult.data?.documentId) {
          await prisma.userTempKnowledgeBase.update({
            where: { id: tempKb.id },
            data: { ragflowDocId: docResult.data.documentId }
          })
          tempKb = await prisma.userTempKnowledgeBase.findUnique({
            where: { userId: params.userId }
          })
        } else {
          console.error('[TempKbService] 创建虚拟文档失败:', docResult.error)
          return {
            success: false,
            error: '创建虚拟文档失败: ' + (docResult.error || '未知错误')
          }
        }
      }

      if (!tempKb || !tempKb.ragflowDocId) {
        return {
          success: false,
          error: '临时知识库文档初始化失败'
        }
      }

      // 2. 添加到RAGFlow
      const addResult = await this.client.addChunk({
        datasetId: tempKb.ragflowKbId,
        documentId: tempKb.ragflowDocId,
        content: params.content,
        keywords: params.keywords
      })

      // 3. 保存到数据库
      const savedChunk = await prisma.userSavedChunk.create({
        data: {
          tempKbId: tempKb.id,
          ragflowChunkId: addResult.data?.chunkId || null,
          content: params.content,
          contentSummary: params.content.substring(0, 200),
          keywords: params.keywords || [],
          sourceMessageId: params.sourceMessageId,
          sourceType: params.sourceType
        }
      })

      // 4. 更新计数
      await prisma.userTempKnowledgeBase.update({
        where: { id: tempKb.id },
        data: {
          chunkCount: { increment: 1 },
          lastActiveAt: new Date()
        }
      })

      console.log('[TempKbService] 知识片段保存成功:', {
        userId: params.userId,
        chunkId: savedChunk.id,
        ragflowChunkId: addResult.data?.chunkId
      })

      return {
        success: true,
        data: {
          chunkId: savedChunk.id,
          tempKbId: tempKb.id,
          ragflowChunkId: addResult.data?.chunkId
        }
      }
    } catch (error) {
      console.error('[TempKbService] 保存知识片段失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '保存失败'
      }
    }
  }

  /**
   * 触发图谱构建
   */
  async buildGraph(userId: string): Promise<{
    success: boolean
    data?: { taskId: string }
    error?: string
  }> {
    try {
      const tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      if (!tempKb) {
        return {
          success: false,
          error: '临时知识库不存在'
        }
      }

      // 更新状态为构建中
      await prisma.userTempKnowledgeBase.update({
        where: { id: tempKb.id },
        data: { status: 'BUILDING' }
      })

      // 触发RAGFlow图谱构建
      const result = await this.client.runGraphRAG(tempKb.ragflowKbId)

      if (!result.success) {
        // 恢复状态
        await prisma.userTempKnowledgeBase.update({
          where: { id: tempKb.id },
          data: { status: 'ACTIVE' }
        })
        return result
      }

      return result
    } catch (error) {
      console.error('[TempKbService] 触发图谱构建失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '构建失败'
      }
    }
  }

  /**
   * 获取图谱构建状态
   */
  async getGraphStatus(userId: string): Promise<{
    success: boolean
    data?: { status: string; progress?: number }
    error?: string
  }> {
    try {
      const tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      if (!tempKb) {
        return {
          success: false,
          error: '临时知识库不存在'
        }
      }

      const result = await this.client.getGraphRAGStatus(tempKb.ragflowKbId)

      // 如果构建完成，更新状态
      if (result.success && result.data?.status === 'completed') {
        await prisma.userTempKnowledgeBase.update({
          where: { id: tempKb.id },
          data: { status: 'ACTIVE' }
        })
      }

      return result
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取状态失败'
      }
    }
  }

  /**
   * 获取知识图谱数据
   */
  async getGraph(userId: string): Promise<GetGraphResult> {
    try {
      const tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      if (!tempKb) {
        return {
          success: false,
          error: '临时知识库不存在'
        }
      }

      const result = await this.client.getKnowledgeGraph(tempKb.ragflowKbId)

      // 更新图谱统计
      if (result.success && result.data) {
        await prisma.userTempKnowledgeBase.update({
          where: { id: tempKb.id },
          data: {
            nodeCount: result.data.nodeCount,
            edgeCount: result.data.edgeCount
          }
        })
      }

      return result
    } catch (error) {
      console.error('[TempKbService] 获取知识图谱失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取图谱失败'
      }
    }
  }

  /**
   * 获取用户保存的知识片段列表
   */
  async getSavedChunks(userId: string, limit: number = 50): Promise<{
    success: boolean
    data?: Array<{
      id: string
      content: string
      contentSummary: string | null
      keywords: string[]
      sourceType: string | null
      createdAt: Date
    }>
    error?: string
  }> {
    try {
      const tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      if (!tempKb) {
        return {
          success: true,
          data: []
        }
      }

      const chunks = await prisma.userSavedChunk.findMany({
        where: { tempKbId: tempKb.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          content: true,
          contentSummary: true,
          keywords: true,
          sourceType: true,
          createdAt: true
        }
      })

      return {
        success: true,
        data: chunks
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取列表失败'
      }
    }
  }

  /**
   * 删除知识片段
   */
  async deleteChunk(userId: string, chunkId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      if (!tempKb) {
        return {
          success: false,
          error: '临时知识库不存在'
        }
      }

      // 删除数据库记录
      await prisma.userSavedChunk.delete({
        where: {
          id: chunkId,
          tempKbId: tempKb.id
        }
      })

      // 更新计数
      await prisma.userTempKnowledgeBase.update({
        where: { id: tempKb.id },
        data: {
          chunkCount: { decrement: 1 }
        }
      })

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '删除失败'
      }
    }
  }

  /**
   * 清空临时知识库
   */
  async clearTempKb(userId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      if (!tempKb) {
        return { success: true }
      }

      console.log('[TempKbService] 开始清空临时知识库:', {
        userId,
        ragflowKbId: tempKb.ragflowKbId,
        ragflowUrl: tempKb.ragflowUrl
      })

      // 使用临时知识库自己存储的配置创建客户端
      const tempClient = new RAGFlowTempKbClient({
        baseUrl: tempKb.ragflowUrl,
        apiKey: tempKb.apiKey
      })

      // 删除RAGFlow知识库（带超时和错误处理）
      try {
        const deleteResult = await tempClient.deleteDataset(tempKb.ragflowKbId)
        if (!deleteResult.success) {
          console.warn('[TempKbService] RAGFlow删除失败，但继续删除本地记录:', deleteResult.error)
        } else {
          console.log('[TempKbService] RAGFlow知识库删除成功')
        }
      } catch (ragflowError) {
        // RAGFlow删除失败不阻塞本地数据库清理
        console.warn('[TempKbService] RAGFlow删除异常，继续删除本地记录:', ragflowError)
      }

      // 删除数据库记录（级联删除chunks）
      await prisma.userTempKnowledgeBase.delete({
        where: { id: tempKb.id }
      })

      console.log('[TempKbService] 临时知识库已清空:', { userId })

      return { success: true }
    } catch (error) {
      console.error('[TempKbService] 清空临时知识库失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '清空失败'
      }
    }
  }

  /**
   * 获取临时知识库信息
   */
  async getTempKbInfo(userId: string): Promise<{
    success: boolean
    data?: TempKbInfo | null
    error?: string
  }> {
    try {
      const tempKb = await prisma.userTempKnowledgeBase.findUnique({
        where: { userId }
      })

      return {
        success: true,
        data: tempKb ? this.mapToTempKbInfo(tempKb) : null
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取信息失败'
      }
    }
  }

  /**
   * 映射数据库模型到接口
   */
  private mapToTempKbInfo(tempKb: any): TempKbInfo {
    return {
      id: tempKb.id,
      ragflowKbId: tempKb.ragflowKbId,
      chunkCount: tempKb.chunkCount,
      nodeCount: tempKb.nodeCount,
      edgeCount: tempKb.edgeCount,
      status: tempKb.status,
      lastActiveAt: tempKb.lastActiveAt,
      createdAt: tempKb.createdAt
    }
  }
}

// 导出单例
export const tempKbService = new TempKbService()

