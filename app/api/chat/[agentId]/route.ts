import { NextRequest, NextResponse } from 'next/server'
import { gateLegacyMoltRoute } from '@/lib/molt/legacy-gate'
import { logger } from '@/lib/utils/simple-logger'

const DEFAULT_DIFY_BASE_URL = (process.env.DEFAULT_DIFY_BASE_URL || "").replace(/\/+$/, "")
const DEFAULT_DIFY_API_KEY = (process.env.DEFAULT_DIFY_API_KEY || "").trim()

function createDemoDifyConfig(name: string) {
  const apiUrl = DEFAULT_DIFY_BASE_URL ? `${DEFAULT_DIFY_BASE_URL}/chat-messages` : ""

  return {
    name,
    platform: 'dify',
    apiUrl,
    apiKey: DEFAULT_DIFY_API_KEY,
    appId: DEFAULT_DIFY_API_KEY,
    appType: 'agent'
  }
}

function getAgentConfigs() {
  return {
    'demo-agent-1': {
      name: 'GPT助手',
      platform: 'openai',
      apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-3.5-turbo'
    },
    'demo-agent-2': createDemoDifyConfig('Dify智能体'),
    'demo-agent-3': {
      name: '代码助手',
      platform: 'openai',
      apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4'
    },
    'demo-agent-4': createDemoDifyConfig('文档助手')
  }
}

