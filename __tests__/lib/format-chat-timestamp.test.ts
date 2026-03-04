import { describe, expect, it } from "vitest"
import { formatChatTimestamp } from "@/lib/utils/format-chat-timestamp"

describe("formatChatTimestamp", () => {
  it("formats millisecond timestamps as yyyy-MM-dd HH:mm:ss", () => {
    const ms = new Date("2026-03-09T21:00:07").getTime()
    expect(formatChatTimestamp(ms)).toBe("2026-03-09 21:00:07")
  })

  it("formats second timestamps as yyyy-MM-dd HH:mm:ss", () => {
    const ms = new Date("2026-03-09T21:00:07").getTime()
    expect(formatChatTimestamp(Math.floor(ms / 1000))).toBe("2026-03-09 21:00:07")
  })

  it("returns 刚刚 for invalid timestamps", () => {
    expect(formatChatTimestamp(undefined)).toBe("刚刚")
    expect(formatChatTimestamp(NaN)).toBe("刚刚")
  })
})

