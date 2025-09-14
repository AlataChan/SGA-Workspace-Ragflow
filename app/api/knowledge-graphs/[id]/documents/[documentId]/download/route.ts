import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

// 下载文档
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id, documentId } = await params
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

    // 调用RAGFlow API下载文档
    const downloadResult = await downloadDocument(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId,
      documentId
    )

    if (!downloadResult.success) {
      return NextResponse.json(
        { error: downloadResult.error },
        { status: 500 }
      )
    }

    // 返回文件流
    return new NextResponse(downloadResult.fileStream, {
      headers: {
        'Content-Type': downloadResult.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${downloadResult.filename || 'download'}"`,
      },
    })

  } catch (error) {
    console.error('下载文档失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

// 调用RAGFlow API下载文档
async function downloadDocument(
  ragflowUrl: string,
  apiKey: string,
  kbId: string,
  documentId: string
): Promise<{
  success: boolean
  fileStream?: ReadableStream
  contentType?: string
  filename?: string
  error?: string
}> {
  try {
    const baseUrl = ragflowUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/v1/datasets/${kbId}/documents/${documentId}`
    
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

    // 获取文件名
    const contentDisposition = response.headers.get('content-disposition')
    let filename = 'download'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch) {
        filename = filenameMatch[1].replace(/['"]/g, '')
      }
    }

    return {
      success: true,
      fileStream: response.body,
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      filename
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: '下载超时'
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
