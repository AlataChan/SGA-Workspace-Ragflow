/**
 * Dify Workflow 执行结果（统一格式）
 */
export interface WorkflowRunResult {
  success: boolean;

  /** Dify files/upload 返回的 id（用于排障/可选清理） */
  uploadFileId?: string;

  /** 主输出内容（从 outputs.text 提取） */
  text?: string;

  /** 完整的 outputs 对象（用于调试/高级场景） */
  outputs?: Record<string, any>;

  /** 执行耗时（毫秒） */
  elapsedTimeMs?: number;

  /** Token 使用量 */
  usage?: {
    totalTokens?: number;
    totalSteps?: number;
  };

  /** 错误信息（仅失败时） */
  error?: {
    message: string;
    code?: string;
  };

  /** 原始响应（用于调试） */
  rawResponse?: any;
}

/**
 * 将 Dify 原始响应映射为 WorkflowRunResult
 */
export function mapDifyWorkflowResponse(
  raw: any,
  uploadFileId?: string,
): WorkflowRunResult {
  const data = raw?.data;

  if (!data) {
    return {
      success: false,
      uploadFileId,
      error: { message: "响应格式异常：缺少 data 字段" },
      rawResponse: raw,
    };
  }

  const status = String(data.status || "");
  const isSuccess = status === "succeeded";

  return {
    success: isSuccess,
    uploadFileId,
    text: data.outputs?.text,
    outputs: data.outputs,
    elapsedTimeMs: data.elapsed_time
      ? Math.round(Number(data.elapsed_time) * 1000)
      : undefined,
    usage: {
      totalTokens: data.total_tokens,
      totalSteps: data.total_steps,
    },
    error: !isSuccess
      ? {
          message: data.error || `工作流执行失败：${status || "unknown"}`,
          code: status || undefined,
        }
      : undefined,
    rawResponse: raw,
  };
}