// 创建流式响应
function createStreamResponse(difyResponse: Response) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = difyResponse.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // 解析Dify的SSE数据
          const chunk = new TextDecoder().decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                controller.close()
                return
              }

              try {
                const parsed = JSON.parse(data)
                // 转发给前端
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`))
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      } catch (error) {
        logger.error('流式响应错误', { error: error instanceof Error ? error.message : String(error) })
        controller.error(error)
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

// 创建模拟流式响应
function createMockStreamResponse(agentName: string, message: string, userId: string, conversationId?: string) {
  const encoder = new TextEncoder()

  const mockResponse = `您好！我是${agentName}，很高兴为您服务。

您刚才说："${message}"

让我为您详细介绍一下我的功能和特色：

🤖 **智能对话能力**
我具备强大的自然语言理解和生成能力，可以进行流畅的多轮对话，理解上下文，并提供准确、有用的回复。

📊 **专业知识支持**
我拥有广泛的知识库，涵盖科技、商业、教育、生活等多个领域，可以为您提供专业的建议和解答。

⚡ **实时流式输出**
正如您现在看到的，我支持实时流式输出，让对话更加自然流畅，就像真人打字一样。

🔧 **企业级应用**
我专为企业环境设计，支持定制化配置，可以集成到各种业务系统中。

用户ID: ${userId}
会话ID: ${conversationId || 'demo-conversation'}

感谢您的使用！有什么其他问题吗？`

  const stream = new ReadableStream({
    async start(controller) {
      const messageId = `mock-msg-${Date.now()}`

      // 按词组发送，更好的流式效果 - 使用OpenAI格式
      const words = mockResponse.split(' ')

      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? ' ' : '')

        // 使用OpenAI格式的流式响应
        const openaiFormat = {
          id: messageId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'mock-model',
          choices: [{
            index: 0,
            delta: {
              content: word
            },
            finish_reason: null
          }]
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`))

        // 按词组延迟，更自然的打字效果
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 发送结束事件
      const endFormat = {
        id: messageId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'mock-model',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(endFormat)}\n\n`))

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    const body = await request.json()

    const { verifyUserAuth } = await import("@/lib/auth/user")
    const workspaceUser = await verifyUserAuth(request).catch(() => null)
    if (workspaceUser) {
      const moltGate = gateLegacyMoltRoute("chat", {
        companyId: workspaceUser.companyId,
        agentId,
      })
      if (moltGate) {
        return moltGate
      }
    }

    // 支持两种请求格式：
    // 1. 旧格式：{ message, userId, conversationId }
    // 2. 新格式：{ messages, config, userId }
    let message: string
    let userId: string
    let conversationId: string | undefined

    if (body.messages && Array.isArray(body.messages)) {
      // NextChat风格的请求格式
      const lastMessage = body.messages[body.messages.length - 1]
      message = lastMessage?.content || ''
      userId = body.userId || 'demo-user'
      conversationId = body.conversationId
    } else {
      // 旧的请求格式
      message = body.message || ''
      userId = body.userId || 'demo-user'
      conversationId = body.conversationId
    }

    logger.info('聊天请求', {
      agentId,
      userId,
      userIdType: typeof userId,
      messageLength: message?.length,
      conversationId,
      requestFormat: body.messages ? 'nextchat' : 'legacy'
    })

    // 获取智能体配置
    const agentConfigs = getAgentConfigs()
    const agentConfig = agentConfigs[agentId as keyof typeof agentConfigs]
    if (!agentConfig) {
      return NextResponse.json(
        { error: '智能体不存在' },
        { status: 404 }
      )
    }

    // 为了演示，直接返回模拟流式响应
    logger.info('返回模拟流式响应', { agentName: agentConfig.name })
    return createMockStreamResponse(agentConfig.name, message, userId, conversationId)

  } catch (error) {
    logger.error('聊天API错误', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// Dify API调用
async function callDifyAPI(config: any, message: string, userId: string, conversationId?: string) {
  try {
    // 如果没有配置API密钥，返回模拟流式响应
    if (!config.apiKey) {
      logger.info('使用模拟Dify流式响应')
      const mockAnswer = `这是来自${config.name}的模拟响应：\n\n您说："${message}"\n\n我是基于Dify平台的智能助手，目前处于演示模式。要启用真实的AI对话，请在环境变量中配置 DEFAULT_DIFY_API_KEY 和 DEFAULT_DIFY_BASE_URL。\n\n用户ID: ${userId}`
      return createMockStreamResponse(config.name, mockAnswer, userId, conversationId)
    }

    // 对于Agent Chat，使用streaming模式
    const requestBody = {
      inputs: {},
      query: message,
      response_mode: 'streaming',
      conversation_id: conversationId,
      user: userId
    }

    logger.info('发送Dify请求', {
      url: config.apiUrl,
      body: requestBody,
      hasApiKey: !!config.apiKey
    })

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Dify API错误', {
        statusCode: response.status,
        errorText: errorText
      })

      // 如果是Agent Chat不支持streaming的错误，尝试blocking模式
      if (errorText.includes('does not support streaming mode')) {
        logger.info('Agent Chat不支持streaming，尝试blocking模式')
        return callDifyBlocking(config, message, userId, conversationId)
      }

      throw new Error(`Dify API错误: ${response.status} - ${errorText}`)
    }

    // 返回Dify流式响应
    return createDifyStreamResponse(response)

  } catch (error) {
    logger.error('Dify API调用失败', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      config: {
        url: config.apiUrl,
        hasApiKey: !!config.apiKey
      }
    })
    throw error
  }
}

// OpenAI API调用
async function callOpenAIAPI(config: any, message: string, userId: string) {
  try {
    // 如果没有配置API密钥，返回模拟流式响应
    if (!config.apiKey) {
      logger.info('使用模拟OpenAI流式响应')
      const mockAnswer = `这是来自${config.name}的模拟响应：\n\n您说："${message}"\n\n我是基于OpenAI的智能助手，目前处于演示模式。要启用真实的AI对话，请在环境变量中配置OPENAI_API_KEY。\n\n用户ID: ${userId}`
      return createMockStreamResponse(config.name, mockAnswer, userId)
    }

    const requestBody = {
      model: config.model,
      messages: [
        {
          role: 'system',
          content: `你是${config.name}，一个专业的AI助手。用户ID是${userId}。`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      throw new Error(`OpenAI API错误: ${response.status}`)
    }

    const data = await response.json()
    logger.info('OpenAI API响应成功')

    // 转换为统一格式
    return NextResponse.json({
      answer: data.choices[0].message.content,
      conversation_id: `openai-conv-${Date.now()}`,
      message_id: `openai-msg-${Date.now()}`
    })

  } catch (error) {
    logger.error('OpenAI API调用失败', { error: error instanceof Error ? error.message : String(error) })
    throw error
  }
}

// 获取智能体信息
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    const agentConfigs = getAgentConfigs()
    const agentConfig = agentConfigs[agentId as keyof typeof agentConfigs]
    
    if (!agentConfig) {
      return NextResponse.json(
        { error: '智能体不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: agentId,
      name: agentConfig.name,
      platform: agentConfig.platform,
      status: agentConfig.apiKey && agentConfig.apiUrl ? 'active' : 'demo'
    })

  } catch (error) {
    logger.error('获取智能体信息失败', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// Dify blocking模式调用（用于Agent Chat）
async function callDifyBlocking(config: any, message: string, userId: string, conversationId?: string) {
  try {
    const requestBody = {
      inputs: {},
      query: message,
      response_mode: 'blocking',
      conversation_id: conversationId,
      user: userId
    }

    logger.info('发送Dify blocking请求', {
      url: config.apiUrl,
      body: requestBody,
      hasApiKey: !!config.apiKey
    })

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    const responseText = await response.text()
    logger.info('Dify blocking响应', {
      status: response.status,
      response: responseText.substring(0, 500)
    })

    if (!response.ok) {
      throw new Error(`Dify API错误: ${response.status} - ${responseText}`)
    }

    const data = JSON.parse(responseText)
    logger.info('Dify blocking API响应成功', {
      messageId: data.message_id,
      conversationId: data.conversation_id
    })

    // 返回标准格式的响应
    return NextResponse.json({
      answer: data.answer,
      conversation_id: data.conversation_id,
      message_id: data.message_id,
      metadata: data.metadata || {},
      created_at: data.created_at
    })

  } catch (error) {
    logger.error('Dify blocking API调用失败', {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

// 创建Dify流式响应 - 真正的流式输出
function createDifyStreamResponse(response: Response) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader()
      if (!reader) {
        controller.close()
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            // 发送结束标记
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            break
          }

          // 解码数据
          const chunk = decoder.decode(value, { stream: true })
          buffer += chunk

          // 按行分割处理
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一行（可能不完整）

          for (const line of lines) {
            if (line.trim() === '') continue

            try {
              // 处理Dify的SSE格式
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim()
                if (jsonStr) {
                  const data = JSON.parse(jsonStr)

                  // 转换为OpenAI格式的流式响应
                  if (data.event === 'message' && data.answer) {
                    const openaiFormat = {
                      id: data.message_id || 'dify-msg',
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'dify-agent',
                      choices: [{
                        index: 0,
                        delta: {
                          content: data.answer
                        },
                        finish_reason: null
                      }]
                    }

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`))
                  }

                  // 处理消息替换事件
                  if (data.event === 'message_replace' && data.answer) {
                    const openaiFormat = {
                      id: data.message_id || 'dify-msg',
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'dify-agent',
                      choices: [{
                        index: 0,
                        delta: {
                          content: data.answer
                        },
                        finish_reason: null
                      }]
                    }

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`))
                  }

                  // 处理结束事件
                  if (data.event === 'message_end') {
                    const openaiFormat = {
                      id: data.message_id || 'dify-msg',
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'dify-agent',
                      choices: [{
                        index: 0,
                        delta: {},
                        finish_reason: 'stop'
                      }]
                    }

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`))
                  }
                }
              }
            } catch (e) {
              console.warn('解析Dify SSE数据失败:', e)
            }
          }
        }
      } catch (error) {
        console.error('Dify流式响应处理错误:', error)
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
