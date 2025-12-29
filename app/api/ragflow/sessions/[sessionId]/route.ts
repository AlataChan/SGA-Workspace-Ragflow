/**
 * RAGFlow单个会话管理API
 * 
 * DELETE /api/ragflow/sessions/[sessionId] - 删除会话
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
 * DELETE /api/ragflow/sessions/[sessionId]
 * 删除会话
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const config = getRAGFlowConfig()
    const client = new RAGFlowHTTPClient(config)

    const { sessionId } = params

    if (!sessionId) {
      return NextResponse.json(
        {
          code: 400,
          data: null,
          message: '缺少sessionId参数',
        },
        { status: 400 }
      )
    }

    await client.deleteSession(sessionId)

    return NextResponse.json({
      code: 0,
      data: null,
      message: 'success',
    })
  } catch (error: any) {
    console.error('[RAGFlow Sessions] DELETE Error:', error)
    return NextResponse.json(
      {
        code: 500,
        data: null,
        message: error.message || '删除会话失败',
      },
      { status: 500 }
    )
  }
}

