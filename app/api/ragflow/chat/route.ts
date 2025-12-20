/**
 * RAGFlow聊天API - 支持流式输出
 * 
 * POST /api/ragflow/chat - 发送消息（流式）
 */

import { NextRequest } from 'next/server'
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
 * POST /api/ragflow/chat
 * 发送消息（流式输出）
 */
export async function POST(request: NextRequest) {
  try {
    const config = getRAGFlowConfig()
    const client = new RAGFlowHTTPClient(config)

    const body = await request.json()
    const { sessionId, question } = body

    if (!sessionId || !question) {
      return new Response(
        JSON.stringify({
          code: 400,
          message: '缺少sessionId或question参数',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // 创建SSE流
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await client.sendMessageStream(
            sessionId,
            question,
            (message) => {
              // 发送消息到客户端
              const data = `data: ${JSON.stringify(message)}\n\n`
              controller.enqueue(encoder.encode(data))
            },
            () => {
              // 完成
              const data = `data: ${JSON.stringify({ type: 'complete' })}\n\n`
              controller.enqueue(encoder.encode(data))
              controller.close()
            },
            (error) => {
              // 错误
              const data = `data: ${JSON.stringify({ type: 'error', content: error })}\n\n`
              controller.enqueue(encoder.encode(data))
              controller.close()
            }
          )
        } catch (error: any) {
          const data = `data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`
          controller.enqueue(encoder.encode(data))
          controller.close()
        }
      },
      cancel() {
        // 取消请求
        client.cancel()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('[RAGFlow Chat] POST Error:', error)
    return new Response(
      JSON.stringify({
        code: 500,
        message: error.message || '发送消息失败',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

