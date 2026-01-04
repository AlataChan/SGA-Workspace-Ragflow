import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

// 定义平台枚举
enum AgentPlatform {
  DIFY = 'DIFY',
  RAGFLOW = 'RAGFLOW',
  HIAGENT = 'HIAGENT',
  OPENAI = 'OPENAI',
  CLAUDE = 'CLAUDE',
  CUSTOM = 'CUSTOM'
}

// 验证schema
const testConfigSchema = z.object({
  platform: z.nativeEnum(AgentPlatform),
  config: z.record(z.any())
})

// 测试Dify连接
async function testDifyConnection(config: any): Promise<{ success: boolean, message: string }> {
  try {
    const { baseUrl, apiKey, timeout = 30000 } = config
    
    if (!baseUrl || !apiKey) {
      return { success: false, message: 'Base URL和API Key不能为空' }
    }

    // 验证URL格式
    try {
      new URL(baseUrl)
    } catch {
      return { success: false, message: 'Base URL格式不正确' }
    }

    // 测试连接
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/parameters`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      return { success: true, message: 'Dify连接测试成功' }
    } else if (response.status === 401) {
      return { success: false, message: 'API Key无效，请检查权限' }
    } else if (response.status === 404) {
      return { success: false, message: 'API端点不存在，请检查Base URL' }
    } else {
      return { success: false, message: `连接失败: ${response.status} ${response.statusText}` }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, message: '连接超时，请检查网络或增加超时时间' }
    }
    return { success: false, message: `连接错误: ${error.message}` }
  }
}

// 测试OpenAI连接
async function testOpenAIConnection(config: any): Promise<{ success: boolean, message: string }> {
  try {
    const { apiKey, model = 'gpt-3.5-turbo', baseUrl = 'https://api.openai.com/v1' } = config
    
    if (!apiKey) {
      return { success: false, message: 'API Key不能为空' }
    }

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      const hasModel = data.data?.some((m: any) => m.id === model)
      if (hasModel) {
        return { success: true, message: `OpenAI连接成功，模型 ${model} 可用` }
      } else {
        return { success: true, message: 'OpenAI连接成功，但指定模型可能不可用' }
      }
    } else if (response.status === 401) {
      return { success: false, message: 'API Key无效' }
    } else {
      return { success: false, message: `连接失败: ${response.status}` }
    }
  } catch (error: any) {
    return { success: false, message: `连接错误: ${error.message}` }
  }
}

// 测试Claude连接
async function testClaudeConnection(config: any): Promise<{ success: boolean, message: string }> {
  try {
    const { apiKey, model = 'claude-3-sonnet-20240229' } = config
    
    if (!apiKey) {
      return { success: false, message: 'API Key不能为空' }
    }

    // Claude API测试 - 发送一个简单的消息
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'test' }]
      })
    })

    if (response.ok) {
      return { success: true, message: `Claude连接成功，模型 ${model} 可用` }
    } else if (response.status === 401) {
      return { success: false, message: 'API Key无效' }
    } else if (response.status === 400) {
      const error = await response.json()
      if (error.error?.type === 'invalid_request_error') {
        return { success: true, message: 'Claude连接成功（API Key有效）' }
      }
      return { success: false, message: `请求错误: ${error.error?.message || '未知错误'}` }
    } else {
      return { success: false, message: `连接失败: ${response.status}` }
    }
  } catch (error: any) {
    return { success: false, message: `连接错误: ${error.message}` }
  }
}

// 测试自定义平台连接
async function testCustomConnection(config: any): Promise<{ success: boolean, message: string }> {
  try {
    const { baseUrl, apiKey, headers = {} } = config
    
    if (!baseUrl) {
      return { success: false, message: 'Base URL不能为空' }
    }

    // 验证URL格式
    try {
      new URL(baseUrl)
    } catch {
      return { success: false, message: 'Base URL格式不正确' }
    }

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers
    }

    if (apiKey) {
      requestHeaders['Authorization'] = `Bearer ${apiKey}`
    }

    const response = await fetch(baseUrl, {
      method: 'GET',
      headers: requestHeaders
    })

    if (response.ok) {
      return { success: true, message: '自定义平台连接成功' }
    } else {
      return { success: false, message: `连接失败: ${response.status} ${response.statusText}` }
    }
  } catch (error: any) {
    return { success: false, message: `连接错误: ${error.message}` }
  }
}

async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = testConfigSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '参数验证失败', details: validation.error.errors } },
        { status: 400 }
      )
    }

    const { platform, config } = validation.data

    let result: { success: boolean, message: string }

    switch (platform) {
      case AgentPlatform.DIFY:
        result = await testDifyConnection(config)
        break
      case AgentPlatform.OPENAI:
        result = await testOpenAIConnection(config)
        break
      case AgentPlatform.CLAUDE:
        result = await testClaudeConnection(config)
        break
      case AgentPlatform.CUSTOM:
        result = await testCustomConnection(config)
        break
      case AgentPlatform.RAGFLOW:
        result = await testRAGFlowConnection(config)
        break
      case AgentPlatform.HIAGENT:
        result = { success: false, message: `${platform} 平台连接测试暂未实现` }
        break
      default:
        result = { success: false, message: '不支持的平台类型' }
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      platform,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('测试连接配置失败:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: '测试连接失败' } },
      { status: 500 }
    )
  }
}

/**
 * 清理 RAGFlow baseUrl，移除错误添加的 API 路径
 * 例如: http://example.com:9301/api/v1/agents -> http://example.com:9301
 */
function cleanRAGFlowBaseUrl(url: string): string {
  if (!url) return url

  // 移除末尾斜杠
  let cleaned = url.replace(/\/+$/, '')

  // 移除常见的错误后缀
  const suffixesToRemove = [
    '/api/v1/agents',
    '/api/v1/chats',
    '/api/v1/datasets',
    '/api/v1',
    '/v1'
  ]

  for (const suffix of suffixesToRemove) {
    if (cleaned.toLowerCase().endsWith(suffix.toLowerCase())) {
      cleaned = cleaned.slice(0, -suffix.length)
      console.log(`[RAGFlow] URL 自动清理: 移除后缀 "${suffix}"`)
      break
    }
  }

  return cleaned
}

// RAGFlow连接测试函数
async function testRAGFlowConnection(config: any): Promise<{ success: boolean, message: string }> {
  try {
    const { baseUrl, apiKey, agentId, idType = 'CHAT' } = config

    if (!baseUrl || !apiKey || !agentId) {
      return {
        success: false,
        message: '缺少必要的配置参数：服务地址、API Key 或 Agent ID'
      }
    }

    // 清理URL，确保格式正确（自动移除错误的 API 路径后缀）
    const cleanBaseUrl = cleanRAGFlowBaseUrl(baseUrl)

    console.log('测试 RAGFlow 连接:', {
      baseUrl: cleanBaseUrl,
      agentId,
      idType,
      apiKeyLength: apiKey?.length || 0
    })

    const isAgentMode = String(idType).toUpperCase() === 'AGENT'

    // 辅助：在另一个列表中存在时给出更明确提示
    const lookupInOtherList = async () => {
      const otherUrl = isAgentMode ? `${cleanBaseUrl}/api/v1/chats` : `${cleanBaseUrl}/api/v1/agents`
      const resp = await fetch(otherUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000)
      })
      if (!resp.ok) return null
      const data = await resp.json().catch(() => ({}))
      const items = Array.isArray(data.data)
        ? data.data
        : (data.data?.chats || data.data?.agents || [])
      const found = Array.isArray(items) ? items.find((i: any) => i?.id === agentId) : null
      return found ? (found.name || found.title || agentId) : null
    }

    if (!isAgentMode) {
      // Chat Assistant 模式：必须能创建 session（否则后续聊天必报 You do not own the assistant / session mismatch）
      const listUrl = `${cleanBaseUrl}/api/v1/chats`
      const listResp = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000)
      })

      if (listResp.status === 401) {
        return { success: false, message: 'RAGFlow API Key 无效或已过期' }
      }
      if (!listResp.ok) {
        return { success: false, message: `获取 Chat Assistant 列表失败: ${listResp.status}` }
      }

      const listData = await listResp.json().catch(() => ({}))
      const chats = Array.isArray(listData.data) ? listData.data : (listData.data?.chats || [])
      const found = Array.isArray(chats) ? chats.find((c: any) => c?.id === agentId) : null
      if (!found) {
        const otherName = await lookupInOtherList()
        if (otherName) {
          return { success: false, message: `你选择的是 Chat Assistant，但该 ID 实际属于 Agent（${otherName}）。请切换为 Agent ID 类型。` }
        }
        return { success: false, message: `未找到 Chat Assistant ID "${agentId}"` }
      }

      const sessionUrl = `${cleanBaseUrl}/api/v1/chats/${agentId}/sessions`
      const sessionName = `connection_test_${Date.now()}`
      const createResp = await fetch(sessionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: sessionName }),
        signal: AbortSignal.timeout(30000)
      })

      const createData = await createResp.json().catch(() => ({} as any))
      const createMessage = String(createData?.message || createData?.error || '')

      if (!createResp.ok || createData?.code !== 0) {
        if (createMessage.toLowerCase().includes('you do not own the assistant')) {
          return {
            success: false,
            message: '该 API Key 无权使用此 Chat Assistant（You do not own the assistant）。请使用该助手所属账号的 API Key，或在当前账号下创建/复制该 Chat Assistant 后再填写 ID。'
          }
        }
        return {
          success: false,
          message: `找到 Chat Assistant，但无法创建会话（${createMessage || `HTTP ${createResp.status}` }）`
        }
      }

      // 清理测试会话
      const createdSessionId = createData?.data?.id
      if (createdSessionId) {
        await fetch(`${cleanBaseUrl}/api/v1/chats/${agentId}/sessions/${createdSessionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(30000)
        }).catch(() => {})
      }

      const name = found.name || found.title || agentId
      return { success: true, message: `RAGFlow 连接成功（Chat Assistant: ${name}）` }
    }

    // Agent 模式：建议直接测 /agents/{agent_id}/completions（stream=false）
    const listUrl = `${cleanBaseUrl}/api/v1/agents`
    const listResp = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000)
    })

    if (listResp.status === 401) {
      return { success: false, message: 'RAGFlow API Key 无效或已过期' }
    }
    if (!listResp.ok) {
      return { success: false, message: `获取 Agent 列表失败: ${listResp.status}` }
    }

    const listData = await listResp.json().catch(() => ({}))
    const agents = Array.isArray(listData.data) ? listData.data : (listData.data?.agents || [])
    const found = Array.isArray(agents) ? agents.find((a: any) => a?.id === agentId) : null
    if (!found) {
      const otherName = await lookupInOtherList()
      if (otherName) {
        return { success: false, message: `你选择的是 Agent，但该 ID 实际属于 Chat Assistant（${otherName}）。请切换为 Chat Assistant ID 类型。` }
      }
      return { success: false, message: `未找到 Agent ID "${agentId}"` }
    }

    const completionUrl = `${cleanBaseUrl}/api/v1/agents/${agentId}/completions`
    const completionResp = await fetch(completionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: 'connection_test',
        stream: false,
        user_id: 'connection_test'
      }),
      signal: AbortSignal.timeout(30000)
    })

    const completionData = await completionResp.json().catch(() => ({} as any))
    const completionMessage = String(completionData?.message || completionData?.error || '')

    if (!completionResp.ok || completionData?.code !== 0) {
      if (completionMessage.toLowerCase().includes("don't own the agent") || completionMessage.toLowerCase().includes('do not own the agent')) {
        return {
          success: false,
          message:
            "该 API Key 无权使用此 Agent（You don't own the agent）。请使用该 Agent 所属账号的 API Key，或在当前账号下创建/复制该 Agent 后再填写 ID。"
        }
      }
      return { success: false, message: `Agent 对话测试失败（${completionMessage || `HTTP ${completionResp.status}` }）` }
    }

    // 尽量清理测试会话
    const createdSessionId = completionData?.data?.session_id
    if (createdSessionId) {
      await fetch(`${cleanBaseUrl}/api/v1/agents/${agentId}/sessions`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: [createdSessionId] }),
        signal: AbortSignal.timeout(30000)
      }).catch(() => {})
    }

    const name = found.name || found.title || agentId
    return { success: true, message: `RAGFlow 连接成功（Agent: ${name}）` }

  } catch (error) {
    console.error('RAGFlow 连接测试异常:', error)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: 'RAGFlow 连接超时（30秒）'
        }
      }

      if (error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          message: 'RAGFlow 服务不可达，请检查服务地址和端口'
        }
      }

      if (error.message.includes('ENOTFOUND')) {
        return {
          success: false,
          message: 'RAGFlow 域名解析失败，请检查服务地址格式'
        }
      }

      return {
        success: false,
        message: `RAGFlow 连接测试失败: ${error.message}`
      }
    }

    return {
      success: false,
      message: 'RAGFlow 连接测试失败: 未知错误'
    }
  }
}

export { POST }
export const dynamic = 'force-dynamic'
