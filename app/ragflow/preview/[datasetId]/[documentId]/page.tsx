import Link from "next/link"

function parsePage(value: unknown): number | null {
  if (typeof value !== "string") return null
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export default async function RAGFlowDocumentPreviewPage({
  params,
  searchParams,
}: {
  params: { datasetId: string; documentId: string }
  searchParams: Record<string, string | string[] | undefined>
}) {
  const { datasetId, documentId } = params
  const sp = searchParams

  const page = parsePage(Array.isArray(sp.page) ? sp.page[0] : sp.page)
  const title = typeof sp.title === "string" ? sp.title : undefined

  const fileUrl = `/api/ragflow/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(
    documentId
  )}?inline=1`
  const iframeSrc = `${fileUrl}${page ? `#page=${page}` : ""}`
  const downloadUrl = `/api/ragflow/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(
    documentId
  )}?download=1`

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {title || "文档预览"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            dataset: {datasetId} · document: {documentId}
            {page ? ` · page: ${page}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 text-sm">
          <Link
            href={downloadUrl}
            className="underline underline-offset-4 hover:text-foreground/80"
          >
            下载
          </Link>
          <Link
            href="/"
            className="underline underline-offset-4 hover:text-foreground/80"
          >
            返回
          </Link>
        </div>
      </div>

      <div className="flex-1">
        <iframe
          title={title || "RAGFlow Document"}
          src={iframeSrc}
          className="w-full h-full"
        />
      </div>
    </div>
  )
}
