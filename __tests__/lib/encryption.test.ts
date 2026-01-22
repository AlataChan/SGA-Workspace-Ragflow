// @vitest-environment node

import { describe, expect, it } from "vitest"
import { decryptTokenFromStorage, encryptTokenForStorage } from "@/lib/security/encryption"

describe("encryption helpers", () => {
  it("encryptTokenForStorage/decryptTokenFromStorage round-trip", () => {
    const originalKey = process.env.ENCRYPTION_KEY
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef"

    try {
      const token = "mdm-token-123"
      const stored = encryptTokenForStorage(token)
      expect(stored.startsWith("enc:")).toBe(true)
      expect(decryptTokenFromStorage(stored)).toBe(token)
    } finally {
      process.env.ENCRYPTION_KEY = originalKey
    }
  })

  it("decryptTokenFromStorage returns raw when not encrypted", () => {
    const token = "raw-token"
    expect(decryptTokenFromStorage(token)).toBe(token)
  })
})
