import { type NextRequest, NextResponse } from "next/server"
// Supabase已移除，使用简化认证
import { db } from "@/lib/database/simple-db"
import { sendToDify, sendToCustomAPI, sendToDifyStream } from "@/lib/api/dify"
import { ErrorHandler, AuthorizationError, ValidationError, NotFoundError } from "@/lib/utils/error-handler"
import { validateAndSanitize, chatSchemas } from "@/lib/security/validation"
import { checkRateLimit, chatRateLimiter } from "@/lib/security/rate-limiter"
import { extractRequestMeta, logger } from "@/lib/utils/logger"
import { verifyToken, extractTokenFromHeader } from "@/lib/auth/jwt"

export async function POST(request: NextRequest) {
  const meta = extractRequestMeta(request)
  let userId: string | undefined

  return ErrorHandler.handleAsync(async () => {
    // 速率限制检查
    await checkRateLimit(request)

    // 解析和验证请求体
    const body = await request.json()
    const { message, agentId, sessionId, files } = validateAndSanitize(chatSchemas.sendMessage, body)

    // JWT 认证 - 从 Cookie 或 Authorization 头获取 token
    const cookieToken = request.cookies.get('auth-token')?.value
    const headerToken = extractTokenFromHeader(request.headers.get('authorization'))
    const token = cookieToken || headerToken

    if (!token) {
      throw new AuthorizationError("未提供认证令牌，请先登录")
    }

    // 验证 JWT token
    const payload = verifyToken(token)
    if (!payload) {
      throw new AuthorizationError("无效的认证令牌，请重新登录")
    }

    // 从 JWT payload 中获取用户信息
    const user = {
      id: payload.userId,
      email: `${payload.userId}@company.com`,
      companyId: payload.companyId,
      role: payload.role
    }
    userId = user.id

    logger.info("用户认证成功", { userId: user.id, companyId: user.companyId, agentId })

    // 聊天速率限制
    const chatIdentifier = `chat:${user.id}`
    const chatRateResult = await chatRateLimiter.check(chatIdentifier)
    if (!chatRateResult.allowed) {
      throw new ValidationError("聊天消息发送过于频繁，请稍后重试")
    }

    // 获取智能体信息
    const agent = await db.findAgentById(agentId)

    if (!agent) {
      throw new NotFoundError("智能体不存在")
    }

    // 验证智能体是否启用
    if (!agent.isActive) {
      throw new AuthorizationError("智能体已禁用")
    }

    // 验证用户是否有权限访问该智能体
    const hasAccess = await db.checkUserAgentAccess(user.id, agentId)

    if (!hasAccess) {
      throw new AuthorizationError("无权限访问该智能体")
    }

    // 验证会话是否属于当前用户
    const session = await db.findSessionById(sessionId)

    if (!session || session.userId !== user.id) {
      throw new AuthorizationError("会话不存在或无权限访问")
    }

    // 记录聊天速率限制
    await chatRateLimiter.record(chatIdentifier)

    // 获取用户档案信息（用于传递给Dify）
    const userProfile = await db.findUserById(user.id)

    // 构建用户标识符（用于Dify的多端记忆）
    const userIdentifier = userProfile?.username || user.id

    // 根据平台调用相应的API
    let response
    try {
      if (agent.platform === "dify") {
        // 获取会话的conversation_id（如果有的话）
        const conversationId = session.conversationId || undefined

        response = await sendToDify(
          agent.apiUrl,
          agent.apiKey,
          message,
          conversationId,
          userIdentifier
        )
      } else if (agent.platform === "ragflow") {
        // RAGFlow 专用处理逻辑
        const conversationId = session.conversationId || undefined

        // 动态导入以避免循环依赖或按需加载
        const { RAGFlowClient } = await import("@/lib/ragflow-client")

        // 尝试从配置获取 RAGFlow Agent ID，如果没设置则使用本地 Agent ID
        const ragflowAgentId = (agent.modelConfig as any)?.agent_id || agent.id

        const client = new RAGFlowClient({
          baseUrl: agent.apiUrl,
          apiKey: agent.apiKey,
          agentId: ragflowAgentId,
          userId: userIdentifier
        })

        // 使用 Promise 包装回调式的 sendMessage
        response = await new Promise<any>((resolve, reject) => {
          let answer = ''
          let ref: any = null
          let finalConvId: string | undefined = conversationId
          let finalMsgId = ''

          if (conversationId) {
            client.setConversationId(conversationId)
          }

          client.sendMessage(
            message,
            (msg) => {
              if (msg.type === 'content') {
                answer = msg.content || ''
                if (msg.reference) ref = msg.reference
                if (msg.conversationId) finalConvId = msg.conversationId
                if (msg.messageId) finalMsgId = msg.messageId
              } else if (msg.type === 'complete') {
                resolve({
                  answer: msg.content || answer,
                  conversation_id: msg.conversationId || finalConvId,
                  message_id: finalMsgId,
                  reference: msg.reference || ref
                })
              } else if (msg.type === 'error') {
                reject(new Error(msg.content))
              }
            },
            (err) => reject(err),
            () => {}
          ).catch(reject)
        })

      } else {
        response = await sendToCustomAPI(
          agent.apiUrl,
          agent.apiKey,
          message,
          {
            ...agent.modelConfig || {},
            userId: userIdentifier,
            sessionId: sessionId
          }
        )
      }

      logger.info("AI API调用成功", {
        agentId,
        platform: agent.platform,
        messageLength: message.length,
        responseLength: response.answer?.length || 0,
        userId: user.id,
        sessionId
      }, meta)

    } catch (error) {
      logger.error("AI API调用失败", error as Error, {
        agentId,
        platform: agent.platform,
        userId: user.id,
        sessionId
      }, meta)
      throw new Error("AI服务暂时不可用，请稍后重试")
    }

    // 保存AI回复到数据库
    await db.createMessage({
      sessionId: sessionId,
      userId: user.id,
      role: "assistant" as const,
      content: response.answer,
      metadata: {
        agentId: agentId,
        conversationId: response.conversation_id,
        messageId: response.message_id,
        platform: agent.platform
      }
    })

    logger.info("聊天消息处理完成", {
      userId: user.id,
      agentId,
      sessionId,
      messageLength: message.length,
      responseLength: response.answer?.length || 0
    }, meta)

    return NextResponse.json({
      response: response.answer,
      conversationId: response.conversation_id,
      messageId: response.message_id,
      reference: response.reference,
      metadata: {
        agentName: agent.name,
        platform: agent.platform
      }
    })
  }, meta.requestId, userId, meta.ip)
}
