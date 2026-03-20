import { describe, expect, it } from "vitest"

import { generateRandomPassword, validatePasswordStrength } from "@/lib/auth/password"

describe("validatePasswordStrength", () => {
  it("accepts passwords with upper/lower/digit/symbol and length >= 8", () => {
    const result = validatePasswordStrength("Abc1d2e3!")
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePasswordStrength("Aa1!aaa")
    expect(result.isValid).toBe(false)
    expect(result.errors.join(",")).toMatch(/至少8位/)
  })

  it("rejects passwords without uppercase letters", () => {
    const result = validatePasswordStrength("abcd1234!")
    expect(result.isValid).toBe(false)
    expect(result.errors.join(",")).toMatch(/大写/)
  })

  it("rejects passwords without lowercase letters", () => {
    const result = validatePasswordStrength("ABCD1234!")
    expect(result.isValid).toBe(false)
    expect(result.errors.join(",")).toMatch(/小写/)
  })

  it("rejects passwords without digits", () => {
    const result = validatePasswordStrength("Abcdefg!")
    expect(result.isValid).toBe(false)
    expect(result.errors.join(",")).toMatch(/数字/)
  })

  it("rejects passwords without symbols", () => {
    const result = validatePasswordStrength("Abcd1234")
    expect(result.isValid).toBe(false)
    expect(result.errors.join(",")).toMatch(/符号/)
  })

  it("rejects passwords with 4+ consecutive ascending characters", () => {
    expect(validatePasswordStrength("Abcd1234!").isValid).toBe(false)
    expect(validatePasswordStrength("A1234bcd!").isValid).toBe(false)
    expect(validatePasswordStrength("Abcdefg1!").isValid).toBe(false)
    expect(validatePasswordStrength("ABCD1234!").isValid).toBe(false)
  })

  it("rejects passwords with 4+ consecutive descending characters", () => {
    expect(validatePasswordStrength("Abcd4321!").isValid).toBe(false)
    expect(validatePasswordStrength("Adcba123!").isValid).toBe(false)
    expect(validatePasswordStrength("DCBA1234!").isValid).toBe(false)
  })

  it("accepts passwords without 4+ consecutive sequences", () => {
    const result = validatePasswordStrength("Abc1d2e3!")
    expect(result.isValid).toBe(true)
  })

  it("rejects passwords containing username (case insensitive)", () => {
    const result = validatePasswordStrength("Alice1234!", { username: "alice" })
    expect(result.isValid).toBe(false)
    expect(result.errors.join(",")).toMatch(/账号名/)
  })

  it("accepts passwords without username when username provided", () => {
    const result = validatePasswordStrength("Abc1d2e3!", { username: "bob" })
    expect(result.isValid).toBe(true)
  })
})

describe("generateRandomPassword", () => {
  it("generates a password that passes validatePasswordStrength by default", () => {
    const password = generateRandomPassword()
    const result = validatePasswordStrength(password)
    expect(result.isValid).toBe(true)
  })
})

