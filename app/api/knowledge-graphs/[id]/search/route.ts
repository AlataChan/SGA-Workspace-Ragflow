import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

// 搜索请求验证模式
const searchSchema = z.object({
  query: z.string().min(1, "搜索关键词不能为空"),
  entityTypes: z.array(z.string()).optional().default([]),
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().min(1).max(100).optional().default(20),
})

// 搜索知识图谱节点
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = searchSchema.parse(body)

    // 获取知识图谱配置
    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId,
        isActive: true
      }
    })

    if (!knowledgeGraph) {
      return NextResponse.json(
        { error: "知识图谱不存在或已禁用" },
        { status: 404 }
      )
    }

    // 调用RAGFlow API搜索节点
    const searchResult = await searchRAGFlowNodes(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId,
      validatedData
    )

    if (!searchResult.success) {
      return NextResponse.json(
        { error: searchResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: searchResult.data
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "搜索参数验证失败",
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    console.error('搜索知识图谱节点失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

// 调用RAGFlow API搜索节点
async function searchRAGFlowNodes(
  ragflowUrl: string,
  apiKey: string,
  kbId: string,
  searchParams: {
    query: string
    entityTypes: string[]
    page: number
    pageSize: number
  }
): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const baseUrl = ragflowUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/v1/graphrag/kb/${kbId}/search`
    
    const requestBody = {
      query: searchParams.query,
      entity_types: searchParams.entityTypes.length > 0 ? searchParams.entityTypes : ["PERSON", "ORGANIZATION", "CONCEPT"],
      page: searchParams.page,
      page_size: searchParams.pageSize
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000) // 30秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `RAGFlow API错误: ${response.status} ${response.statusText} - ${errorText}`
      }
    }

    const data = await response.json()
    
    if (data.retcode !== 0) {
      return {
        success: false,
        error: `RAGFlow API返回错误: ${data.retmsg || '未知错误'}`
      }
    }

    return {
      success: true,
      data: data.data
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: '搜索请求超时'
        }
      }
      
      return {
        success: false,
        error: `网络错误: ${error.message}`
      }
    }
    
    return {
      success: false,
      error: '未知错误'
    }
  }
}
