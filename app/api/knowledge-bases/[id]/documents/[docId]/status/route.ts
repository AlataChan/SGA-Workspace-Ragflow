/**
 * 文档解析状态查询 API
 * 
 * GET /api/knowledge-bases/[id]/documents/[docId]/status - 查询解析状态
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * 查询文档解析状态
 * 
 * RAGFlow API: GET /v1/document/list?kb_id=<kb_id>
 * 从文档列表中找到指定文档的状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
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
        { error: "知识库不存在或已禁用" },
        { status: 404 }
      )
    }

    // 调用 RAGFlow API 获取文档状态
    const statusResult = await fetchDocumentStatus(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId,
      docId
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
    console.error('查询文档状态失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 获取文档解析状态
 */
async function fetchDocumentStatus(
  baseUrl: string,
  apiKey: string,
  kbId: string,
  docId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 获取文档列表，找到指定文档
    const url = `${baseUrl}/v1/document/list?kb_id=${kbId}&page=1&page_size=100`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
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
    
    // RAGFlow 使用 retcode 字段
    if (result.retcode !== 0) {
      return {
        success: false,
        error: result.retmsg || '获取文档状态失败'
      }
    }

    // 从文档列表中找到指定文档
    const docs = result.data?.docs || []
    const targetDoc = docs.find((doc: any) => doc.id === docId)

    if (!targetDoc) {
      return {
        success: false,
        error: '文档不存在'
      }
    }

    // 转换状态格式
    const status = targetDoc.status === '1' ? 'completed' : 
                   targetDoc.status === '2' ? 'failed' : 
                   'parsing'

    return {
      success: true,
      data: {
        docId: targetDoc.id,
        name: targetDoc.name,
        status: status,
        progress: targetDoc.progress || 0,
        chunkNum: targetDoc.chunk_num || 0,
        tokenNum: targetDoc.token_num || 0,
        size: targetDoc.size || 0,
        createTime: targetDoc.create_time
      }
    }
  } catch (error) {
    console.error('获取文档状态失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

