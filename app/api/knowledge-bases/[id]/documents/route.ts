/**
 * 知识库文档管理 API
 * 
 * GET /api/knowledge-bases/[id]/documents - 获取文档列表
 * POST /api/knowledge-bases/[id]/documents - 上传文档
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * 获取知识库文档列表
 * 
 * RAGFlow API: GET /v1/document/list?kb_id=<kb_id>
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

    // 获取知识图谱配置（包含 kbId）
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

    // 获取查询参数
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('page_size') || '20')

    // 调用 RAGFlow API 获取文档列表
    const documentsResult = await fetchDocumentList(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId,
      page,
      pageSize
    )

    if (!documentsResult.success) {
      return NextResponse.json(
        { error: documentsResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: documentsResult.data
    })

  } catch (error) {
    console.error('获取文档列表失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 上传文档到知识库
 * 
 * RAGFlow API: POST /v1/document/upload
 */
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

    // 获取上传的文件
    const formData = await request.formData()
    const file = formData.get('file') as File
    const run = formData.get('run') === '1' || formData.get('run') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: "未提供文件" },
        { status: 400 }
      )
    }

    // 调用 RAGFlow API 上传文档
    const uploadResult = await uploadDocument(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId,
      file,
      run
    )

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: uploadResult.data,
      message: "文档上传成功"
    })

  } catch (error) {
    console.error('上传文档失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 获取文档列表
 */
async function fetchDocumentList(
  baseUrl: string,
  apiKey: string,
  kbId: string,
  page: number,
  pageSize: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = `${baseUrl}/v1/document/list?kb_id=${kbId}&page=${page}&page_size=${pageSize}`

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
        error: result.retmsg || '获取文档列表失败'
      }
    }

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('获取文档列表失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/**
 * 上传文档
 */
async function uploadDocument(
  baseUrl: string,
  apiKey: string,
  kbId: string,
  file: File,
  run: boolean
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = `${baseUrl}/v1/document/upload`

    const formData = new FormData()
    formData.append('file', file)
    formData.append('kb_id', kbId)
    formData.append('run', run ? '1' : '0')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
      },
      body: formData
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
        error: result.retmsg || '上传文档失败'
      }
    }

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('上传文档失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

