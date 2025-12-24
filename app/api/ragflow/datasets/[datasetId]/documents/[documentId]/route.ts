import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { verifyUserAuth } from "@/lib/auth/user"

export const dynamic = 'force-dynamic'

function parseFilenameFromContentDisposition(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null
  const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
  if (!match) return null
  return match[1].replace(/['"]/g, "")
}

/**
 * Proxy a RAGFlow dataset document (typically PDF) for in-app preview.
 *
 * - Uses the caller's auth token (cookie/Authorization) to resolve tenant config.
 * - Finds the active KnowledgeGraph for this company with matching `kbId` (= datasetId).
 * - Supports `Range` requests to improve PDF viewing performance.
 * - Query:
 *   - `inline=1` -> `Content-Disposition: inline` (default)
 *   - `download=1` -> `Content-Disposition: attachment`
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { datasetId: string; documentId: string } }
) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { datasetId, documentId } = params
    if (!datasetId || !documentId) {
      return NextResponse.json({ error: "缺少 datasetId 或 documentId" }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const inlineParam = searchParams.get("inline")
    const downloadParam = searchParams.get("download")
    const inline = downloadParam === "1" ? false : inlineParam === "0" ? false : true

    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: {
        companyId: user.companyId,
        isActive: true,
        kbId: datasetId,
      },
      select: {
        ragflowUrl: true,
        apiKey: true,
        kbId: true,
      },
    })

    if (!knowledgeGraph) {
      return NextResponse.json(
        { error: "未找到对应的知识图谱配置（kbId/datasetId 不匹配或已禁用）" },
        { status: 404 }
      )
    }

    const baseUrl = knowledgeGraph.ragflowUrl.replace(/\/$/, "")
    const upstreamUrl = `${baseUrl}/api/v1/datasets/${knowledgeGraph.kbId}/documents/${documentId}`

    const upstreamHeaders: Record<string, string> = {
      Authorization: `Bearer ${knowledgeGraph.apiKey}`,
    }

    const range = request.headers.get("range")
    if (range) {
      upstreamHeaders.Range = range
    }

    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(60_000),
    })

    if (!upstream.ok) {
      const errorText = await upstream.text()
      return NextResponse.json(
        { error: `RAGFlow API错误: ${upstream.status} ${upstream.statusText}`, detail: errorText },
        { status: upstream.status }
      )
    }

    const filename =
      parseFilenameFromContentDisposition(upstream.headers.get("content-disposition")) ||
      `${documentId}.pdf`

    const headers = new Headers()
    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "etag",
      "last-modified",
    ] as const

    for (const key of passthrough) {
      const value = upstream.headers.get(key)
      if (value) headers.set(key, value)
    }

    headers.set("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${filename}"`)
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Cache-Control", "private, max-age=0, must-revalidate")

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    console.error("[RAGFlow Document Proxy] Error:", error)
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 })
  }
}
