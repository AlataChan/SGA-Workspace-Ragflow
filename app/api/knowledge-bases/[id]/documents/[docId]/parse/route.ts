/**
 * 文档手动解析 API
 * 
 * POST /api/knowledge-bases/[id]/documents/[docId]/parse - 手动触发解析
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * 手动触发文档解析
 * 
 * RAGFlow API: POST /v1/document/run
 */
export async function POST(
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

    // 调用 RAGFlow API 触发解析
    const parseResult = await triggerDocumentParsing(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      docId
    )

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "文档解析已启动"
    })

  } catch (error) {
    console.error('触发文档解析失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 触发文档解析
 */
async function triggerDocumentParsing(
  baseUrl: string,
  apiKey: string,
  docId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${baseUrl}/v1/document/run`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        doc_ids: [docId]
      })
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
        error: result.retmsg || '触发解析失败'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('触发文档解析失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

