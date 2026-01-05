/**
 * RAGFlow 统一代理 API - 基于 Agent ID 自动获取配置
 *
 * POST /api/agents/{agentId}/ragflow
 *
 * Actions:
 *   - createSession: 创建会话
 *   - sendMessage: 发送消息（流式）
 *   - listSessions: 获取会话列表
 *   - getHistory: 获取会话历史
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyUserAuth } from '@/lib/auth/user'

export const dynamic = 'force-dynamic'

type RagflowIdType = 'CHAT' | 'AGENT'

function normalizeIdType(value: unknown): RagflowIdType {
  return value === 'AGENT' ? 'AGENT' : 'CHAT'
}

function deriveSessionNameFromQuestion(question: unknown): string {
  const text = String(question ?? '').trim().replace(/\s+/g, ' ')
  if (!text) return `session_${Date.now()}`
  return text.length > 30 ? `${text.slice(0, 30)}...` : text
}

function normalizeRagflowBaseUrl(value: unknown): string {
  let base = String(value ?? '').trim()
  base = base.replace(/\/+$/, '')
  base = base.replace(/\/api\/v1$/i, '')
  base = base.replace(/\/v1$/i, '')
  return base.replace(/\/+$/, '')
}

// 获取 Agent 的 RAGFlow 配置
async function getAgentRAGFlowConfig(agentId: string, companyId?: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      ...(companyId ? { companyId } : {})
    }
  })

  if (!agent) {
    return { error: 'Agent not found', status: 404 }
  }

  if (agent.platform !== 'RAGFLOW') {
    return { error: 'Agent platform is not RAGFlow', status: 400 }
  }

  const platformConfig = agent.platformConfig as Record<string, any> | null
  const baseUrl = normalizeRagflowBaseUrl(platformConfig?.baseUrl)
  const apiKey = platformConfig?.apiKey
  const ragflowId = platformConfig?.agentId
  const idType = normalizeIdType(platformConfig?.idType)

  if (!baseUrl || !apiKey || !ragflowId) {
    return { error: 'RAGFlow agent config is incomplete', status: 400 }
  }

  return {
    baseUrl,
    apiKey,
    ragflowId,
    idType,
    agent
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params

    // 验证用户身份
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    // 获取 Agent 配置
    const config = await getAgentRAGFlowConfig(agentId, user.companyId)
    if ('error' in config) {
      return NextResponse.json({ error: config.error }, { status: config.status })
    }

    const { baseUrl, apiKey, ragflowId, idType } = config

    // 解析请求体
    const body = await request.json()
    const { action, userId, sessionId, sessionName, question, page = 1, pageSize = 20 } = body

    // 使用认证用户的 ID
    const effectiveUserId = userId || user.userId || 'anonymous'

    // 根据 action 执行不同操作
    switch (action) {
      case 'createSession':
        if (idType === 'CHAT') {
          const name = sessionName || deriveSessionNameFromQuestion(question)
          return await handleChatCreateSession(baseUrl, apiKey, ragflowId, effectiveUserId, name)
        }
        // Agent 会话创建 API 已废弃，且不支持 name。统一由 /agents/{agent_id}/completions 自动生成 session_id。
        return NextResponse.json({
          success: true,
          data: { sessionId: null }
        })

      case 'sendMessage':
        if (!question) {
          return NextResponse.json({ error: '缺少 question 参数' }, { status: 400 })
        }
        if (idType === 'CHAT') {
          return await handleChatSendMessage(
            baseUrl,
            apiKey,
            ragflowId,
            effectiveUserId,
            sessionId,
            sessionName,
            question
          )
        }
        return await handleAgentSendMessage(baseUrl, apiKey, ragflowId, effectiveUserId, sessionId, question)

      case 'listSessions':
        if (idType === 'CHAT') {
          return await handleChatListSessions(baseUrl, apiKey, ragflowId, effectiveUserId, page, pageSize)
        }
        return await handleAgentListSessions(baseUrl, apiKey, ragflowId, effectiveUserId, page, pageSize)

      case 'getHistory':
        if (!sessionId) {
          return NextResponse.json({ error: '缺少 sessionId 参数' }, { status: 400 })
        }
        if (idType === 'CHAT') {
          return await handleChatGetHistory(baseUrl, apiKey, ragflowId, sessionId)
        }
        return await handleAgentGetHistory(baseUrl, apiKey, ragflowId, effectiveUserId, sessionId)

      case 'deleteSession':
        if (!sessionId) {
          return NextResponse.json({ error: '缺少 sessionId 参数' }, { status: 400 })
        }
        if (idType === 'CHAT') {
          return await handleChatDeleteSession(baseUrl, apiKey, ragflowId, sessionId)
        }
        return await handleAgentDeleteSessions(baseUrl, apiKey, ragflowId, [sessionId])

      case 'renameSession':
        if (!sessionId || !sessionName) {
          return NextResponse.json({ error: '缺少 sessionId 或 sessionName 参数' }, { status: 400 })
        }
        if (idType !== 'CHAT') {
          return NextResponse.json({ error: 'Agent 会话不支持重命名' }, { status: 400 })
        }
        return await handleChatRenameSession(baseUrl, apiKey, ragflowId, sessionId, sessionName)

      default:
        return NextResponse.json(
          { error: '无效的 action，支持: createSession, sendMessage, listSessions, getHistory, deleteSession, renameSession' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('[RAGFlow Agent Proxy] 错误:', error)
    return NextResponse.json(
      { error: error.message || '代理请求失败' },
      { status: 500 }
    )
  }
}

/**
 * 创建会话（Chat Assistant）
 */
