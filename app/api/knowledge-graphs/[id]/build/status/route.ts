import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

/**
 * 查询知识图谱构建进度
 * 
 * RAGFlow API: GET /v1/kb/trace_graphrag?kb_id=<kb_id>
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyUserAuth(request)
    
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

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

    // 调用 RAGFlow API 查询构建进度
    const statusResult = await fetchBuildStatus(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId
    )

    if (!statusResult.success) {
      return NextResponse.json(
        { error: statusResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: statusResult.data
    })

  } catch (error) {
    console.error('查询知识图谱构建进度失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

/**
 * 调用 RAGFlow API 查询构建进度
 */
async function fetchBuildStatus(
  ragflowUrl: string,
  apiKey: string,
  kbId: string
): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const baseUrl = ragflowUrl.replace(/\/$/, '')
    const url = `${baseUrl}/v1/kb/trace_graphrag?kb_id=${kbId}`
    
    console.log('[KnowledgeGraph] 查询构建进度:', {
      url,
      kbId
    })

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,  // Web UI API 使用 JWT Token
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000) // 30秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[KnowledgeGraph] RAGFlow API 错误:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      
      return {
        success: false,
        error: `RAGFlow API 请求失败: ${response.status} ${response.statusText}`
      }
    }

    const result = await response.json()
    
    // RAGFlow Web UI API 使用 retcode 字段
    if (result.retcode !== 0) {
      return {
        success: false,
        error: result.retmsg || '查询构建进度失败'
      }
    }

    // 转换数据格式
    const data = result.data || {}
    
    return {
      success: true,
      data: {
        status: data.status || 'unknown',  // running, completed, failed
        progress: data.progress || 0,
        message: data.message || '',
        nodeCount: data.node_count || 0,
        edgeCount: data.edge_count || 0,
        kbId: kbId
      }
    }

  } catch (error) {
    console.error('[KnowledgeGraph] 查询构建进度异常:', error)
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: '请求超时，请稍后重试'
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: '未知错误'
    }
  }
}

