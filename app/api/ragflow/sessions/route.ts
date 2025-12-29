/**
 * RAGFlow会话管理API
 * 
 * GET /api/ragflow/sessions - 获取会话列表
 * POST /api/ragflow/sessions - 创建新会话
 */

import { NextRequest, NextResponse } from 'next/server'
import { RAGFlowHTTPClient } from '@/lib/ragflow-http-client'

// 从环境变量获取配置
function getRAGFlowConfig() {
  const baseUrl = process.env.RAGFLOW_URL
  const apiKey = process.env.RAGFLOW_API_KEY
  const chatId = process.env.RAGFLOW_CHAT_ID

  if (!baseUrl || !apiKey || !chatId) {
    throw new Error('RAGFlow配置缺失，请检查环境变量')
  }

  return { baseUrl, apiKey, chatId }
}

/**
 * GET /api/ragflow/sessions
 * 获取会话列表
 */
export async function GET(request: NextRequest) {
  try {
    const config = getRAGFlowConfig()
    const client = new RAGFlowHTTPClient(config)

    const sessions = await client.listSessions()

    return NextResponse.json({
      code: 0,
      data: sessions,
      message: 'success',
    })
  } catch (error: any) {
    console.error('[RAGFlow Sessions] GET Error:', error)
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: error.message || '获取会话列表失败',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ragflow/sessions
 * 创建新会话
 */
export async function POST(request: NextRequest) {
  try {
    const config = getRAGFlowConfig()
    const client = new RAGFlowHTTPClient(config)

    const body = await request.json()
    const { name = '新对话' } = body

    const session = await client.createSession(name)

    return NextResponse.json({
      code: 0,
      data: session,
      message: 'success',
    })
  } catch (error: any) {
    console.error('[RAGFlow Sessions] POST Error:', error)
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: error.message || '创建会话失败',
      },
      { status: 500 }
    )
  }
}