async function handleChatCreateSession(
  baseUrl: string,
  apiKey: string,
  chatId: string,
  userId: string,
  name: string
) {
  const url = `${baseUrl}/api/v1/chats/${chatId}/sessions`
  const sessionName = name || `session_${Date.now()}`

  console.log('[RAGFlow Agent Proxy] 创建会话(Chat):', { url, chatId, userId, sessionName })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: sessionName,
      user_id: userId
    }),
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json()
  console.log('[RAGFlow Agent Proxy] 创建会话响应:', { status: response.status, code: data.code })

  if (!response.ok || data.code !== 0) {
    const message = String(data.message || '')
    if (message.toLowerCase().includes('you do not own the assistant')) {
      return NextResponse.json(
        {
          error:
            'RAGFlow 权限不足：该 API Key 不拥有此 Chat Assistant（You do not own the assistant）。请用该助手所属账号的 API Key，或在当前账号下创建/复制该 Chat Assistant 后再填写 ID。'
        },
        { status: 403 }
      )
    }
    return NextResponse.json(
      { error: data.message || '创建会话失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  return NextResponse.json({
    success: true,
    data: {
      sessionId: data.data?.id,
      name: data.data?.name,
      createTime: data.data?.create_time
    }
  })
}

/**
 * 发送消息（Chat Assistant，流式）
 */
