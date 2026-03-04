import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import KnowledgeGraphActions from "@/components/chat/knowledge-graph-actions"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/components/temp-kb/knowledge-graph-view", () => ({
  default: () => null,
}))

vi.mock("@/components/temp-kb/temp-kb-panel", () => ({
  default: () => null,
}))

describe("KnowledgeGraphActions", () => {
  beforeEach(() => {
    vi.useFakeTimers()

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)

        if (url === "/api/temp-kb/chunks") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { chunkId: "c1" } }),
          } as any
        }

        if (url === "/api/temp-kb/graph") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          } as any
        }

        if (url === "/api/temp-kb/graph/status") {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { status: "building" } }),
          } as any
        }

        throw new Error(`Unexpected fetch: ${url} ${JSON.stringify(init)}`)
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("POST /api/temp-kb/graph includes agentId when generating graph", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <KnowledgeGraphActions
        content="hello"
        sourceMessageId="m1"
        agentId="a1"
        disabled={false}
      />,
    )

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "生成图谱" }))
      await Promise.resolve()
    })

    const graphCall = (fetch as any).mock.calls.find((call: any[]) => call[0] === "/api/temp-kb/graph")
    expect(graphCall).toBeTruthy()
    const init = graphCall[1] as RequestInit
    expect(init.method).toBe("POST")
    expect(JSON.parse(String(init.body))).toEqual({ agentId: "a1" })
  })
})

