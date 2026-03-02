/**
 * S3 兼容存储客户端
 * 支持 MinIO / 华为云 OBS / AWS S3 / 阿里云 OSS 等
 * 
 * 统一环境变量规范：
 * - S3_ENDPOINT: 存储服务地址（如 minio:9000 或 obs.cn-east-3.myhuaweicloud.com）
 * - S3_ACCESS_KEY: 访问密钥 ID
 * - S3_SECRET_KEY: 访问密钥 Secret
 * - S3_BUCKET: 存储桶名称
 * - S3_REGION: 区域（可选，默认 us-east-1）
 * - S3_USE_SSL: 是否使用 HTTPS（可选，默认自动判断）
 * - S3_PUBLIC_URL: 公开访问地址（可选，用于生成前端可访问的 URL）
 */

import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { logger } from "@/lib/utils/logger";

type StorageConfig = {
  endpoint: string;
  rawEndpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  useSSL: boolean;
  isLocalhost: boolean;
  publicUrlBase: string;
  forcePathStyle: boolean;
};

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1' || value.toLowerCase() === 'yes';
}

function normalizeEndpoint(rawEndpoint: string, useSSL: boolean): string {
  const endpoint = rawEndpoint.trim();
  if (!endpoint) return '';

  const hasProtocol = endpoint.startsWith('http://') || endpoint.startsWith('https://');
  return hasProtocol ? endpoint.replace(/\/+$/, '') : `${useSSL ? 'https' : 'http'}://${endpoint}`.replace(/\/+$/, '');
}

function joinUrl(base: string, ...parts: string[]): string {
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedParts = parts.map((p) => p.replace(/^\/+/, '').replace(/\/+$/, ''));
  return [trimmedBase, ...trimmedParts].filter(Boolean).join('/');
}

function encodePathPreservingSlashes(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

function isAsyncIterable<T = unknown>(value: unknown): value is AsyncIterable<T> {
  return !!value && typeof (value as any)[Symbol.asyncIterator] === 'function';
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;

  // Web streams / blobs in some runtimes
  if (typeof (body as any).arrayBuffer === 'function') {
    const ab = await (body as any).arrayBuffer();
    return Buffer.from(ab);
  }

  if (isAsyncIterable<Uint8Array>(body)) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('Unsupported S3 response body type');
}

let cachedConfig: StorageConfig | null | undefined;
let cachedClient: S3Client | null | undefined;

/**
 * 获取存储配置
 */
function computeStorageConfig(): StorageConfig | null {
  const endpoint = process.env.S3_ENDPOINT || '';
  const accessKey = process.env.S3_ACCESS_KEY || '';
  const secretKey = process.env.S3_SECRET_KEY || '';
  const bucket = process.env.S3_BUCKET || '';
  const region = process.env.S3_REGION || 'us-east-1';
  
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    return null;
  }
  
  // 判断是否为本地服务（使用 HTTP）
  const isLocalhost = endpoint.includes('localhost') || 
                      endpoint.includes('127.0.0.1') || 
                      endpoint.includes('minio');
  
  // 支持显式指定 SSL
  const useSSL = parseBoolean(process.env.S3_USE_SSL, !isLocalhost);

  // forcePathStyle: 默认兼容多数 S3 兼容存储；如需改为 virtual-hosted-style 可显式关闭
  const forcePathStyle = parseBoolean(process.env.S3_FORCE_PATH_STYLE, true);

  // 构建完整的 endpoint URL（去掉末尾 /）
  const fullEndpoint = normalizeEndpoint(endpoint, useSSL);
  const publicUrlBase = (process.env.S3_PUBLIC_URL || fullEndpoint).replace(/\/+$/, '');
  
  return {
    endpoint: fullEndpoint,
    rawEndpoint: endpoint,
    region,
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    bucket,
    useSSL,
    isLocalhost,
    publicUrlBase,
    forcePathStyle,
  };
}

function getStorageConfig(): StorageConfig | null {
  if (cachedConfig === undefined) {
    cachedConfig = computeStorageConfig();
    if (process.env.S3_DEBUG === "true") {
      logger.debug(
        "[S3] storage config loaded",
        cachedConfig
          ? { endpoint: cachedConfig.endpoint, bucket: cachedConfig.bucket }
          : { configured: false }
      );
    }
  }
  return cachedConfig;
}

