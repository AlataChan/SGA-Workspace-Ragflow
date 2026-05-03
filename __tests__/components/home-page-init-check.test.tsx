import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"
import HomePage from "@/app/page"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

describe("HomePage bootstrap flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("checks system state through init-check instead of test db endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        isInitialized: true,
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<HomePage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/system/init-check", { cache: "no-store" })
    })
    expect(fetchMock).not.toHaveBeenCalledWith("/api/test/db", expect.anything())

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/auth/login")
    }, { timeout: 2000 })
  })
})
