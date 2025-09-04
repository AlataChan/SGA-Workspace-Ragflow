import { z } from "zod"
import DOMPurify from "isomorphic-dompurify"
import { ValidationError } from "@/lib/utils/error-handler"

// 通用验证规则
export const commonValidation = {
  // 用户名验证
  username: z
    .string()
    .min(3, "用户名至少3个字符")
    .max(50, "用户名最多50个字符")
    .regex(/^[a-zA-Z0-9_-]+$/, "用户名只能包含字母、数字、下划线和连字符"),

  // 密码验证
  password: z
    .string()
    .min(8, "密码至少8个字符")
    .max(128, "密码最多128个字符")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "密码必须包含大小写字母和数字"),

  // 邮箱验证
  email: z
    .string()
    .email("邮箱格式不正确")
    .max(255, "邮箱最多255个字符"),

  // 公司名称验证
  companyName: z
    .string()
    .min(2, "公司名称至少2个字符")
    .max(100, "公司名称最多100个字符")
    .trim(),

  // URL验证
  url: z
    .string()
    .url("URL格式不正确")
    .max(2048, "URL最多2048个字符"),

  // API密钥验证
  apiKey: z
    .string()
    .min(10, "API密钥至少10个字符")
    .max(512, "API密钥最多512个字符"),

  // 文本内容验证
  text: z
    .string()
    .max(10000, "文本内容最多10000个字符")
    .trim(),

  // 描述验证
  description: z
    .string()
    .max(1000, "描述最多1000个字符")
    .trim()
    .optional(),

  // UUID验证
  uuid: z
    .string()
    .uuid("无效的UUID格式"),

  // 分页参数验证
  page: z
    .coerce
    .number()
    .int("页码必须是整数")
    .min(1, "页码最小为1")
    .default(1),

  limit: z
    .coerce
    .number()
    .int("每页数量必须是整数")
    .min(1, "每页数量最小为1")
    .max(100, "每页数量最大为100")
    .default(20),
}

// 用户相关验证模式
export const userSchemas = {
  // 用户登录
  login: z.object({
    username: commonValidation.username,
    password: z.string().min(1, "密码不能为空"),
    remember: z.boolean().optional(),
  }),

  // 用户注册
  register: z.object({
    username: commonValidation.username,
    email: commonValidation.email,
    password: commonValidation.password,
    confirmPassword: z.string(),
    companyName: commonValidation.companyName.optional(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: "密码确认不匹配",
    path: ["confirmPassword"],
  }),

  // 用户信息更新
  updateProfile: z.object({
    displayName: z.string().max(100, "显示名称最多100个字符").optional(),
    email: commonValidation.email.optional(),
    avatarUrl: commonValidation.url.optional(),
  }),

  // 密码重置
  resetPassword: z.object({
    email: commonValidation.email,
  }),

  // 密码更改
  changePassword: z.object({
    currentPassword: z.string().min(1, "当前密码不能为空"),
    newPassword: commonValidation.password,
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "新密码确认不匹配",
    path: ["confirmPassword"],
  }),
}

// AI智能体相关验证模式
export const agentSchemas = {
  // 创建智能体
  create: z.object({
    name: z.string().min(1, "智能体名称不能为空").max(100, "智能体名称最多100个字符"),
    description: commonValidation.description,
    platform: z.enum(["dify", "openai", "custom"], {
      errorMap: () => ({ message: "平台类型无效" }),
    }),
    apiUrl: commonValidation.url,
    apiKey: commonValidation.apiKey,
    avatarUrl: commonValidation.url.optional(),
    modelConfig: z.record(z.any()).optional(),
  }),

  // 更新智能体
  update: z.object({
    name: z.string().min(1, "智能体名称不能为空").max(100, "智能体名称最多100个字符").optional(),
    description: commonValidation.description,
    apiUrl: commonValidation.url.optional(),
    apiKey: commonValidation.apiKey.optional(),
    avatarUrl: commonValidation.url.optional(),
    modelConfig: z.record(z.any()).optional(),
    isActive: z.boolean().optional(),
  }),
}

// 聊天相关验证模式
export const chatSchemas = {
  // 发送消息
  sendMessage: z.object({
    message: z.string().min(1, "消息不能为空").max(10000, "消息最多10000个字符"),
    agentId: commonValidation.uuid,
    sessionId: commonValidation.uuid,
    files: z.array(z.object({
      type: z.enum(["image"]),
      url: commonValidation.url.optional(),
      uploadFileId: z.string().optional(),
    })).optional(),
  }),

  // 创建会话
  createSession: z.object({
    agentId: commonValidation.uuid,
    title: z.string().max(200, "会话标题最多200个字符").optional(),
  }),

  // 更新会话
  updateSession: z.object({
    title: z.string().max(200, "会话标题最多200个字符").optional(),
  }),
}

// 企业相关验证模式
export const companySchemas = {
  // 更新企业信息
  update: z.object({
    name: commonValidation.companyName.optional(),
    description: commonValidation.description,
    logoUrl: commonValidation.url.optional(),
  }),
}

// 文件上传验证模式
export const fileSchemas = {
  upload: z.object({
    file: z.any(), // 文件对象在运行时验证
    type: z.enum(["avatar", "logo", "chat"]).optional(),
  }),
}

// 输入清理函数
export function sanitizeInput(input: string): string {
  // 移除HTML标签和潜在的XSS攻击代码
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: [] 
  }).trim()
}

// 清理对象中的所有字符串字段
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj }
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeInput(value)
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === "string" ? sanitizeInput(item) : 
        typeof item === "object" && item !== null ? sanitizeObject(item) : 
        item
      )
    }
  }
  
  return sanitized
}

// 验证并清理输入的通用函数
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  sanitize: boolean = true
): T {
  try {
    // 首先进行基本验证
    const parsed = schema.parse(data)
    
    // 如果需要清理，对字符串字段进行清理
    if (sanitize && typeof parsed === "object" && parsed !== null) {
      return sanitizeObject(parsed as Record<string, any>) as T
    }
    
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(
        (err) => `${err.path.join(".")}: ${err.message}`
      )
      throw new ValidationError(
        `输入验证失败: ${errorMessages.join(", ")}`,
        { zodErrors: error.errors }
      )
    }
    throw error
  }
}

// 文件验证函数
export function validateFile(
  file: File,
  allowedTypes: string[],
  maxSize: number
): void {
  // 检查文件类型
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `不支持的文件类型: ${file.type}`,
      { allowedTypes, fileType: file.type }
    )
  }

  // 检查文件大小
  if (file.size > maxSize) {
    throw new ValidationError(
      `文件大小超过限制: ${file.size} bytes`,
      { maxSize, fileSize: file.size }
    )
  }

  // 检查文件名
  if (file.name.length > 255) {
    throw new ValidationError("文件名过长")
  }

  // 检查文件名中的危险字符
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/
  if (dangerousChars.test(file.name)) {
    throw new ValidationError("文件名包含非法字符")
  }
}