/**
 * 创建 S3 客户端
 */
function getS3Client(): S3Client | null {
  if (cachedClient !== undefined) return cachedClient;

  const config = getStorageConfig();
  if (!config) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle,
  });

  return cachedClient;
}

/**
 * 获取存储桶名称
 */
export function getBucketName(): string {
  return getStorageConfig()?.bucket || '';
}

/**
 * 生成文件的公开访问 URL
 */
export function getPublicUrl(key: string): string {
  const config = getStorageConfig();
  if (!config) return '';
  
  // Path style URL: http://endpoint/bucket/key
  return joinUrl(config.publicUrlBase, config.bucket, encodePathPreservingSlashes(key));
}

/**
 * 上传文件
 */
export async function uploadFile(
  key: string, 
  body: Buffer, 
  contentType: string
): Promise<string> {
  const config = getStorageConfig();
  const client = getS3Client();
  
  if (!config || !client) {
    throw new Error('存储服务未配置');
  }
  
  if (process.env.S3_DEBUG === "true") {
    logger.debug("[S3 Upload] start", {
      endpoint: config.endpoint,
      bucket: config.bucket,
      key,
      contentType,
      size: body.length,
    });
  }
  
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);
  
  const url = getPublicUrl(key);
  if (process.env.S3_DEBUG === "true") {
    logger.debug("[S3 Upload] success", { url });
  }
  
  return url;
}

/**
 * 删除文件
 */
export async function deleteFile(key: string): Promise<void> {
  const config = getStorageConfig();
  const client = getS3Client();
  
  if (!config || !client) {
    throw new Error('存储服务未配置');
  }
  
  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  await client.send(command);
}

/**
 * 检查文件是否存在
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const config = getStorageConfig();
    const client = getS3Client();
    
    if (!config || !client) return false;
    
    const command = new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (err: any) {
    // 仅当对象不存在时返回 false；其他错误也返回 false（但可通过 S3_DEBUG 排查）
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound' || err?.Code === 'NotFound') {
      return false;
    }
    if (process.env.S3_DEBUG === "true") {
      logger.debug("[S3 Head] error", { key, name: err?.name, message: err?.message });
    }
    return false;
  }
}

/**
 * 获取文件内容
 */
export async function getFile(key: string): Promise<Buffer | null> {
  try {
    const config = getStorageConfig();
    const client = getS3Client();
    
    if (!config || !client) return null;
    
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });
    
    const response = await client.send(command);
    
    if (!response.Body) return null;
    const buf = await bodyToBuffer(response.Body);
    return buf.length ? buf : null;
  } catch (err: any) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey' || err?.name === 'NotFound') {
      return null;
    }
    if (process.env.S3_DEBUG === "true") {
      logger.debug("[S3 Get] error", { key, name: err?.name, message: err?.message });
    }
    return null;
  }
}

/**
 * 生成唯一的文件 key
 */
export function generateFileKey(originalName: string, prefix: string = 'uploads'): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).slice(2, 11);
  const ext = originalName.split('.').pop()?.toLowerCase() || 'bin';
  
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  return `${prefix}/${year}/${month}/${timestamp}-${randomStr}.${ext}`;
}

/**
 * 检查存储是否已配置
 */
export function isStorageConfigured(): boolean {
  const config = getStorageConfig();
  return config !== null;
}

/**
 * 获取存储配置信息（调试用）
 */
export function getStorageConfigInfo(): Record<string, string> {
  const config = getStorageConfig();
  
  if (!config) {
    return {
      configured: 'no',
      message: '未配置存储服务，将使用本地存储',
      required_env: 'S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET',
    };
  }
  
  return {
    configured: 'yes',
    endpoint: config.endpoint,
    public_url_base: config.publicUrlBase,
    bucket: config.bucket,
    region: config.region,
    ssl: config.useSSL ? 'yes' : 'no',
    force_path_style: config.forcePathStyle ? 'yes' : 'no',
  };
}
