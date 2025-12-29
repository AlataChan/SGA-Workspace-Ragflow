/**
 * 将RAGFlow返回的任意格式内容规范化为字符串
 * 处理各种可能的数据结构,确保永远返回可读的字符串
 */
export function normalizeRagflowContent(value: unknown): string {
  // 调试日志
  console.log('[normalizeRagflowContent] 输入:', {
    type: typeof value,
    isArray: Array.isArray(value),
    isNull: value === null,
    isUndefined: value === undefined,
    preview: typeof value === 'string'
      ? value.substring(0, 100)
      : (typeof value === 'object' ? JSON.stringify(value)?.substring(0, 200) : String(value))
  });

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    // 处理数组 - 可能是RAGFlow返回的消息片段数组
    const parts = value
      .map((item) => normalizeRagflowContent(item))
      .filter((item) => item.length > 0);
    return parts.join("");
  }

  if (typeof value === "object") {
    const record = value as Record<string, any>;

    // 按优先级尝试提取内容字段
    const candidates = [
      record.answer,
      record.content,
      record.final_answer,
      record.text,
      record.message,
      record.outputs?.content,
      record.outputs?.answer,
      record.data?.content,
      record.data?.answer,
      record.data?.text,
      record.data?.outputs?.content,
      record.data?.outputs?.answer,
      record.result,
      record.response,
    ];

    for (const candidate of candidates) {
      if (candidate !== undefined && candidate !== null) {
        const normalized = normalizeRagflowContent(candidate);
        if (normalized.length > 0 && normalized !== '[object Object]') {
          console.log('[normalizeRagflowContent] 找到有效内容:', normalized.substring(0, 100));
          return normalized;
        }
      }
    }

    // 如果对象中没有找到标准字段,尝试智能提取
    // 检查是否有任何看起来像内容的字符串字段
    for (const [key, val] of Object.entries(record)) {
      if (typeof val === 'string' && val.length > 0 && val.length < 100000) {
        // 跳过看起来像ID或元数据的字段
        const skipKeys = ['id', 'session_id', 'conversation_id', 'user_id', 'agent_id', 'type', 'status', 'code'];
        if (!skipKeys.includes(key.toLowerCase()) && !key.endsWith('_id') && !key.endsWith('Id')) {
          console.log(`[normalizeRagflowContent] 从字段 "${key}" 提取内容:`, val.substring(0, 100));
          return val;
        }
      }
    }

    // 最后尝试JSON序列化,但过滤掉无意义的结果
    try {
      const jsonStr = JSON.stringify(record, null, 2);
      // 如果JSON太短或太长,返回友好提示
      if (jsonStr.length < 5) {
        console.warn('[normalizeRagflowContent] JSON内容太短:', jsonStr);
        return "";
      }
      if (jsonStr.length > 50000) {
        console.warn('[normalizeRagflowContent] JSON内容太长,截断');
        return jsonStr.substring(0, 1000) + "\n...(内容过长已截断)";
      }
      console.log('[normalizeRagflowContent] 返回JSON字符串:', jsonStr.substring(0, 200));
      return jsonStr;
    } catch (e) {
      console.error('[normalizeRagflowContent] JSON序列化失败:', e);
      // 绝对不要返回 [object Object]
      return "";
    }
  }

  // 对于其他类型,尝试转字符串但检查结果
  const result = String(value);
  if (result === '[object Object]') {
    console.error('[normalizeRagflowContent] 检测到 [object Object],返回空字符串');
    return "";
  }
  return result;
}
