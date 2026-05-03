import { beforeEach, describe, expect, it, vi } from "vitest"

describe("token encryption config", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    delete process.env.TOKEN_ENCRYPTION_KEY
  })

  it("throws when TOKEN_ENCRYPTION_KEY is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { encrypt } = await import("@/lib/utils/encryption")
    expect(() => encrypt("secret")).toThrow("TOKEN_ENCRYPTION_KEY 未配置")
  })

  it("round-trips tokens when TOKEN_ENCRYPTION_KEY is configured", async () => {
    process.env.TOKEN_ENCRYPTION_KEY = "12345678901234567890123456789012"

    const { encrypt, decrypt } = await import("@/lib/utils/encryption")
    const encrypted = encrypt("secret")

    expect(decrypt(encrypted)).toBe("secret")
  })
})
