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

// RAGFlow连接测试函数
async function testRAGFlowConnection(config: any): Promise<{ success: boolean, message: string }> {
  try {
    const { baseUrl, apiKey, agentId } = config

    if (!baseUrl || !apiKey || !agentId) {
      return {
        success: false,
        message: '缺少必要的配置参数：服务地址、API Key 或 Agent ID'
      }
    }

    // 清理URL，确保格式正确
    const cleanBaseUrl = baseUrl.replace(/\/$/, '')

    console.log('测试 RAGFlow 连接:', {
      baseUrl: cleanBaseUrl,
      agentId,
      apiKeyLength: apiKey?.length || 0
    })

    // RAGFlow 有两种类型：Chat Assistant 和 Agent
    // 需要分别检查 /api/v1/chats 和 /api/v1/agents 端点
    const endpoints = [
      { url: `${cleanBaseUrl}/api/v1/agents`, type: 'Agent' },
      { url: `${cleanBaseUrl}/api/v1/chats`, type: 'Chat Assistant' }
    ]

    for (const endpoint of endpoints) {
      console.log(`检查 ${endpoint.type} 端点:`, endpoint.url)

      const response = await fetch(endpoint.url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000) // 30秒超时
      })

      console.log(`${endpoint.type} API 响应:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (response.ok) {
        const data = await response.json()

        // 检查响应格式
        if (data.code === 0 || data.success === true) {
          // 检查是否能找到指定的 ID
          if (data.data && Array.isArray(data.data)) {
            const found = data.data.find((item: any) => item.id === agentId)
            if (found) {
              const name = found.name || found.title || agentId
              return {
                success: true,
                message: `RAGFlow 连接成功，找到 ${endpoint.type} "${name}"`
              }
            }
          }
        }
      } else if (response.status === 401) {
        return {
          success: false,
          message: 'RAGFlow API Key 无效或已过期'
        }
      }
    }

    // 两个端点都没找到
    return {
      success: false,
      message: `RAGFlow 连接成功，但未找到 Agent ID "${agentId}"。请确认：1) ID 是否正确；2) Agent/Chat 是否已发布`
    }

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
