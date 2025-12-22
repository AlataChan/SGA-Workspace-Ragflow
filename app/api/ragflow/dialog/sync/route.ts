/**
 * Dialog 同步 API
 * POST /api/ragflow/dialog/sync
 * 
 * 功能：为用户创建/更新关联多知识库的 RAGFlow Dialog
 * 用途：实现私人知识库优先，公有知识库次之的检索策略
 * 架构：薄封装，直接转发到 RAGFlow API
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'
import { cookies } from 'next/headers'

/**
 * 获取 RAGFlow 配置
 */
function getRAGFlowConfig() {
  const baseUrl = process.env.RAGFLOW_URL
  const apiKey = process.env.RAGFLOW_API_KEY
  const publicKbId = process.env.RAGFLOW_PUBLIC_KB_ID // 公有知识库 ID

  if (!baseUrl || !apiKey) {
    throw new Error('RAGFlow 配置缺失')
  }

  return { baseUrl, apiKey, publicKbId }
}

/**
 * 获取当前用户
 */
async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (!token) return null

  try {
    const payload = await verifyToken(token)
    if (!payload?.userId) return null

    return prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true }
    })
  } catch {
    return null
  }
}

/**
 * POST /api/ragflow/dialog/sync
 * 同步用户的 Dialog（多知识库配置）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 认证
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { code: 401, message: '未登录或登录已过期' },
        { status: 401 }
      )
    }

    // 2. 获取用户的知识库映射
    const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
      where: { userId: user.id, isDefault: true }
    })

    if (!mapping) {
      return NextResponse.json(
        { code: 404, message: '私人知识库不存在，请先初始化' },
        { status: 404 }
      )
    }

    // 3. 构建知识库列表（私人优先，公有次之）
    const config = getRAGFlowConfig()
    const datasetIds = [mapping.ragflowKbId]
    
    // 如果配置了公有知识库，添加到列表
    if (config.publicKbId) {
      datasetIds.push(config.publicKbId)
    }

    // 4. 创建或更新 Dialog
    const dialogName = `user_${user.id}_assistant`
    const isUpdate = !!mapping.ragflowDialogId

    const url = isUpdate
      ? `${config.baseUrl}/api/v1/chats/${mapping.ragflowDialogId}`
      : `${config.baseUrl}/api/v1/chats`

    const response = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: dialogName,
        dataset_ids: datasetIds,
        similarity_threshold: 0.2,
        top_n: 6,
        llm: {
          model_name: process.env.RAGFLOW_LLM_MODEL || 'gpt-3.5-turbo',
          temperature: 0.7
        }
      })
    })

    const result = await response.json()

    if (result.code !== 0) {
      console.error('[Dialog Sync] RAGFlow 返回错误:', result)
      return NextResponse.json(result, { status: response.status })
    }

    // 5. 更新本地映射
    const dialogId = result.data?.id || mapping.ragflowDialogId

    if (dialogId && dialogId !== mapping.ragflowDialogId) {
      await prisma.userKnowledgeBaseMapping.update({
        where: { id: mapping.id },
        data: { ragflowDialogId: dialogId }
      })
    }

    console.log('[Dialog Sync] 同步成功:', {
      userId: user.id,
      dialogId,
      datasetIds,
      isUpdate
    })

    return NextResponse.json({
      code: 0,
      message: isUpdate ? 'Dialog 更新成功' : 'Dialog 创建成功',
      data: {
        dialogId,
        datasetIds,
        dialogName
      }
    })

  } catch (error: any) {
    console.error('[Dialog Sync] 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || 'Dialog 同步失败' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/ragflow/dialog/sync
 * 获取用户的 Dialog 配置
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { code: 401, message: '未登录或登录已过期' },
        { status: 401 }
      )
    }

    const mapping = await prisma.userKnowledgeBaseMapping.findFirst({
      where: { userId: user.id, isDefault: true }
    })

    if (!mapping || !mapping.ragflowDialogId) {
      return NextResponse.json({
        code: 404,
        message: 'Dialog 不存在，请先同步',
        data: null
      })
    }

    return NextResponse.json({
      code: 0,
      message: 'success',
      data: {
        dialogId: mapping.ragflowDialogId,
        ragflowKbId: mapping.ragflowKbId
      }
    })

  } catch (error: any) {
    console.error('[Dialog Sync] GET 错误:', error)
    return NextResponse.json(
      { code: 500, message: error.message || '获取 Dialog 配置失败' },
      { status: 500 }
    )
  }
}

