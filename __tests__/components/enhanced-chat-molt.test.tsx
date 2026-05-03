import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import EnhancedChatWithSidebar from "@/app/components/enhanced-chat-with-sidebar"

const { chatStreamingMock, listConversationsMock, getConversationMessagesMock } = vi.hoisted(() => ({
  chatStreamingMock: vi.fn(),
  listConversationsMock: vi.fn(),
  getConversationMessagesMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/components/temp-kb/temp-kb-dialog", () => ({
  default: () => null,
}))

vi.mock("@/components/chat/save-knowledge-button", () => ({
  default: () => null,
}))

vi.mock("@/components/chat/knowledge-graph-actions", () => ({
  default: () => null,
}))

vi.mock("@/lib/molt/browser-client", () => ({
  MoltBrowserClient: vi.fn().mockImplementation(() => ({
    chatStreaming: chatStreamingMock,
    listConversations: listConversationsMock,
    getConversationMessages: getConversationMessagesMock,
  })),
}))

async function* streamEvents() {
  yield { event: "conversation_created", data: { conversation_id: "conv-1", message_id: "msg-1" } }
  yield { event: "message", data: { content: "molt says hi" } }
  yield { event: "message_end", data: { message_id: "msg-1", conversation_id: "conv-1" } }
  yield { event: "done", data: "[DONE]" }
}

describe("EnhancedChatWithSidebar Molt transport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listConversationsMock.mockResolvedValue({
      data: [{ id: "conv-history", title: "Molt history", createdAt: 1730000000 }],
      total: 1,
      limit: 20,
      offset: 0,
    })
    getConversationMessagesMock.mockResolvedValue({
      data: [{ id: "msg-history", role: "assistant", content: "old molt answer", created_at: 1730000001 }],
      total: 1,
    })
    chatStreamingMock.mockImplementation(() => streamEvents())
  })

  it("sends chat through MoltBrowserClient for Molt-backed agents", async () => {
    render(
      <EnhancedChatWithSidebar
        agentName="智能体"
        onBack={() => {}}
        agentConfig={{
          platform: "MOLT" as any,
          localAgentId: "agent-a",
          userId: "user-1",
          moltRuntime: { id: "agent-a", status: "online" },
        } as any}
      />,
    )

    const textarea = screen.getByPlaceholderText("向智能体发送消息...")
    fireEvent.change(textarea, { target: { value: "hello" } })
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" })

    await waitFor(() => {
      expect(chatStreamingMock).toHaveBeenCalledWith(
        "agent-a",
        expect.objectContaining({
          message: "hello",
          routing_mode: "matrix",
        }),
        expect.objectContaining({ idempotencyKey: expect.any(String) }),
      )
    })
    expect(await screen.findByText("molt says hi")).toBeInTheDocument()
  })

  it("loads Molt conversation history through MoltBrowserClient", async () => {
    render(
      <EnhancedChatWithSidebar
        agentName="智能体"
        onBack={() => {}}
        agentConfig={{
          platform: "MOLT" as any,
          localAgentId: "agent-a",
          userId: "user-1",
          moltRuntime: { id: "agent-a", status: "online" },
        } as any}
      />,
    )

    expect(await screen.findByText("Molt history")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Molt history"))

    await waitFor(() => {
      expect(getConversationMessagesMock).toHaveBeenCalledWith(
        "agent-a",
        "conv-history",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })
    expect(await screen.findByText("old molt answer")).toBeInTheDocument()
  })

  it("aborts Molt streaming when generation is stopped", async () => {
    let capturedSignal: AbortSignal | undefined
    chatStreamingMock.mockImplementation(async function* (_agentId, _request, options) {
      capturedSignal = options?.signal
      yield { event: "message", data: { content: "partial molt answer" } }
      if (!capturedSignal) return
      await new Promise<void>((resolve) => {
        capturedSignal!.addEventListener("abort", () => resolve(), { once: true })
      })
    })

    render(
      <EnhancedChatWithSidebar
        agentName="智能体"
        onBack={() => {}}
        agentConfig={{
          platform: "MOLT" as any,
          localAgentId: "agent-a",
          userId: "user-1",
          moltRuntime: { id: "agent-a", status: "online" },
        } as any}
      />,
    )

    const textarea = screen.getByPlaceholderText("向智能体发送消息...")
    fireEvent.change(textarea, { target: { value: "hello" } })
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" })

    expect(await screen.findByText("partial molt answer")).toBeInTheDocument()
    expect(capturedSignal).toBeInstanceOf(AbortSignal)

    fireEvent.click(screen.getByTitle("停止生成"))

    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true)
    })
  })
})
