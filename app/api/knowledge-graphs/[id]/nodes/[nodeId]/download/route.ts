import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

// 下载节点内容
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const { id, nodeId } = await params
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // 验证格式
    const allowedFormats = ['json', 'txt', 'csv', 'xlsx']
    if (!allowedFormats.includes(format)) {
      return NextResponse.json(
        { error: `不支持的格式: ${format}。支持的格式: ${allowedFormats.join(', ')}` },
        { status: 400 }
      )
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

    // 调用RAGFlow API下载节点内容
    const downloadResult = await downloadNodeContent(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId,
      nodeId,
      format
    )

    if (!downloadResult.success) {
      return NextResponse.json(
        { error: downloadResult.error },
        { status: 500 }
      )
    }

    // 设置响应头
    const headers = new Headers()
    
    if (format === 'json') {
      headers.set('Content-Type', 'application/json')
      headers.set('Content-Disposition', `attachment; filename="node_${nodeId}.json"`)
      return new NextResponse(JSON.stringify(downloadResult.data, null, 2), { headers })
    } else {
      // 对于其他格式，直接返回二进制数据
      const contentType = getContentType(format)
      headers.set('Content-Type', contentType)
      headers.set('Content-Disposition', `attachment; filename="node_${nodeId}.${format}"`)
      return new NextResponse(downloadResult.data, { headers })
    }

  } catch (error) {
    console.error('下载节点内容失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

// 调用RAGFlow API下载节点内容
async function downloadNodeContent(
  ragflowUrl: string,
  apiKey: string,
  kbId: string,
  nodeId: string,
  format: string
): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const baseUrl = ragflowUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/v1/datasets/${kbId}/nodes/${encodeURIComponent(nodeId)}/download?format=${format}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(60000) // 60秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `RAGFlow API错误: ${response.status} ${response.statusText} - ${errorText}`
      }
    }

    if (format === 'json') {
      const data = await response.json()
      return {
        success: true,
        data: data
      }
    } else {
      const data = await response.arrayBuffer()
      return {
        success: true,
        data: data
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: '下载请求超时'
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

// 获取内容类型
function getContentType(format: string): string {
  switch (format) {
    case 'txt':
      return 'text/plain'
    case 'csv':
      return 'text/csv'
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    default:
      return 'application/octet-stream'
  }
}
