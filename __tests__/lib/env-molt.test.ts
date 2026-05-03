import { describe, expect, it, vi } from "vitest"

const baseEnv = {
  NODE_ENV: "production",
  CSRF_SECRET: "c".repeat(32),
  JWT_SECRET: "j".repeat(32),
  ENCRYPTION_KEY: "e".repeat(32),
  DEFAULT_ADMIN_EMAIL: "admin@example.com",
  DEFAULT_ADMIN_PASSWORD: "change-this-password",
}

async function loadEnvModule(extraEnv: Record<string, string | undefined> = {}) {
  vi.resetModules()
  process.env = {
    ...process.env,
    ...baseEnv,
    ...extraEnv,
  }
  return await import("../../lib/config/env")
}

describe("Molt env validation", () => {
  it("defaults Molt proxy flags off and parses empty allowlists", async () => {
    const { validateEnvInput } = await loadEnvModule()

    const result = validateEnvInput(baseEnv)

    expect(result.success).toBe(true)
    expect(result.data?.MOLT_PROXY_ENABLED_CHAT).toBe(false)
    expect(result.data?.MOLT_PROXY_ENABLED_UPLOAD).toBe(false)
    expect(result.data?.MOLT_PROXY_ENABLED_HISTORY).toBe(false)
    expect(result.data?.MOLT_PROXY_TENANT_ALLOWLIST).toEqual([])
    expect(result.data?.MOLT_PROXY_AGENT_ALLOWLIST).toEqual([])
    expect(result.data?.MOLT_LEGACY_ETL_TENANTS).toEqual([])
    expect(result.data?.MOLT_REQUEST_TIMEOUT_MS).toBe(120000)
    expect(result.data?.MOLT_STREAM_HEARTBEAT_MS).toBe(15000)
  })

  it("requires Molt credentials in production when chat proxy is enabled", async () => {
    const { validateEnvInput } = await loadEnvModule()

    const result = validateEnvInput({
      ...baseEnv,
      MOLT_PROXY_ENABLED_CHAT: "true",
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain("MOLT_API_BASE_URL")
    expect(result.error).toContain("MOLT_SERVICE_API_KEY")
    expect(result.error).toContain("MOLT_DELEGATION_SECRET")
  })

  it("accepts enabled production proxy with required Molt settings", async () => {
    const { validateEnvInput } = await loadEnvModule({
      MOLT_API_BASE_URL: "https://molt.example.com/",
      MOLT_SERVICE_API_KEY: "sk-molt-test",
      MOLT_DELEGATION_SECRET: "m".repeat(32),
      MOLT_PROXY_ENABLED_CHAT: "true",
      MOLT_PROXY_TENANT_ALLOWLIST: " company-1, company-2 ,,company-1 ",
      MOLT_PROXY_AGENT_ALLOWLIST: "agent-a,agent-b",
      MOLT_LEGACY_ETL_TENANTS: "company-legacy",
      MOLT_REQUEST_TIMEOUT_MS: "90000",
      MOLT_STREAM_HEARTBEAT_MS: "5000",
    })

    const result = validateEnvInput(process.env)

    expect(result.success).toBe(true)
    expect(result.data?.MOLT_API_BASE_URL).toBe("https://molt.example.com")
    expect(result.data?.MOLT_PROXY_ENABLED_CHAT).toBe(true)
    expect(result.data?.MOLT_PROXY_TENANT_ALLOWLIST).toEqual(["company-1", "company-2"])
    expect(result.data?.MOLT_PROXY_AGENT_ALLOWLIST).toEqual(["agent-a", "agent-b"])
    expect(result.data?.MOLT_LEGACY_ETL_TENANTS).toEqual(["company-legacy"])
    expect(result.data?.MOLT_REQUEST_TIMEOUT_MS).toBe(90000)
    expect(result.data?.MOLT_STREAM_HEARTBEAT_MS).toBe(5000)
  })
})
