/**
 * 知识库管理 API
 * 
 * GET /api/knowledge-bases - 获取知识库列表
 * POST /api/knowledge-bases - 创建知识库
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth, verifyAdminAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// 创建知识库的验证 schema
const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, "知识库名称不能为空"),
  description: z.string().optional(),
  ragflowUrl: z.string().url("RAGFlow URL 格式不正确"),
  apiKey: z.string().min(1, "API Key 不能为空"),
  embeddingModel: z.string().optional(),
  chunkMethod: z.string().optional(),
  parserConfig: z.record(z.any()).optional(),
})

/**
 * 获取知识库列表
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取用户公司的所有知识库
    const knowledgeBases = await prisma.knowledgeGraph.findMany({
      where: {
        companyId: user.companyId,
        isActive: true
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        kbId: true,
        ragflowUrl: true,
        nodeCount: true,
        edgeCount: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      data: knowledgeBases
    })

  } catch (error) {
    console.error('获取知识库列表失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 创建知识库
 * 
 * RAGFlow API: POST /api/v1/datasets
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdminAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权，需要管理员权限" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createKnowledgeBaseSchema.parse(body)

    // 检查名称是否已存在
    const existing = await prisma.knowledgeGraph.findFirst({
      where: {
        companyId: user.companyId,
        name: validatedData.name
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: "知识库名称已存在" },
        { status: 400 }
      )
    }

    // 调用 RAGFlow API 创建知识库
    const createResult = await createRAGFlowKnowledgeBase(
      validatedData.ragflowUrl,
      validatedData.apiKey,
      {
        name: validatedData.name,
        description: validatedData.description,
        embedding_model: validatedData.embeddingModel,
        chunk_method: validatedData.chunkMethod || 'naive',
        parser_config: validatedData.parserConfig
      }
    )

    if (!createResult.success) {
      return NextResponse.json(
        { error: createResult.error },
        { status: 500 }
      )
    }

    // 获取最大排序值
    const maxSortOrder = await prisma.knowledgeGraph.findFirst({
      where: { companyId: user.companyId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true }
    })

    // 在数据库中创建知识库记录
    const newKnowledgeBase = await prisma.knowledgeGraph.create({
      data: {
        companyId: user.companyId,
        name: validatedData.name,
        description: validatedData.description,
        ragflowUrl: validatedData.ragflowUrl,
        apiKey: validatedData.apiKey,
        kbId: createResult.data.id,
        sortOrder: (maxSortOrder?.sortOrder || 0) + 1,
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: newKnowledgeBase,
      message: "知识库创建成功"
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "数据验证失败", details: error.errors },
        { status: 400 }
      )
    }

    console.error('创建知识库失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 调用 RAGFlow API 创建知识库
 */
async function createRAGFlowKnowledgeBase(
  baseUrl: string,
  apiKey: string,
  data: {
    name: string
    description?: string
    embedding_model?: string
    chunk_method?: string
    parser_config?: any
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = `${baseUrl}/api/v1/datasets`

    const requestBody: any = {
      name: data.name,
      permission: 'me',
      chunk_method: data.chunk_method || 'naive',
    }

    if (data.description) {
      requestBody.description = data.description
    }

    if (data.embedding_model) {
      requestBody.embedding_model = data.embedding_model
    }

    if (data.parser_config) {
      requestBody.parser_config = data.parser_config
    }

    console.log('[创建知识库] 请求:', { url, body: requestBody })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('RAGFlow API 错误:', errorText)
      return {
        success: false,
        error: `RAGFlow API 请求失败: ${response.status} ${response.statusText}`
      }
    }

    const result = await response.json()
    console.log('[创建知识库] 响应:', result)

    // RAGFlow 使用 retcode 字段
    if (result.retcode !== 0) {
      return {
        success: false,
        error: result.retmsg || '创建知识库失败'
      }
    }

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('创建知识库失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}
