import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import ChangePasswordDialog from "@/components/user/change-password-dialog"

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
}))

describe("ChangePasswordDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("allows setting password without currentPassword", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<ChangePasswordDialog open={true} onOpenChange={vi.fn()} />)

    await act(async () => {
      await user.type(screen.getByLabelText("新密码"), "Abcd1234!")
      await user.type(screen.getByLabelText("确认新密码"), "Abcd1234!")
      await user.click(screen.getByRole("button", { name: "确认修改" }))
      await vi.runOnlyPendingTimersAsync()
    })

    expect(fetch).toHaveBeenCalledTimes(1)
    const [, init] = (fetch as any).mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body).toEqual({ newPassword: "Abcd1234!" })
  })
})
