/**
 * Agent连接测试 API
 * POST /api/admin/agents/[id]/test - 测试Agent连接
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'

// 定义平台枚举
enum AgentPlatform {
  DIFY = 'DIFY',
  RAGFLOW = 'RAGFLOW',
  HIAGENT = 'HIAGENT',
  OPENAI = 'OPENAI',
  CLAUDE = 'CLAUDE',
  CUSTOM = 'CUSTOM'
}

// 平台测试器接口
interface PlatformTester {
  test(config: any): Promise<{ success: boolean; message: string; details?: any }>
}

// Dify平台测试器
class DifyTester implements PlatformTester {
  async test(config: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { baseUrl, apiKey, timeout = 30000 } = config
      
      // 构建测试URL
      const testUrl = `${baseUrl.replace(/\/$/, '')}/chat-messages`
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {},
          query: "Hello, this is a connection test.",
          response_mode: "blocking",
          user: "test-user"
        }),
        signal: AbortSignal.timeout(timeout)
      })

      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          message: 'Dify连接测试成功',
          details: {
            status: response.status,
            responseTime: Date.now(),
            hasAnswer: !!data.answer
          }
        }
      } else {
        const errorText = await response.text()
        return {
          success: false,
          message: `Dify连接失败: ${response.status} ${response.statusText}`,
          details: { status: response.status, error: errorText }
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Dify连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : error }
      }
    }
  }
}

function cleanRAGFlowBaseUrl(url: string): string {
  if (!url) return url

  let cleaned = url.trim().replace(/\/+$/, '')
  const suffixesToRemove = ['/api/v1/agents', '/api/v1/chats', '/api/v1/datasets', '/api/v1', '/v1']

  for (const suffix of suffixesToRemove) {
    if (cleaned.toLowerCase().endsWith(suffix.toLowerCase())) {
      cleaned = cleaned.slice(0, -suffix.length)
      break
    }
  }

  return cleaned.replace(/\/+$/, '')
}

// RAGFlow平台测试器
class RAGFlowTester implements PlatformTester {
  async test(config: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { baseUrl, apiKey, agentId, idType = 'CHAT' } = config

      const cleanBaseUrl = cleanRAGFlowBaseUrl(String(baseUrl || ''))
      const remoteId = String(agentId || '').trim()
      const normalizedIdType = String(idType).toUpperCase()

      if (!cleanBaseUrl || !apiKey || !remoteId) {
        return { success: false, message: '请填写 RAGFlow 的 baseUrl / apiKey / ID' }
      }

      const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      }

      if (normalizedIdType === 'AGENT') {
        const listResp = await fetch(`${cleanBaseUrl}/api/v1/agents`, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(30000),
        })
        const listData = await listResp.json().catch(() => ({} as any))
        const agents = (listData?.data || []) as any[]
        const found = agents.find((a) => String(a?.id) === remoteId)
        if (!found) return { success: false, message: `未找到 Agent ID "${remoteId}"` }

        const completionResp = await fetch(`${cleanBaseUrl}/api/v1/agents/${remoteId}/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ question: 'connection_test', stream: false, user_id: 'connection_test' }),
          signal: AbortSignal.timeout(30000),
        })
        const completionData = await completionResp.json().catch(() => ({} as any))
        const completionMessage = String(completionData?.message || completionData?.error || '')

        if (!completionResp.ok || completionData?.code !== 0) {
          const lower = completionMessage.toLowerCase()
          if (lower.includes("don't own the agent") || lower.includes('do not own the agent')) {
            return {
              success: false,
              message:
                "该 API Key 无权使用此 Agent（You don't own the agent）。请使用该 Agent 所属账号的 API Key，或在当前账号下创建/复制该 Agent 后再填写 ID。",
            }
          }
          return { success: false, message: `RAGFlow 连接失败（${completionMessage || `HTTP ${completionResp.status}` }）` }
        }

        const createdSessionId = completionData?.data?.session_id
        if (createdSessionId) {
          await fetch(`${cleanBaseUrl}/api/v1/agents/${remoteId}/sessions`, {
            method: 'DELETE',
            headers,
            body: JSON.stringify({ ids: [createdSessionId] }),
            signal: AbortSignal.timeout(30000),
          }).catch(() => {})
        }

        const name = found.name || found.title || remoteId
        return { success: true, message: `RAGFlow 连接成功（Agent: ${name}）` }
      }

      const listResp = await fetch(`${cleanBaseUrl}/api/v1/chats`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      })
      const listData = await listResp.json().catch(() => ({} as any))
      const chats = (listData?.data || []) as any[]
      const found = chats.find((c) => String(c?.id) === remoteId)
      if (!found) return { success: false, message: `未找到 Chat Assistant ID "${remoteId}"` }

      const sessionResp = await fetch(`${cleanBaseUrl}/api/v1/chats/${remoteId}/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'connection_test' }),
        signal: AbortSignal.timeout(30000),
      })
      const sessionData = await sessionResp.json().catch(() => ({} as any))
      const sessionMessage = String(sessionData?.message || sessionData?.error || '')
      if (!sessionResp.ok || sessionData?.code !== 0) {
        const lower = sessionMessage.toLowerCase()
        if (lower.includes("don't own the assistant") || lower.includes('do not own the assistant')) {
          return {
            success: false,
            message:
              "该 API Key 无权使用此 Chat Assistant（You do not own the assistant）。请使用该 Chat Assistant 所属账号的 API Key，或在当前账号下创建/复制该 Chat Assistant 后再填写 ID。",
          }
        }
        return { success: false, message: `RAGFlow 连接失败（${sessionMessage || `HTTP ${sessionResp.status}` }）` }
      }

      const createdSessionId = sessionData?.data?.id || sessionData?.data?.session_id
      if (createdSessionId) {
        await fetch(`${cleanBaseUrl}/api/v1/chats/${remoteId}/sessions`, {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ ids: [createdSessionId] }),
          signal: AbortSignal.timeout(30000),
        }).catch(() => {})
      }

      const name = found.name || found.title || remoteId
      return { success: true, message: `RAGFlow 连接成功（Chat Assistant: ${name}）` }
    } catch (error) {
      return {
        success: false,
        message: `RAGFlow连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : error }
      }
    }
  }
}

// HiAgent平台测试器
class HiAgentTester implements PlatformTester {
  async test(config: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { baseUrl, apiKey } = config
      
      // HiAgent API测试（根据实际API调整）
      const testUrl = `${baseUrl.replace(/\/$/, '')}/api/chat`
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "Hello, this is a connection test."
        }),
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        return {
          success: true,
          message: 'HiAgent连接测试成功',
          details: { status: response.status }
        }
      } else {
        return {
          success: false,
          message: `HiAgent连接失败: ${response.status} ${response.statusText}`,
          details: { status: response.status }
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `HiAgent连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : error }
      }
    }
  }
}

// OpenAI平台测试器
class OpenAITester implements PlatformTester {
  async test(config: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { apiKey, model = 'gpt-3.5-turbo', baseUrl = 'https://api.openai.com' } = config
      
      const testUrl = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hello, this is a connection test.' }],
          max_tokens: 10
        }),
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        return {
          success: true,
          message: 'OpenAI连接测试成功',
          details: { status: response.status, model }
        }
      } else {
        return {
          success: false,
          message: `OpenAI连接失败: ${response.status} ${response.statusText}`,
          details: { status: response.status }
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `OpenAI连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : error }
      }
    }
  }
}

// Claude平台测试器
class ClaudeTester implements PlatformTester {
  async test(config: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { apiKey, model = 'claude-3-sonnet-20240229' } = config
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hello, this is a connection test.' }]
        }),
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        return {
          success: true,
          message: 'Claude连接测试成功',
          details: { status: response.status, model }
        }
      } else {
        return {
          success: false,
          message: `Claude连接失败: ${response.status} ${response.statusText}`,
          details: { status: response.status }
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Claude连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : error }
      }
    }
  }
}

// 自定义平台测试器
class CustomTester implements PlatformTester {
  async test(config: any): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const { baseUrl, apiKey, headers = {} } = config
      
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          message: "Hello, this is a connection test."
        }),
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        return {
          success: true,
          message: '自定义平台连接测试成功',
          details: { status: response.status }
        }
      } else {
        return {
          success: false,
          message: `自定义平台连接失败: ${response.status} ${response.statusText}`,
          details: { status: response.status }
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `自定义平台连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        details: { error: error instanceof Error ? error.message : error }
      }
    }
  }
}

// 平台测试器映射
const platformTesters: Record<AgentPlatform, PlatformTester> = {
  DIFY: new DifyTester(),
  RAGFLOW: new RAGFlowTester(),
  HIAGENT: new HiAgentTester(),
  OPENAI: new OpenAITester(),
  CLAUDE: new ClaudeTester(),
  CUSTOM: new CustomTester(),
}

// POST /api/admin/agents/[id]/test - 测试Agent连接
export const POST = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id

    // 获取Agent信息
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        companyId: user.companyId,
      }
    })

    if (!agent) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_NOT_FOUND',
            message: 'Agent不存在'
          }
        },
        { status: 404 }
      )
    }

    // 检查平台配置
    if (!agent.platformConfig) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_PLATFORM_CONFIG',
            message: '未配置平台信息'
          }
        },
        { status: 400 }
      )
    }

    // 获取对应的测试器
    const tester = platformTesters[agent.platform]
    if (!tester) {
      return NextResponse.json(
        {
          error: {
            code: 'UNSUPPORTED_PLATFORM',
            message: `不支持的平台: ${agent.platform}`
          }
        },
        { status: 400 }
      )
    }

    // 执行连接测试
    const testResult = await tester.test(agent.platformConfig)

    // 更新Agent状态
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        isOnline: testResult.success,
        connectionTestedAt: new Date(),
        lastError: testResult.success ? null : testResult.message,
      }
    })

    return NextResponse.json({
      data: {
        agentId,
        platform: agent.platform,
        testResult,
        testedAt: new Date().toISOString()
      },
      message: testResult.success ? '连接测试成功' : '连接测试失败'
    })

  } catch (error) {
    console.error('Agent连接测试失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Agent连接测试失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})
