/**
 * 密码处理工具
 */

import bcrypt from 'bcryptjs'

const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 50

/**
 * 加密密码
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10
  return bcrypt.hash(password, saltRounds)
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

/**
 * 生成随机密码
 */
export function generateRandomPassword(length: number = 12): string {
  if (length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password length must be at least ${MIN_PASSWORD_LENGTH}`)
  }

  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const symbols = '!@#$%^&*()-_=+[]{}|;:,.<>?/~'
  const all = upper + lower + digits + symbols

  const chars: string[] = [
    pick(upper),
    pick(lower),
    pick(digits),
    pick(symbols),
  ]

  for (let i = chars.length; i < length; i++) {
    chars.push(pick(all))
  }

  // Fisher–Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}

/**
 * 验证密码强度
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`密码长度至少${MIN_PASSWORD_LENGTH}位`)
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`密码长度不能超过${MAX_PASSWORD_LENGTH}位`)
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含数字')
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('密码必须包含符号')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

function pick(charset: string): string {
  return charset[randomInt(charset.length)]
}

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0

  const cryptoObj = globalThis.crypto
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== 'function') {
    // Fallback for unexpected environments; prefer failing closed in prod callers.
    return Math.floor(Math.random() * maxExclusive)
  }

  // Rejection sampling to avoid modulo bias.
  const maxUint32 = 0xffffffff
  const limit = maxUint32 - (maxUint32 % maxExclusive)
  const buf = new Uint32Array(1)
  while (true) {
    cryptoObj.getRandomValues(buf)
    const n = buf[0]
    if (n < limit) return n % maxExclusive
  }
}
