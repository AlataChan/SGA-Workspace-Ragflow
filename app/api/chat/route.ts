import { type NextRequest, NextResponse } from "next/server"
// Supabase已移除，使用简化认证
import { db } from "@/lib/database/simple-db"
import { sendToDify, sendToCustomAPI, sendToDifyStream } from "@/lib/api/dify"
import { ErrorHandler, AuthorizationError, ValidationError, NotFoundError } from "@/lib/utils/error-handler"
import { validateAndSanitize, chatSchemas } from "@/lib/security/validation"
import { checkRateLimit, chatRateLimiter } from "@/lib/security/rate-limiter"
import { extractRequestMeta, logger } from "@/lib/utils/logger"

export async function POST(request: NextRequest) {
  const meta = extractRequestMeta(request)

  return ErrorHandler.handleAsync(async () => {
    // 速率限制检查
    await checkRateLimit(request)

    // 解析和验证请求体
    const body = await request.json()
    const { message, agentId, sessionId, files } = validateAndSanitize(chatSchemas.sendMessage, body)

    // 简化认证 - 临时实现
    const user = { id: 'temp-user-id', email: 'temp@example.com' }
    // TODO: 实现真正的JWT认证

    // 聊天速率限制
    const chatIdentifier = `chat:${user.id}`
    const chatRateResult = await chatRateLimiter.check(chatIdentifier)
    if (!chatRateResult.allowed) {
      throw new ValidationError("聊天消息发送过于频繁，请稍后重试")
    }

    // 获取智能体信息
    const { data: agent, error: agentError } = await adminDb.safeQuery(
      () => adminDb.client.from("ai_agents")
        .select("*")
        .eq("id", agentId)
        .single()
    )

    if (agentError || !agent) {
      throw new NotFoundError("智能体不存在")
    }

    // 验证智能体是否启用
    if (!agent.is_active) {
      throw new AuthorizationError("智能体已禁用")
    }

    // 验证用户是否有权限访问该智能体
    const { data: access, error: accessError } = await adminDb.safeQuery(
      () => adminDb.client.from("user_agent_access")
        .select("*")
        .eq("user_id", user.id)
        .eq("agent_id", agentId)
        .single()
    )

    if (accessError || !access) {
      throw new AuthorizationError("无权限访问该智能体")
    }

    // 验证会话是否属于当前用户
    const { data: session, error: sessionError } = await adminDb.safeQuery(
      () => adminDb.client.from("chat_sessions")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .single()
    )

    if (sessionError || !session) {
      throw new AuthorizationError("会话不存在或无权限访问")
    }

    // 记录聊天速率限制
    await chatRateLimiter.record(chatIdentifier)

    // 获取用户档案信息（用于传递给Dify）
    const { data: profile } = await adminDb.safeQuery(
      () => adminDb.client.from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .single()
    )

    // 构建用户标识符（用于Dify的多端记忆）
    const userIdentifier = profile?.username || user.id

    // 根据平台调用相应的API
    let response
    try {
      if (agent.platform === "dify") {
        // 获取会话的conversation_id（如果有的话）
        const conversationId = session.conversation_id

        response = await sendToDify(
          agent.api_url,
          agent.api_key,
          message,
          conversationId,
          userIdentifier
        )
      } else if (agent.platform === "ragflow") {
        // RAGFlow 专用处理逻辑
        const conversationId = session.conversation_id

        // 动态导入以避免循环依赖或按需加载
        const { RAGFlowClient } = await import("@/lib/ragflow-client")

        // 尝试从配置获取 RAGFlow Agent ID，如果没设置则使用本地 Agent ID
        // 注意：这里是一个假设，如果 RAGFlow 需要的 ID 与本地 ID 不一致，必须在 modelConfig 中配置
        const ragflowAgentId = agent.model_config?.agent_id || agent.id

        const client = new RAGFlowClient({
          baseUrl: agent.api_url,
          apiKey: agent.api_key,
          agentId: ragflowAgentId,
          userId: userIdentifier
        })

        // 使用 Promise 包装回调式的 sendMessage
        response = await new Promise<any>((resolve, reject) => {
          let answer = ''
          let ref = null
          let finalConvId = conversationId
          let finalMsgId = ''

          client.setConversationId(conversationId)

          client.sendMessage(
            message,
            (msg) => {
              if (msg.type === 'content') {
                answer = msg.content || ''
                if (msg.reference) ref = msg.reference
                if (msg.conversationId) finalConvId = msg.conversationId
                if (msg.messageId) finalMsgId = msg.messageId
              } else if (msg.type === 'complete') {
                // 完成时返回
                resolve({
                  answer: msg.content || answer,
                  conversation_id: msg.conversationId || finalConvId,
                  message_id: finalMsgId, // RAGFlow 可能不返回 msgId，暂空
                  reference: msg.reference || ref // 传递引用信息
                })
              } else if (msg.type === 'error') {
                reject(new Error(msg.content))
              }
            },
            (err) => reject(err),
            () => {
              // completion callback (redundant with 'complete' message type usually)
            },
            true // quote = true
          ).catch(reject)
        })

        // 将引用信息附加到 metadata 或 answer 中？
        // 为了前端展示，我们可以选择将引用作为 extra data 返回
        // 下面的 return NextResponse.json 会包含 response 对象的所有属性吗？
        // 查看 174 行： response: response.answer
        // 我需要修改返回值结构来包含 reference
      } else {
        response = await sendToCustomAPI(
          agent.api_url,
          agent.api_key,
          message,
          {
            ...agent.model_config || {},
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

    // 更新会话的conversation_id（如果有）
    if (response.conversation_id && response.conversation_id !== session.conversation_id) {
      await adminDb.safeUpdate("chat_sessions", {
        conversation_id: response.conversation_id,
        updated_at: new Date().toISOString()
      }, { id: sessionId })
    } else {
      // 只更新最后更新时间
      await adminDb.safeUpdate("chat_sessions", {
        updated_at: new Date().toISOString()
      }, { id: sessionId })
    }

    // 保存AI回复到数据库
    const { error: saveError } = await adminDb.safeInsert("chat_messages", {
      session_id: sessionId,
      role: "assistant",
      content: response.answer,
      metadata: {
        agent_id: agentId,
        conversation_id: response.conversation_id,
        message_id: response.message_id,
        platform: agent.platform
      }
    })

    if (saveError) {
      logger.warn("保存AI回复失败", { error: saveError, sessionId }, meta)
    }

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
      // @ts-ignore
      reference: response.reference, // 传递引用信息
      metadata: {
        agentName: agent.name,
        platform: agent.platform
      }
    })
  }, meta.requestId, user?.id, meta.ip)
}
