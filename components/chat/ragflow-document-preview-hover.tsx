"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface RAGFlowChunkForPreview {
  document_id: string
  document_name: string
  dataset_id: string
  positions?: number[][]
}

function inferPdfPage(positions?: number[][]): number | null {
  const first = positions?.[0]?.[0]
  if (typeof first !== "number" || !Number.isFinite(first)) return null
  if (first <= 0) return null
  return Math.floor(first)
}

export default function RAGFlowDocumentPreviewHover({
  chunk,
  className,
  label = "引用",
}: {
  chunk: RAGFlowChunkForPreview
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)

  const page = useMemo(() => inferPdfPage(chunk.positions), [chunk.positions])
  const previewPageUrl = useMemo(() => {
    const base = `/ragflow/preview/${encodeURIComponent(chunk.dataset_id)}/${encodeURIComponent(chunk.document_id)}`
    const url = new URL(base, "http://localhost")
    if (page) url.searchParams.set("page", String(page))
    if (chunk.document_name) url.searchParams.set("title", chunk.document_name)
    return url.pathname + url.search
  }, [chunk.dataset_id, chunk.document_id, chunk.document_name, page])

  const inlineFileUrl = useMemo(() => {
    const base = `/api/ragflow/datasets/${encodeURIComponent(chunk.dataset_id)}/documents/${encodeURIComponent(
      chunk.document_id
    )}?inline=1`
    return `${base}${page ? `#page=${page}` : ""}`
  }, [chunk.dataset_id, chunk.document_id, page])

  return (
    <HoverCard openDelay={200} closeDelay={100} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <span className={cn("inline-flex", className)}>
          <Badge
            variant="secondary"
            className="cursor-pointer select-none text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200"
          >
            {label}
          </Badge>
        </span>
      </HoverCardTrigger>

      <HoverCardContent className="w-[420px] max-w-[90vw] p-0 overflow-hidden" side="top" align="start">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {chunk.document_name || "文档预览"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {page ? `page ${page}` : "PDF"}
            </div>
          </div>
          <Link
            href={previewPageUrl}
            target="_blank"
            className="text-xs underline underline-offset-4 hover:text-foreground/80 flex-shrink-0"
          >
            打开
          </Link>
        </div>

        <div className="relative h-[240px] bg-muted">
          {open ? (
            <iframe
              title={chunk.document_name || "PDF Preview"}
              src={inlineFileUrl}
              className="w-full h-full"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          <Link
            href={previewPageUrl}
            target="_blank"
            className="absolute inset-0"
            aria-label="Open full preview"
          />
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

