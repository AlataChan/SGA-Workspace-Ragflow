/**
 * Compatibility API: /api/user/temp-kb/chunks
 * The implementation was consolidated under /api/temp-kb/chunks.
 */

import { NextRequest } from 'next/server'
import { GET as getChunks, POST as postChunk } from '@/app/api/temp-kb/chunks/route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return getChunks(request)
}

export async function POST(request: NextRequest) {
  return postChunk(request)
}