async function handleChatSendMessage(
  baseUrl: string,
  apiKey: string,
  chatId: string,
  userId: string,
  sessionId: string | undefined,
  sessionName: string | undefined,
  question: string
) {
  const url = `${baseUrl}/api/v1/chats/${chatId}/completions`

  // chat assistant 若不传 session_id 会自动生成，但无法命名；这里在首轮缺失时主动创建 session 并带上 name
  let effectiveSessionId = sessionId
  if (!effectiveSessionId) {
    const name = sessionName || deriveSessionNameFromQuestion(question)
    const created = await handleChatCreateSession(baseUrl, apiKey, chatId, userId, name)
    const createdJson = await created.json()
    if (!created.ok || !createdJson?.success || !createdJson?.data?.sessionId) {
      return NextResponse.json(
        { error: createdJson?.error || '创建会话失败' },
        { status: created.status || 400 }
      )
    }
    effectiveSessionId = createdJson.data.sessionId
  }

  const requestBody: Record<string, any> = {
    question,
    stream: true,
    user_id: userId
  }

  requestBody.session_id = effectiveSessionId

  console.log('[RAGFlow Agent Proxy] 发送消息:', {
    url,
    chatId,
    sessionId: effectiveSessionId,
    questionLength: question.length
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.error('[RAGFlow Agent Proxy] 请求超时 (5分钟)')
    controller.abort()
  }, 5 * 60 * 1000)

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

    if (!response.ok) {
      const errorText = await response.text()
      const normalizedError = errorText.toLowerCase()
      console.error('[RAGFlow Agent Proxy] API 错误:', { status: response.status, error: errorText })
      if (normalizedError.includes('you do not own the assistant')) {
        return new Response(
          JSON.stringify({
            error:
              'RAGFlow 权限不足：该 API Key 不拥有此 Chat Assistant（You do not own the assistant）。请用该助手所属账号的 API Key，或在当前账号下创建/复制该 Chat Assistant 后再填写 ID。'
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 转发流式响应
    const { readable, writable } = new TransformStream()
    response.body?.pipeTo(writable).catch(err => {
      console.error('[RAGFlow Agent Proxy] 流式传输错误:', err)
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
      return new Response(
        JSON.stringify({ error: 'RAGFlow 请求超时' }),
        { status: 504, headers: { 'Content-Type': 'application/json' } }
      )
    }
    throw error
  }
}

/**
 * 获取会话列表（Chat Assistant）
 */
async function handleChatListSessions(
  baseUrl: string,
  apiKey: string,
  chatId: string,
  userId: string,
  page: number,
  pageSize: number
) {
  const url = new URL(`${baseUrl}/api/v1/chats/${chatId}/sessions`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('user_id', userId)

  console.log('[RAGFlow Agent Proxy] 获取会话列表:', { url: url.toString() })

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json()

  if (!response.ok || data.code !== 0) {
    return NextResponse.json(
      { error: data.message || '获取会话列表失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  return NextResponse.json({
    success: true,
    data: data.data || [],
    hasMore: (data.data?.length || 0) === pageSize
  })
}

/**
 * 获取会话历史（Chat Assistant）
 */
async function handleChatGetHistory(
  baseUrl: string,
  apiKey: string,
  chatId: string,
  sessionId: string
) {
  const url = `${baseUrl}/api/v1/chats/${chatId}/sessions?id=${sessionId}`

  console.log('[RAGFlow Agent Proxy] 获取会话历史:', { url })

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json()

  if (!response.ok || data.code !== 0) {
    return NextResponse.json(
      { error: data.message || '获取会话历史失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  const session = data.data?.[0]
  return NextResponse.json({
    success: true,
    data: {
      sessionId: session?.id,
      name: session?.name,
      messages: session?.messages || []
    }
  })
}

/**
 * 删除会话（Chat Assistant）
 */
async function handleChatDeleteSession(
  baseUrl: string,
  apiKey: string,
  chatId: string,
  sessionId: string
) {
  // 官方接口：DELETE /api/v1/chats/{chat_id}/sessions，body: { ids: [...] }
  const url = `${baseUrl}/api/v1/chats/${chatId}/sessions`

  console.log('[RAGFlow Agent Proxy] 删除会话:', { url })

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [sessionId] }),
    signal: AbortSignal.timeout(30000)
  })

  // 204: 无内容但成功
  if (response.status === 204) {
    return NextResponse.json({ success: true })
  }

  const data = await response.json().catch(() => ({} as any))

  if (!response.ok || (typeof data?.code === 'number' && data.code !== 0)) {
    return NextResponse.json(
      { error: data.message || '删除会话失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  return NextResponse.json({ success: true })
}

/**
 * 重命名会话（Chat Assistant）
 */
async function handleChatRenameSession(
  baseUrl: string,
  apiKey: string,
  chatId: string,
  sessionId: string,
  name: string
) {
  const url = `${baseUrl}/api/v1/chats/${chatId}/sessions/${sessionId}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name }),
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.code !== 0) {
    return NextResponse.json(
      { error: data.message || '重命名会话失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  return NextResponse.json({ success: true, data: { name } })
}

/**
 * 发送消息（Agent，流式）
 */
async function handleAgentSendMessage(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  userId: string,
  sessionId: string | undefined,
  question: string
) {
  const url = `${baseUrl}/api/v1/agents/${agentId}/completions`

  const requestBody: Record<string, any> = {
    question,
    stream: true,
    user_id: userId
  }
  if (sessionId) requestBody.session_id = sessionId

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000)

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

    if (!response.ok) {
      const errorText = await response.text()
      const normalizedError = errorText.toLowerCase()
      if (normalizedError.includes("don't own the agent") || normalizedError.includes('do not own the agent')) {
        return new Response(
          JSON.stringify({
            error:
              "RAGFlow 权限不足：该 API Key 不拥有此 Agent（You don't own the agent）。请用该 Agent 所属账号的 API Key，或在当前账号下创建/复制该 Agent 后再填写 ID。"
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: errorText }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { readable, writable } = new TransformStream()
    response.body?.pipeTo(writable).catch(() => {})
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
      return new Response(JSON.stringify({ error: 'RAGFlow 请求超时' }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    throw error
  }
}

/**
 * 获取会话列表（Agent）
 */
async function handleAgentListSessions(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  userId: string,
  page: number,
  pageSize: number
) {
  const url = new URL(`${baseUrl}/api/v1/agents/${agentId}/sessions`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('orderby', 'update_time')
  url.searchParams.set('desc', 'true')
  url.searchParams.set('user_id', userId)
  url.searchParams.set('dsl', 'false')

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.code !== 0) {
    return NextResponse.json(
      { error: data.message || '获取会话列表失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  return NextResponse.json({
    success: true,
    data: data.data || [],
    hasMore: (data.data?.length || 0) === pageSize
  })
}

/**
 * 获取会话历史（Agent）
 */
async function handleAgentGetHistory(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  userId: string,
  sessionId: string
) {
  const url = new URL(`${baseUrl}/api/v1/agents/${agentId}/sessions`)
  url.searchParams.set('id', sessionId)
  url.searchParams.set('user_id', userId)

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.code !== 0) {
    return NextResponse.json(
      { error: data.message || '获取会话历史失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  const session = data.data?.[0]
  return NextResponse.json({
    success: true,
    data: {
      sessionId: session?.id,
      messages: session?.messages || []
    }
  })
}

/**
 * 删除会话（Agent）
 */
async function handleAgentDeleteSessions(
  baseUrl: string,
  apiKey: string,
  agentId: string,
  ids: string[]
) {
  const url = `${baseUrl}/api/v1/agents/${agentId}/sessions`
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(30000)
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.code !== 0) {
    return NextResponse.json(
      { error: data.message || '删除会话失败' },
      { status: response.ok ? 400 : response.status }
    )
  }

  return NextResponse.json({ success: true })
}
