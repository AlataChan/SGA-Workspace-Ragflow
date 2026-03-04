import { stripRagflowInlineReferenceMarkers } from './ragflow-utils'

/**
 * 合并 RAGFlow 流式文本。
 *
 * RAGFlow 的 SSE 流在不同接口/版本下可能返回：
 * - 增量片段（delta）
 * - 累计全文（full text so far）
 * - 期间插入/调整引用标记（inline references）
 *
 * 该函数尽量在以上场景下都避免：
 * - 只保留最后一段（覆盖导致）
 * - 内容翻倍（错误拼接导致）
 */
export function mergeRagflowStreamingText(current: string, incoming: string): string {
  if (!incoming) return current
  if (!current) return incoming
  if (incoming.startsWith(current)) return incoming
  if (current.startsWith(incoming)) return current

  const compact = (value: string) => value.replace(/\\s+/g, '')
  const canonical = (value: string) => compact(stripRagflowInlineReferenceMarkers(value))

  const canonCurrent = canonical(current)
  const canonIncoming = canonical(incoming)

  // 有些 RAGFlow 会在流式过程中插入/调整引用标记/空白，导致“看起来不像前缀”，这里用 canonical 做判定
  if (canonIncoming.startsWith(canonCurrent)) return incoming
  if (canonCurrent.startsWith(canonIncoming)) return current
  if (canonIncoming.includes(canonCurrent) && canonIncoming.length >= canonCurrent.length) return incoming

  // 兼容“累计全文但中段轻微改动”（标点/换行等），避免误判为增量而导致全文拼接翻倍
  if (canonCurrent.length > 0 && canonIncoming.length > 0) {
    const minLen = Math.min(canonCurrent.length, canonIncoming.length)
    let commonPrefix = 0
    for (let i = 0; i < minLen; i++) {
      if (canonCurrent[i] !== canonIncoming[i]) break
      commonPrefix++
    }
    const ratio = commonPrefix / minLen
    if (ratio >= 0.85) {
      return incoming.length >= current.length ? incoming : current
    }
  }

  // 尝试在末尾做重叠探测（限制 probe 长度，避免 O(n^2)）
  const maxProbe = Math.min(200, current.length, incoming.length)
  for (let overlap = maxProbe; overlap >= 20; overlap--) {
    if (current.endsWith(incoming.slice(0, overlap))) {
      return current + incoming.slice(overlap)
    }
  }

  return current + incoming
}

