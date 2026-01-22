import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 32) {
    throw new Error("ENCRYPTION_KEY 未配置或长度不为 32")
  }
  return Buffer.from(key, "utf8")
}

export function encryptString(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`
}

export function decryptString(payload: string): string {
  const key = getEncryptionKey()
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("密文格式不正确")
  }

  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const data = Buffer.from(dataB64, "base64")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()])
  return plaintext.toString("utf8")
}

export function encryptTokenForStorage(token: string): string {
  return `enc:${encryptString(token)}`
}

export function decryptTokenFromStorage(stored: string): string {
  if (stored.startsWith("enc:")) return decryptString(stored.slice("enc:".length))
  return stored
}
