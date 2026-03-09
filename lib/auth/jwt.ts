/**
 * JWT 认证工具
 */

import jwt from 'jsonwebtoken'
import { UserRole } from '@prisma/client'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret) return secret

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production')
  }

  return 'dev-fallback-jwt-secret'
}

export interface JWTPayload {
  userId: string
  companyId: string
  role: UserRole
  sessionId: string
  iat?: number
  exp?: number
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!payload.sessionId) {
    throw new Error('JWTPayload.sessionId is required')
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '7d', // 7天过期
  })
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload
    return decoded
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * 从请求头中提取 Token
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null
  
  // 支持 "Bearer token" 格式
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // 直接返回 token
  return authHeader
}

/**
 * 刷新 Token（生成新的 Token）
 */
export function refreshToken(oldToken: string): string | null {
  const payload = verifyToken(oldToken)
  if (!payload) return null
  
  // 移除时间戳字段，生成新 token
  const { iat, exp, ...newPayload } = payload
  return generateToken(newPayload)
}
