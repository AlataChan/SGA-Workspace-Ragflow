/**
 * RAGFlow 代理 API - 解决 CORS 跨域问题
 * 
 * POST /api/ragflow/proxy/sessions - 创建会话
 * POST /api/ragflow/proxy/completions - 发送消息（流式）
 */

import { NextRequest } from 'next/server'

/**
 * POST /api/ragflow/proxy
 * 代理 RAGFlow 请求
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, baseUrl, apiKey, agentId, userId, sessionId, question } = body

    // 验证必要参数
    if (!baseUrl || !apiKey || !agentId) {
      return new Response(
        JSON.stringify({ code: 400, message: '缺少必要参数: baseUrl, apiKey, agentId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 清理 baseUrl 末尾的斜杠
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '')

    // 根据 action 执行不同操作
    if (action === 'createSession') {
      return await handleCreateSession(cleanBaseUrl, apiKey, agentId, userId)
    } else if (action === 'sendMessage') {
      if (!question) {
        return new Response(
          JSON.stringify({ code: 400, message: '缺少 question 参数' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return await handleSendMessage(cleanBaseUrl, apiKey, agentId, userId, sessionId, question)
    } else {
      return new Response(
        JSON.stringify({ code: 400, message: '无效的 action，支持: createSession, sendMessage' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
  } catch (error: any) {
    console.error('[RAGFlow Proxy] 错误:', error)
    return new Response(
      JSON.stringify({ code: 500, message: error.message || '代理请求失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * 创建会话
 */
async function handleCreateSession(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  userId: string
) {
  const url = `${baseUrl}/api/v1/chats/${agentId}/sessions`

  console.log('[RAGFlow Proxy] 创建会话:', { url, agentId, userId })

  // RAGFlow 要求 name 参数，生成一个带时间戳的会话名称
  const sessionName = `session_${Date.now()}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: sessionName,
      user_id: userId || 'anonymous'
    })
  })

  const data = await response.json()
  
  console.log('[RAGFlow Proxy] 创建会话响应:', { status: response.status, data })

  return new Response(JSON.stringify(data), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' }
  })
}

/**
 * 发送消息（流式）
 */
async function handleSendMessage(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  userId: string,
  sessionId: string | undefined,
  question: string
) {
  const url = `${baseUrl}/api/v1/chats/${agentId}/completions`

  const requestBody: Record<string, any> = {
    question,
    stream: true,
    user_id: userId || 'anonymous'
  }

  if (sessionId) {
    requestBody.session_id = sessionId
  }

  console.log('[RAGFlow Proxy] 发送消息:', {
    url,
    agentId,
    sessionId,
    questionLength: question.length,
    requestBody: JSON.stringify(requestBody)
  })

  // 添加超时控制
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error('[RAGFlow Proxy] 请求超时 (5分钟)')
    controller.abort()
  }, 5 * 60 * 1000) // 5 分钟超时

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    console.log('[RAGFlow Proxy] RAGFlow 响应:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[RAGFlow Proxy] API 错误:', { status: response.status, error: errorText })
      return new Response(
        JSON.stringify({ code: response.status, message: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 转发流式响应，添加日志
    const { readable, writable } = new TransformStream({
      transform(chunk, controller) {
        // 记录收到的数据块
        const text = new TextDecoder().decode(chunk)
        console.log('[RAGFlow Proxy] 收到数据块:', {
          size: chunk.byteLength,
          preview: text.substring(0, 200)
        })
        controller.enqueue(chunk)
      }
    })

    response.body?.pipeTo(writable).catch(err => {
      console.error('[RAGFlow Proxy] 流式传输错误:', err)
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    })
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      console.error('[RAGFlow Proxy] 请求被中止（超时）')
      return new Response(
        JSON.stringify({ code: 504, message: 'RAGFlow 请求超时，请检查 RAGFlow 服务状态' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )
    }
    throw error
  }
}

