export interface DifyMessage {
  role: "user" | "assistant"
  content: string
}

export interface DifyResponse {
  answer: string
  conversation_id?: string
  message_id?: string
}

export async function sendToDifyStream(
  apiUrl: string,
  apiKey: string,
  message: string,
  conversationId?: string,
  onChunk?: (chunk: string) => void,
  userId?: string
): Promise<DifyResponse> {
  try {
    const response = await fetch(`${apiUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query: message,
        response_mode: "streaming",
        conversation_id: conversationId,
        user: userId || "anonymous",
      }),
    })

    if (!response.ok) {
      throw new Error(`Dify API error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("无法读取响应流")
    }

    let fullAnswer = ""
    let conversationIdResult = conversationId
    let messageIdResult = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = new TextDecoder().decode(value)
        const lines = chunk.split("\n").filter((line) => line.trim())

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.event === "message") {
                fullAnswer += data.answer || ""
                if (onChunk) {
                  onChunk(data.answer || "")
                }
              } else if (data.event === "message_end") {
                conversationIdResult = data.conversation_id || conversationIdResult
                messageIdResult = data.id || messageIdResult
              }
            } catch (parseError) {
              console.warn("解析流数据失败:", parseError)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      answer: fullAnswer || "抱歉，我无法理解您的问题。",
      conversation_id: conversationIdResult,
      message_id: messageIdResult,
    }
  } catch (error) {
    console.error("Dify流式API调用失败:", error)
    return {
      answer: "抱歉，AI服务暂时不可用，请稍后再试。",
    }
  }
}

export async function sendToDify(
  apiUrl: string,
  apiKey: string,
  message: string,
  conversationId?: string,
  userId?: string
): Promise<DifyResponse> {
  try {
    // 验证输入参数
    if (!apiUrl || !apiKey || !message.trim()) {
      throw new Error("缺少必要的参数")
    }

    const response = await fetch(`${apiUrl}/chat-messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query: message.trim(),
        response_mode: "blocking",
        conversation_id: conversationId,
        user: userId || "anonymous",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Dify API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    // 验证响应数据
    if (!data || typeof data !== "object") {
      throw new Error("无效的API响应格式")
    }

    return {
      answer: data.answer || "抱歉，我无法理解您的问题。",
      conversation_id: data.conversation_id,
      message_id: data.message_id,
    }
  } catch (error) {
    console.error("Dify API调用失败:", error)
    return {
      answer:
        error instanceof Error && error.message.includes("API error")
          ? "AI服务返回错误，请检查配置或稍后再试。"
          : "抱歉，AI服务暂时不可用，请稍后再试。",
    }
  }
}

export async function sendToCustomAPI(
  apiUrl: string,
  apiKey: string,
  message: string,
  modelConfig: Record<string, any>,
): Promise<DifyResponse> {
  try {
    // 验证输入参数
    if (!apiUrl || !apiKey || !message.trim()) {
      throw new Error("缺少必要的参数")
    }

    const requestBody = {
      message: message.trim(),
      config: modelConfig,
      ...modelConfig, // 允许配置直接作为请求参数
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...modelConfig.headers, // 允许自定义请求头
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Custom API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    // 支持多种响应格式
    const answer = data.response || data.answer || data.message || data.content || "抱歉，我无法理解您的问题。"

    return {
      answer: typeof answer === "string" ? answer : JSON.stringify(answer),
      conversation_id: data.conversation_id || data.session_id,
      message_id: data.message_id || data.id,
    }
  } catch (error) {
    console.error("Custom API调用失败:", error)
    return {
      answer:
        error instanceof Error && error.message.includes("API error")
          ? "自定义AI服务返回错误，请检查配置或稍后再试。"
          : "抱歉，AI服务暂时不可用，请稍后再试。",
    }
  }
}

export async function testAPIConnection(
  platform: "dify" | "openai" | "custom",
  apiUrl: string,
  apiKey: string,
  modelConfig?: Record<string, any>,
): Promise<{ success: boolean; message: string }> {
  try {
    const testMessage = "Hello, this is a connection test."

    let response: DifyResponse
    if (platform === "dify") {
      response = await sendToDify(apiUrl, apiKey, testMessage)
    } else {
      response = await sendToCustomAPI(apiUrl, apiKey, testMessage, modelConfig || {})
    }

    if (response.answer && !response.answer.includes("暂时不可用") && !response.answer.includes("返回错误")) {
      return { success: true, message: "API连接测试成功" }
    } else {
      return { success: false, message: response.answer }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "连接测试失败",
    }
  }
}
