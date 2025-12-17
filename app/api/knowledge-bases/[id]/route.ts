/**
 * 单个知识库管理 API
 * 
 * GET /api/knowledge-bases/[id] - 获取知识库详情
 * PATCH /api/knowledge-bases/[id] - 更新知识库
 * DELETE /api/knowledge-bases/[id] - 删除知识库
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyUserAuth, verifyAdminAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// 更新知识库的验证 schema
const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
})

/**
 * 获取知识库详情
 * 
 * RAGFlow API: GET /v1/kb/detail?id=<kb_id>
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

    // 获取知识库配置
    const knowledgeBase = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId,
        isActive: true
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    })

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: "知识库不存在或已禁用" },
        { status: 404 }
      )
    }

    // 调用 RAGFlow API 获取详细信息
    const detailResult = await fetchKnowledgeBaseDetail(
      knowledgeBase.ragflowUrl,
      knowledgeBase.apiKey,
      knowledgeBase.kbId
    )

    if (!detailResult.success) {
      // 如果 RAGFlow API 失败，仍然返回数据库中的信息
      console.warn('获取 RAGFlow 详情失败:', detailResult.error)
    }

    return NextResponse.json({
      success: true,
      data: {
        ...knowledgeBase,
        ragflowDetail: detailResult.data
      }
    })

  } catch (error) {
    console.error('获取知识库详情失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 更新知识库
 * 
 * RAGFlow API: POST /v1/kb/update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyAdminAuth(request)
    
    if (!user) {
      return NextResponse.json({ error: "未授权，需要管理员权限" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateKnowledgeBaseSchema.parse(body)

    // 获取知识库配置
    const knowledgeBase = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId,
        isActive: true
      }
    })

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: "知识库不存在或已禁用" },
        { status: 404 }
      )
    }

    // 如果更新名称，检查是否重复
    if (validatedData.name && validatedData.name !== knowledgeBase.name) {
      const existing = await prisma.knowledgeGraph.findFirst({
        where: {
          companyId: user.companyId,
          name: validatedData.name,
          id: { not: id }
        }
      })

      if (existing) {
        return NextResponse.json(
          { error: "知识库名称已存在" },
          { status: 400 }
        )
      }
    }

    // 调用 RAGFlow API 更新知识库
    if (validatedData.name || validatedData.description) {
      const updateResult = await updateRAGFlowKnowledgeBase(
        knowledgeBase.ragflowUrl,
        knowledgeBase.apiKey,
        knowledgeBase.kbId,
        {
          name: validatedData.name,
          description: validatedData.description
        }
      )

      if (!updateResult.success) {
        console.warn('更新 RAGFlow 知识库失败:', updateResult.error)
        // 继续更新本地数据库
      }
    }

    // 更新数据库
    const updatedKnowledgeBase = await prisma.knowledgeGraph.update({
      where: { id },
      data: validatedData
    })

    return NextResponse.json({
      success: true,
      data: updatedKnowledgeBase,
      message: "知识库更新成功"
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "数据验证失败", details: error.errors },
        { status: 400 }
      )
    }

    console.error('更新知识库失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 删除知识库
 *
 * RAGFlow API: POST /v1/kb/rm
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyAdminAuth(request)

    if (!user) {
      return NextResponse.json({ error: "未授权，需要管理员权限" }, { status: 401 })
    }

    // 获取知识库配置
    const knowledgeBase = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId,
        isActive: true
      }
    })

    if (!knowledgeBase) {
      return NextResponse.json(
        { error: "知识库不存在或已禁用" },
        { status: 404 }
      )
    }

    // 调用 RAGFlow API 删除知识库
    const deleteResult = await deleteRAGFlowKnowledgeBase(
      knowledgeBase.ragflowUrl,
      knowledgeBase.apiKey,
      knowledgeBase.kbId
    )

    if (!deleteResult.success) {
      console.warn('删除 RAGFlow 知识库失败:', deleteResult.error)
      // 继续删除本地数据库记录
    }

    // 软删除：设置 isActive 为 false
    await prisma.knowledgeGraph.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json({
      success: true,
      message: "知识库删除成功"
    })

  } catch (error) {
    console.error('删除知识库失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

/**
 * 获取知识库详情
 */
async function fetchKnowledgeBaseDetail(
  baseUrl: string,
  apiKey: string,
  kbId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = `${baseUrl}/v1/kb/detail?id=${kbId}`

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

    if (result.retcode !== 0) {
      return {
        success: false,
        error: result.retmsg || '获取知识库详情失败'
      }
    }

    return {
      success: true,
      data: result.data
    }
  } catch (error) {
    console.error('获取知识库详情失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/**
 * 更新知识库
 */
async function updateRAGFlowKnowledgeBase(
  baseUrl: string,
  apiKey: string,
  kbId: string,
  data: {
    name?: string
    description?: string
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${baseUrl}/v1/kb/update`

    const requestBody: any = { id: kbId }
    if (data.name) requestBody.name = data.name
    if (data.description) requestBody.description = data.description

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
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

    if (result.retcode !== 0) {
      return {
        success: false,
        error: result.retmsg || '更新知识库失败'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('更新知识库失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

/**
 * 删除知识库
 */
async function deleteRAGFlowKnowledgeBase(
  baseUrl: string,
  apiKey: string,
  kbId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${baseUrl}/v1/kb/rm`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: [kbId]
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

    if (result.retcode !== 0) {
      return {
        success: false,
        error: result.retmsg || '删除知识库失败'
      }
    }

    return {
      success: true
    }
  } catch (error) {
    console.error('删除知识库失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

