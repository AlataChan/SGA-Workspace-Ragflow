import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyAdminAuth } from "@/lib/auth/admin"

const prisma = new PrismaClient()

/**
 * 启动知识图谱构建
 * 
 * RAGFlow API: POST /v1/kb/run_graphrag
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyAdminAuth(request)
    
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

    // 调用 RAGFlow API 启动图谱构建
    const buildResult = await startGraphBuild(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId
    )

    if (!buildResult.success) {
      return NextResponse.json(
        { error: buildResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: buildResult.data,
      message: "知识图谱构建已启动"
    })

  } catch (error) {
    console.error('启动知识图谱构建失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

/**
 * 调用 RAGFlow API 启动图谱构建
 */
async function startGraphBuild(
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
    const url = `${baseUrl}/v1/kb/run_graphrag`
    
    console.log('[KnowledgeGraph] 启动图谱构建:', {
      url,
      kbId
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,  // Web UI API 使用 JWT Token
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kb_id: kbId
      }),
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
        error: result.retmsg || '启动图谱构建失败'
      }
    }

    // 返回任务信息
    return {
      success: true,
      data: {
        taskId: result.data?.task_id,
        status: result.data?.status || 'running',
        kbId: kbId
      }
    }

  } catch (error) {
    console.error('[KnowledgeGraph] 启动图谱构建异常:', error)
    
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

