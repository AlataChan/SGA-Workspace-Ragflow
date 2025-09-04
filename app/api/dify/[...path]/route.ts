import { NextRequest, NextResponse } from "next/server";

const DIFY_BASE_URL = "http://192.144.232.60";
const DIFY_API_KEY = "hvTuW1NrJZ5JDjdQ";

async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  console.log("[Dify Route] 收到请求:", req.method, req.url);

  try {
    const { path } = await params;
    const subpath = path.join("/");
    
    // 构建Dify API URL
    const targetUrl = `${DIFY_BASE_URL}/v1/${subpath}`;
    console.log("[Dify Route] 目标URL:", targetUrl);

    // 获取请求体
    let body;
    if (req.method !== "GET") {
      const text = await req.text();
      console.log("[Dify Route] 请求体:", text);
      
      if (text) {
        try {
          const jsonBody = JSON.parse(text);
          
          // 转换NextChat格式到Dify格式
          if (jsonBody.messages && Array.isArray(jsonBody.messages)) {
            const lastMessage = jsonBody.messages[jsonBody.messages.length - 1];
            body = JSON.stringify({
              inputs: {},
              query: lastMessage?.content || "",
              response_mode: jsonBody.stream ? "streaming" : "blocking",
              user: "nextchat-user",
              conversation_id: jsonBody.conversation_id
            });
          } else {
            body = text;
          }
        } catch (e) {
          body = text;
        }
      }
    }

    // 构建请求头
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${DIFY_API_KEY}`,
      "Content-Type": "application/json",
    };

    // 复制必要的请求头
    const forwardHeaders = ["user-agent", "accept", "accept-language"];
    forwardHeaders.forEach((key) => {
      const value = req.headers.get(key);
      if (value) {
        headers[key] = value;
      }
    });

    console.log("[Dify Route] 请求头:", headers);

    // 发送请求到Dify
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body,
    });

    console.log("[Dify Route] Dify响应状态:", response.status);

    // 如果是流式响应
    if (response.headers.get("content-type")?.includes("text/event-stream")) {
      console.log("[Dify Route] 处理流式响应");
      
      // 创建转换流，将Dify格式转换为OpenAI格式
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line.length > 6) {
              try {
                const data = JSON.parse(line.slice(6));
                
                // 转换Dify格式到OpenAI格式
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
                  };
                  
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify(openaiFormat)}\n\n`)
                  );
                }
                
                if (data.event === 'message_end') {
                  const endFormat = {
                    id: data.message_id || 'dify-msg',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'dify-agent',
                    choices: [{
                      index: 0,
                      delta: {},
                      finish_reason: 'stop'
                    }]
                  };
                  
                  controller.enqueue(
                    new TextEncoder().encode(`data: ${JSON.stringify(endFormat)}\n\n`)
                  );
                  controller.enqueue(
                    new TextEncoder().encode(`data: [DONE]\n\n`)
                  );
                }
              } catch (e) {
                console.warn("[Dify Route] 解析SSE数据失败:", e);
              }
            }
          }
        }
      });

      return new Response(response.body?.pipeThrough(transformStream), {
        status: response.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // 非流式响应
    const responseText = await response.text();
    console.log("[Dify Route] Dify响应:", responseText.substring(0, 500));

    try {
      const data = JSON.parse(responseText);
      
      // 转换Dify格式到OpenAI格式
      if (data.answer) {
        const openaiFormat = {
          id: data.message_id || 'dify-msg',
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'dify-agent',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: data.answer
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
          }
        };
        
        return NextResponse.json(openaiFormat);
      }
    } catch (e) {
      console.warn("[Dify Route] 解析响应失败:", e);
    }

    // 直接返回原始响应
    return new Response(responseText, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });

  } catch (error) {
    console.error("[Dify Route] 错误:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
export const PATCH = handle;

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
