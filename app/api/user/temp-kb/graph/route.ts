/**
 * Compatibility API: /api/user/temp-kb/graph
 * The implementation was consolidated under /api/temp-kb/graph.
 */

import { NextRequest } from 'next/server'
import { GET as getGraph, POST as postGraph } from '@/app/api/temp-kb/graph/route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return getGraph(request)
}

export async function POST(request: NextRequest) {
  return postGraph(request)
}

