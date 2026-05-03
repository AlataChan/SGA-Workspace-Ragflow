import { describe, expect, it } from "vitest"
import {
  resolveAllowedDifyImageUrl,
  shouldProxyDifyImageUrl,
} from "@/lib/utils/dify-file-url"

describe("dify file url helpers", () => {
  it("only marks dify file urls for proxying", () => {
    expect(shouldProxyDifyImageUrl("/files/image.png")).toBe(true)
    expect(shouldProxyDifyImageUrl("https://dify.example.com/files/image.png")).toBe(true)
    expect(shouldProxyDifyImageUrl("https://dify.example.com/files/tools/image.png")).toBe(true)
    expect(shouldProxyDifyImageUrl("https://example.com/uploads/image.png")).toBe(false)
    expect(shouldProxyDifyImageUrl("http://10.0.0.8/internal.png")).toBe(false)
  })

  it("resolves relative dify files against configured base url without duplicating /v1", () => {
    expect(
      resolveAllowedDifyImageUrl("/files/image.png", "https://dify.example.com/v1"),
    ).toBe("https://dify.example.com/files/image.png")
  })

  it("only allows absolute dify file urls on the configured origin", () => {
    expect(
      resolveAllowedDifyImageUrl(
        "https://dify.example.com/files/image.png",
        "https://dify.example.com/v1",
      ),
    ).toBe("https://dify.example.com/files/image.png")

    expect(
      resolveAllowedDifyImageUrl(
        "https://evil.example.com/files/image.png",
        "https://dify.example.com/v1",
      ),
    ).toBeNull()
  })
})
