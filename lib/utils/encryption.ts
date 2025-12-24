/**
 * Token 加密工具
 * 用于 SSO accessToken 和 refreshToken 的加密存储
 */

import crypto from 'crypto'

// 加密算法配置
const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // AES block size

// 从环境变量获取加密密钥，如果没有则使用默认值（仅开发环境）
const getEncryptionKey = (): Buffer => {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  
  if (!key) {
    console.warn('⚠️  TOKEN_ENCRYPTION_KEY 未设置，使用默认密钥（仅供开发）')
    // 开发环境默认密钥（32字节）
    return Buffer.from('dev-encryption-key-32-bytes!!')
  }
  
  // 确保密钥长度为 32 字节
  if (key.length !== 32 && key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY 必须是 32 字节（或 64 个十六进制字符）')
  }
  
  // 如果是十六进制字符串，转换为 Buffer
  if (key.length === 64) {
    return Buffer.from(key, 'hex')
  }
  
  return Buffer.from(key)
}

/**
 * 加密文本
 * @param text 要加密的文本
 * @returns 加密后的文本（格式：iv:encryptedData）
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey()
    
    // 生成随机初始化向量
    const iv = crypto.randomBytes(IV_LENGTH)
    
    // 创建加密器
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    // 加密数据
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // 返回格式：iv:encryptedData
    return `${iv.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('加密失败:', error)
    throw new Error('Token 加密失败')
  }
}

/**
 * 解密文本
 * @param encryptedText 加密的文本（格式：iv:encryptedData）
 * @returns 解密后的原始文本
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey()
    
    // 分离 IV 和加密数据
    const parts = encryptedText.split(':')
    if (parts.length !== 2) {
      throw new Error('加密数据格式错误')
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const encryptedData = parts[1]
    
    // 创建解密器
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    
    // 解密数据
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('解密失败:', error)
    throw new Error('Token 解密失败')
  }
}

/**
 * 生成随机加密密钥（用于初始化配置）
 * @returns 32字节的十六进制密钥
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * 验证加密/解密是否正常工作
 * @returns 是否正常工作
 */
export function testEncryption(): boolean {
  try {
    const testText = 'test-encryption-' + Date.now()
    const encrypted = encrypt(testText)
    const decrypted = decrypt(encrypted)
    return testText === decrypted
  } catch (error) {
    console.error('加密测试失败:', error)
    return false
  }
}




