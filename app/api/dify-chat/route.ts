import { NextRequest, NextResponse } from "next/server";

// 默认配置（向后兼容）
const DEFAULT_DIFY_BASE_URL = "http://192.144.232.60/v1";
const DEFAULT_DIFY_API_KEY = "app-P0zICVDnPuLSteB4iM7SClQi";

// 超时和重试配置
const DIFY_TIMEOUT_MS = 180000; // 180秒，适应工具调用的长时间需求
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 指数退避：1s, 2s, 4s
const DIFY_CONVERSATION_NAME_TIMEOUT_MS = 2000; // 会话标题拉取超时（避免阻塞流结束太久）

function normalizeDifyBaseUrl(input: unknown) {
  const raw = String(input || "").trim();
  if (!raw) return raw;
  const trimmed = raw.replace(/\/+$/, "");
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function shouldTryHttpsUpgrade(url: string, error: any) {
  if (!url.startsWith("http://")) return false;
  const cause = error?.cause;
  const code =
    typeof cause?.code === "string"
      ? cause.code
      : typeof error?.code === "string"
        ? error.code
        : "";
  if (code !== "UND_ERR_SOCKET") return false;
  const message = `${cause?.message || ""} ${error?.message || ""}`.toLowerCase();
  return message.includes("other side closed") || message.includes("socket hang up");
}

// 创建带超时的fetch函数
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const run = async (targetUrl: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(targetUrl, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await run(url);
  } catch (error: any) {
    if (shouldTryHttpsUpgrade(url, error)) {
      const httpsUrl = url.replace(/^http:\/\//, "https://");
      console.warn("[Dify Chat] 检测到可能的 http/https 协议不匹配，自动升级为 https 重试:", httpsUrl);
      return await run(httpsUrl);
    }
    throw error;
  }
}

// 判断是否应该重试的错误
function shouldRetry(error: any, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;

  // 网络错误或超时错误应该重试
  if (error.name === 'AbortError' || error.name === 'TypeError') return true;

  // HTTP 5xx 服务器错误应该重试
  if (error.status >= 500) return true;

  // HTTP 429 (Too Many Requests) 应该重试
  if (error.status === 429) return true;

  return false;
}

// 延迟函数
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryFetchConversationName(params: {
  difyBaseUrl: string;
  difyApiKey: string;
  userId: string;
  conversationId: string;
}): Promise<string | null> {
  try {
    const searchParams = new URLSearchParams({
      user: params.userId,
      limit: '100',
      sort_by: '-updated_at',
    });

    const url = `${params.difyBaseUrl}/conversations?${searchParams}`;
    const response = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${params.difyApiKey}`,
          'Content-Type': 'application/json',
        },
      },
      DIFY_CONVERSATION_NAME_TIMEOUT_MS,
    );

    if (!response.ok) {
      console.warn('[Dify Chat] 获取会话列表失败:', response.status, response.statusText);
      return null;
    }

    const data = await response.json().catch(() => null);
    const list: any[] = Array.isArray(data?.data) ? data.data : [];
    const hit = list.find(
      (c: any) => c?.id === params.conversationId || c?.conversation_id === params.conversationId,
    );

    const name = hit?.name;
    if (typeof name !== 'string') return null;
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (error) {
    console.warn('[Dify Chat] 获取会话标题异常:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log("[Dify Chat] 收到请求:", req.method, req.url);

  try {
    // 获取请求体
    const body = await req.json();
    console.log("[Dify Chat] 请求体:", JSON.stringify(body, null, 2));

    // 获取Agent配置（优先使用传入的配置）
    const difyBaseUrl = normalizeDifyBaseUrl(body.agentConfig?.difyUrl || DEFAULT_DIFY_BASE_URL);
    const difyApiKey = body.agentConfig?.difyKey || DEFAULT_DIFY_API_KEY;

    console.log("[Dify Chat] 使用配置:", {
      difyBaseUrl,
      hasApiKey: !!difyApiKey,
      userId: body.agentConfig?.userId || body.user
    });

    // 处理不同的请求格式
    let query = "";
    let userId = body.agentConfig?.userId || body.user || "demo-user";

    if (body.query) {
      // 直接的Dify格式
      query = body.query;
    } else if (body.messages) {
      // NextChat格式，转换为Dify格式
      const lastMessage = body.messages[body.messages.length - 1];
      query = lastMessage?.content || "";
    }

    // 处理文件附件
    const files: any[] = [];

    console.log("[Dify Chat] 检查files参数:", {
      hasFiles: !!body.files,
      filesType: typeof body.files,
      filesLength: Array.isArray(body.files) ? body.files.length : 'not array',
      files: body.files
    });

    // 如果直接传递了files参数（Dify格式）
    if (body.files && Array.isArray(body.files)) {
      files.push(...body.files);
      console.log("[Dify Chat] 添加了files参数:", files);
    }

    // 如果是从messages中提取附件（NextChat格式）
    const lastMessage = body.messages?.[body.messages.length - 1];
    if (lastMessage?.attachments && Array.isArray(lastMessage.attachments)) {
      for (const attachment of lastMessage.attachments) {
        if (attachment.base64) {
          try {
            // 将base64转换为文件并上传到Dify
            const base64Data = attachment.base64.split(',')[1]; // 移除data:image/jpeg;base64,前缀
            const buffer = Buffer.from(base64Data, 'base64');

            // 创建FormData上传文件
            const formData = new FormData();
            const blob = new Blob([buffer], { type: attachment.type });
            formData.append('file', blob, attachment.name);
            formData.append('user', userId);

            // 上传文件到Dify
            const uploadResponse = await fetchWithTimeout(`${difyBaseUrl}/files/upload`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${difyApiKey}`,
              },
              body: formData,
            }, DIFY_TIMEOUT_MS);

            if (uploadResponse.ok) {
              const uploadResult = await uploadResponse.json();

              // 根据 Dify API 文档进行更精确的文件类型映射
              let fileType = "custom"; // 默认类型

              if (attachment.type.startsWith('image/')) {
                fileType = "image";
              } else if (attachment.type.startsWith('audio/')) {
                fileType = "audio";
              } else if (attachment.type.startsWith('video/')) {
                fileType = "video";
              } else if (
                attachment.type === 'application/pdf' ||
                attachment.type === 'text/plain' ||
                attachment.type === 'text/markdown' ||
                attachment.type === 'text/html' ||
                attachment.type === 'application/msword' ||
                attachment.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                attachment.type === 'application/vnd.ms-excel' ||
                attachment.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                attachment.type === 'text/csv' ||
                attachment.type === 'message/rfc822' ||
                attachment.type === 'application/vnd.ms-outlook' ||
                attachment.type === 'application/vnd.ms-powerpoint' ||
                attachment.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                attachment.type === 'application/xml' ||
                attachment.type === 'application/epub+zip'
              ) {
                fileType = "document";
              }

              files.push({
                type: fileType,
                transfer_method: 'local_file',
                upload_file_id: uploadResult.id
              });
              console.log("[Dify Chat] 文件上传成功:", {
                id: uploadResult.id,
                name: attachment.name,
                type: fileType,
                originalType: attachment.type
              });
            } else {
              console.error("[Dify Chat] 文件上传失败:", uploadResponse.status, await uploadResponse.text());
            }
          } catch (error) {
            console.error("[Dify Chat] 处理文件附件失败:", error);
          }
        }
      }
    }

    const isNewConversationRequest = !body.conversation_id;

    const difyRequestBody = {
      inputs: {},
      query: query,
      response_mode: "streaming", // 强制使用流式输出
      user: userId,
      ...(body.conversation_id && { conversation_id: body.conversation_id }), // 如果有conversation_id则传递
      ...(files.length > 0 && { files }) // 如果有文件则传递
    };

    console.log("[Dify Chat] 发送到Dify:", JSON.stringify(difyRequestBody, null, 2));

    // 构建Dify API URL
    const targetUrl = `${difyBaseUrl}/chat-messages`;
    console.log("[Dify Chat] 目标URL:", targetUrl);

    // 发送请求到Dify，带重试机制
    let response: Response;
    let lastError: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Dify Chat] 尝试第 ${attempt + 1} 次请求...`);

        response = await fetchWithTimeout(targetUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${difyApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(difyRequestBody)
        }, DIFY_TIMEOUT_MS);

        // 请求成功，跳出重试循环
        break;

      } catch (error) {
        lastError = error;
        console.error(`[Dify Chat] 第 ${attempt + 1} 次请求失败:`, error);

        // 判断是否应该重试
        if (shouldRetry(error, attempt)) {
          const delayMs = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          console.log(`[Dify Chat] ${delayMs}ms 后进行第 ${attempt + 2} 次重试...`);
          await delay(delayMs);
          continue;
        } else {
          // 不应该重试的错误，直接抛出
          throw error;
        }
      }
    }

    // 如果所有重试都失败了
    if (!response!) {
      console.error(`[Dify Chat] 所有 ${MAX_RETRIES + 1} 次请求都失败了`);
      throw lastError || new Error('所有重试都失败了');
    }

    console.log("[Dify Chat] Dify响应状态:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Dify Chat] Dify API错误:", errorText);
      return NextResponse.json(
        { error: `Dify API错误: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Dify总是返回流式响应
    if (true) {
      console.log("[Dify Chat] 处理流式响应");
      
      // 创建转换流，将Dify格式转换为OpenAI格式
      let cachedConversationName: string | null = null;

      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line.length > 6) {
              try {
                const jsonStr = line.slice(6);
                console.log('[Dify Chat] 原始JSON字符串:', jsonStr.substring(0, 200));

                // 尝试清理JSON字符串，处理各种转义字符
                let cleanJsonStr = jsonStr;

                // 处理Unicode转义
                cleanJsonStr = cleanJsonStr.replace(/\\u[\dA-F]{4}/gi, (match) => {
                  try {
                    return JSON.parse('"' + match + '"');
                  } catch {
                    return match;
                  }
                });

                // 处理其他可能的转义问题
                // 先处理双反斜杠
                cleanJsonStr = cleanJsonStr.replace(/\\\\/g, '\\');
                // 然后处理Unicode转义序列
                try {
                  cleanJsonStr = cleanJsonStr.replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => {
                    return String.fromCharCode(parseInt(hex, 16));
                  });
                } catch (e) {
                  console.log('[Dify Chat] Unicode转义处理失败:', e);
                  // 如果Unicode处理失败，尝试移除有问题的Unicode转义
                  cleanJsonStr = cleanJsonStr.replace(/\\u[0-9a-fA-F]{0,4}/g, '');
                }

                let data;
                try {
                  data = JSON.parse(cleanJsonStr);
                } catch (parseError) {
                  console.log('[Dify Chat] JSON解析失败，尝试修复:', parseError);
                  console.log('[Dify Chat] 原始数据:', cleanJsonStr);

                  // 尝试修复常见的JSON问题
                  let fixedJsonStr = cleanJsonStr;

                  // 修复未闭合的字符串
                  const openQuotes = (fixedJsonStr.match(/"/g) || []).length;
                  if (openQuotes % 2 !== 0) {
                    fixedJsonStr += '"';
                  }

                  // 修复未闭合的对象
                  const openBraces = (fixedJsonStr.match(/{/g) || []).length;
                  const closeBraces = (fixedJsonStr.match(/}/g) || []).length;
                  for (let i = 0; i < openBraces - closeBraces; i++) {
                    fixedJsonStr += '}';
                  }

                  try {
                    data = JSON.parse(fixedJsonStr);
                    console.log('[Dify Chat] JSON修复成功');
                  } catch (fixError) {
                    console.log('[Dify Chat] JSON修复失败，跳过此数据块:', fixError);
                    continue;
                  }
                }
                console.log('[Dify Chat] 解析的数据:', data);

                // 转换Dify格式到OpenAI格式
                if ((data.event === 'message' || data.event === 'agent_message') && data.answer !== undefined) {
                  // 处理文件和图片链接
                  const attachments: any[] = [];

                  // 检查是否有文件信息
                  if (data.files && Array.isArray(data.files)) {
                    for (const file of data.files) {
                      attachments.push({
                        id: file.id || Date.now().toString(),
                        name: file.name || 'file',
                        type: file.type || 'application/octet-stream',
                        size: file.size || 0,
                        url: file.url
                      });
                    }
                  }

                  // 检查消息中的图片链接
                  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g;
                  let match;
                  while ((match = imageRegex.exec(data.answer)) !== null) {
                    attachments.push({
                      id: Date.now().toString() + Math.random(),
                      name: 'image.jpg',
                      type: 'image/jpeg',
                      size: 0,
                      url: match[1]
                    });
                  }

                  // 检查消息中的文档下载链接
                  // 1. 检测Markdown格式的链接 [filename](url)
                  const markdownDocRegex = /\[([^\]]+\.(?:docx?|xlsx?|pptx?|pdf))\]\((https?:\/\/[^\s\)]+)\)/gi;
                  while ((match = markdownDocRegex.exec(data.answer)) !== null) {
                    const fileName = match[1];
                    const fileUrl = match[2];
                    const fileExtension = fileName.split('.').pop()?.toLowerCase();

                    let fileType = 'application/octet-stream';
                    if (fileExtension === 'docx' || fileExtension === 'doc') {
                      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                      fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    } else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
                      fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    } else if (fileExtension === 'pdf') {
                      fileType = 'application/pdf';
                    }

                    attachments.push({
                      id: Date.now().toString() + Math.random(),
                      name: fileName,
                      type: fileType,
                      size: 0, // 无法获取文件大小，设为0
                      url: fileUrl
                    });
                  }

                  // 2. 检测纯文本格式的文档链接 (Dify格式)
                  const plainDocRegex = /(https?:\/\/[^\s]+\.(?:docx?|xlsx?|pptx?|pdf))/gi;
                  while ((match = plainDocRegex.exec(data.answer)) !== null) {
                    const fileUrl = match[1];
                    const fileName = fileUrl.split('/').pop() || 'document';
                    const fileExtension = fileName.split('.').pop()?.toLowerCase();

                    // 避免重复添加已经通过Markdown格式检测到的文件
                    const alreadyExists = attachments.some(att => att.url === fileUrl);
                    if (alreadyExists) continue;

                    let fileType = 'application/octet-stream';
                    if (fileExtension === 'docx' || fileExtension === 'doc') {
                      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                      fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    } else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
                      fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    } else if (fileExtension === 'pdf') {
                      fileType = 'application/pdf';
                    }

                    attachments.push({
                      id: Date.now().toString() + Math.random(),
                      name: fileName,
                      type: fileType,
                      size: 0, // 无法获取文件大小，设为0
                      url: fileUrl
                    });
                  }

                  const openaiFormat = {
                    id: data.message_id || 'dify-msg',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'dify-agent',
                    conversation_id: data.conversation_id, // 包含conversation_id
                    attachments: attachments.length > 0 ? attachments : undefined,
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

                // 处理agent_thought事件中的文档链接
                if (data.event === 'agent_thought' && data.thought) {
                  console.log('[Dify Chat] 检查agent_thought中的文档链接:', data.thought);

                  // 检查thought中的文档下载链接
                  const attachments: any[] = [];
                  let match;

                  // 1. 检测Markdown格式的链接 [filename](url)
                  const markdownDocRegex = /\[([^\]]+\.(?:docx?|xlsx?|pptx?|pdf))\]\((https?:\/\/[^\s\)]+)\)/gi;
                  while ((match = markdownDocRegex.exec(data.thought)) !== null) {
                    const fileName = match[1];
                    const fileUrl = match[2];
                    const fileExtension = fileName.split('.').pop()?.toLowerCase();

                    let fileType = 'application/octet-stream';
                    if (fileExtension === 'docx' || fileExtension === 'doc') {
                      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                      fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    } else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
                      fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    } else if (fileExtension === 'pdf') {
                      fileType = 'application/pdf';
                    }

                    attachments.push({
                      id: Date.now().toString() + Math.random(),
                      name: fileName,
                      type: fileType,
                      size: 0,
                      url: fileUrl
                    });
                  }

                  // 2. 检测纯文本格式的文档链接 (Dify格式)
                  const plainDocRegex = /(https?:\/\/[^\s]+\.(?:docx?|xlsx?|pptx?|pdf))/gi;
                  while ((match = plainDocRegex.exec(data.thought)) !== null) {
                    const fileUrl = match[1];
                    const fileName = fileUrl.split('/').pop() || 'document';
                    const fileExtension = fileName.split('.').pop()?.toLowerCase();

                    // 避免重复添加已经通过Markdown格式检测到的文件
                    const alreadyExists = attachments.some(att => att.url === fileUrl);
                    if (alreadyExists) continue;

                    let fileType = 'application/octet-stream';
                    if (fileExtension === 'docx' || fileExtension === 'doc') {
                      fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
                      fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                    } else if (fileExtension === 'pptx' || fileExtension === 'ppt') {
                      fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                    } else if (fileExtension === 'pdf') {
                      fileType = 'application/pdf';
                    }

                    attachments.push({
                      id: Date.now().toString() + Math.random(),
                      name: fileName,
                      type: fileType,
                      size: 0,
                      url: fileUrl
                    });
                  }

                  // 如果找到了文档链接，发送包含附件的消息
                  if (attachments.length > 0) {
                    console.log('[Dify Chat] 找到文档链接，发送附件:', attachments);

                    const thoughtFormat = {
                      id: data.message_id || 'dify-msg',
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                      model: 'dify-agent',
                      conversation_id: data.conversation_id,
                      choices: [{
                        index: 0,
                        delta: {
                          content: '',
                          attachments: attachments
                        },
                        finish_reason: null
                      }]
                    };

                    controller.enqueue(
                      new TextEncoder().encode(`data: ${JSON.stringify(thoughtFormat)}\n\n`)
                    );
                  }
                }

                if (data.event === 'message_end' || data.event === 'agent_message_end') {
                  console.log('[Dify Chat] 检查文档链接，完整消息内容:', data.answer || '');

                  if (
                    isNewConversationRequest &&
                    !cachedConversationName &&
                    typeof data.conversation_id === 'string' &&
                    data.conversation_id.length > 0
                  ) {
                    cachedConversationName = await tryFetchConversationName({
                      difyBaseUrl,
                      difyApiKey,
                      userId,
                      conversationId: data.conversation_id,
                    });
                    if (cachedConversationName) {
                      console.log('[Dify Chat] 获取到会话标题:', cachedConversationName);
                    }
                  }

                  const endFormat = {
                    id: data.message_id || 'dify-msg',
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: 'dify-agent',
                    conversation_id: data.conversation_id, // 包含conversation_id
                    ...(cachedConversationName ? { conversation_name: cachedConversationName } : {}),
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
                console.warn("[Dify Chat] 解析SSE数据失败:", e);
                console.warn("[Dify Chat] 原始数据:", line.slice(6).substring(0, 200));
              }
            }
          }
        }
      });

      return new Response(response.body?.pipeThrough(transformStream), {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // 这里不应该到达，因为Dify总是返回流式响应
    return NextResponse.json({ error: "Unexpected non-streaming response" }, { status: 500 });

  } catch (error) {
    console.error("[Dify Chat] 错误:", error);

    // 根据错误类型返回不同的错误信息
    let errorMessage = "服务暂时不可用，请稍后重试";
    let statusCode = 500;

    const err = error as any;
    if (err.name === 'AbortError') {
      errorMessage = "请求超时，Dify服务响应时间过长。如果您在使用工具功能，请稍后重试";
      statusCode = 408; // Request Timeout
    } else if (err.message?.includes('fetch')) {
      errorMessage = "无法连接到Dify服务，请检查网络连接";
      statusCode = 503; // Service Unavailable
    } else if (err.status === 401) {
      errorMessage = "Dify API密钥无效，请检查配置";
      statusCode = 401;
    } else if (err.status === 429) {
      errorMessage = "请求过于频繁，请稍后重试";
      statusCode = 429;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error),
        retries_attempted: MAX_RETRIES + 1,
        timeout_seconds: DIFY_TIMEOUT_MS / 1000
      },
      { status: statusCode }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
