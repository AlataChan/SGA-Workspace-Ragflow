import { format } from "date-fns"

export function formatChatTimestamp(value: unknown): string {
  if (value === null || value === undefined) return "刚刚"

  const numeric =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN

  if (!Number.isFinite(numeric)) return "刚刚"

  // Heuristic: seconds timestamps are typically 10 digits; millisecond timestamps are 13+ digits.
  const ms = numeric < 1e12 ? numeric * 1000 : numeric
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return "刚刚"

  return format(date, "yyyy-MM-dd HH:mm:ss")
}

