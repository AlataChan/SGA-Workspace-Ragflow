/**
 * Document type definitions
 *
 * 统一文档状态和类型定义，确保前后端一致性
 */

/**
 * 文档解析状态枚举
 *
 * 与 RAGFlow API 状态对应关系:
 * - RAGFlow '0' or undefined → PARSING (0)
 * - RAGFlow '1' → COMPLETED (1)
 * - RAGFlow '2' → FAILED (2)
 */
export enum DocumentStatus {
  PARSING = 0,    // 解析中
  COMPLETED = 1,  // 解析完成
  FAILED = 2      // 解析失败
}

/**
 * 文档状态信息（标准化格式）
 */
export type DocumentStatusInfo = {
  /** 文档 ID */
  docId: string;

  /** 文档名称 */
  name: string;

  /** 解析状态（数字枚举） */
  status: DocumentStatus;

  /** 解析进度 (0-100) */
  progress: number;

  /** 分块数量 */
  chunkNum: number;

  /** Token 数量 */
  tokenNum: number;

  /** 文件大小（字节） */
  size: number;

  /** 创建时间 */
  createTime: string;

  /** 错误信息（仅当 status === FAILED 时存在） */
  errorMsg?: string;
};

/**
 * 将 RAGFlow API 返回的字符串状态转换为数字枚举
 *
 * @param ragflowStatus RAGFlow 返回的状态字符串 ('0' | '1' | '2')
 * @returns 标准化的数字枚举状态
 */
export function convertRagflowStatus(ragflowStatus: string | undefined): DocumentStatus {
  if (ragflowStatus === '1') return DocumentStatus.COMPLETED;
  if (ragflowStatus === '2') return DocumentStatus.FAILED;
  return DocumentStatus.PARSING;
}

/**
 * 获取状态的可读文本
 *
 * @param status 文档状态
 * @returns 状态的中文描述
 */
export function getStatusText(status: DocumentStatus): string {
  switch (status) {
    case DocumentStatus.PARSING:
      return '解析中';
    case DocumentStatus.COMPLETED:
      return '已完成';
    case DocumentStatus.FAILED:
      return '失败';
    default:
      return '未知';
  }
}

/**
 * 判断状态是否为终态（不会再变化）
 *
 * @param status 文档状态
 * @returns 是否为终态
 */
export function isFinalStatus(status: DocumentStatus): boolean {
  return status === DocumentStatus.COMPLETED || status === DocumentStatus.FAILED;
}
