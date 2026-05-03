import { beforeEach, describe, expect, it, vi } from "vitest"

const baseConfig = {
  MOLT_PROXY_ENABLED_CHAT: false,
  MOLT_PROXY_ENABLED_UPLOAD: false,
  MOLT_PROXY_ENABLED_HISTORY: false,
  MOLT_PROXY_TENANT_ALLOWLIST: [] as string[],
  MOLT_PROXY_AGENT_ALLOWLIST: [] as string[],
}

describe("Molt proxy flags", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...process.env,
      NODE_ENV: "test",
      CSRF_SECRET: "c".repeat(32),
      JWT_SECRET: "j".repeat(32),
      ENCRYPTION_KEY: "e".repeat(32),
      DEFAULT_ADMIN_EMAIL: "admin@example.com",
      DEFAULT_ADMIN_PASSWORD: "change-this-password",
    }
  })

  it("keeps every proxy disabled by default", async () => {
    const { isMoltProxyEnabled } = await import("@/lib/molt/flags")

    expect(
      isMoltProxyEnabled("chat", {
        companyId: "company-1",
        agentId: "agent-1",
        config: baseConfig,
      }),
    ).toBe(false)
  })

  it("requires matching route flag, tenant allowlist, and agent allowlist", async () => {
    const { isMoltProxyEnabled } = await import("@/lib/molt/flags")

    expect(
      isMoltProxyEnabled("chat", {
        companyId: "company-1",
        agentId: "agent-1",
        config: {
          ...baseConfig,
          MOLT_PROXY_ENABLED_CHAT: true,
          MOLT_PROXY_TENANT_ALLOWLIST: ["company-1"],
          MOLT_PROXY_AGENT_ALLOWLIST: ["agent-1"],
        },
      }),
    ).toBe(true)

    expect(
      isMoltProxyEnabled("chat", {
        companyId: "company-2",
        agentId: "agent-1",
        config: {
          ...baseConfig,
          MOLT_PROXY_ENABLED_CHAT: true,
          MOLT_PROXY_TENANT_ALLOWLIST: ["company-1"],
          MOLT_PROXY_AGENT_ALLOWLIST: ["agent-1"],
        },
      }),
    ).toBe(false)
  })

  it("does not treat empty allowlists as wildcard", async () => {
    const { isMoltProxyEnabled } = await import("@/lib/molt/flags")

    expect(
      isMoltProxyEnabled("upload", {
        companyId: "company-1",
        agentId: "agent-1",
        config: {
          ...baseConfig,
          MOLT_PROXY_ENABLED_UPLOAD: true,
        },
      }),
    ).toBe(false)
  })
})
