/**
 * Compatibility API: /api/user/temp-kb
 * The implementation was consolidated under /api/temp-kb.
 *
 * GET/POST/DELETE /api/user/temp-kb
 */

import { NextRequest } from 'next/server'
import { GET as getTempKb, POST as postTempKb, DELETE as deleteTempKb } from '@/app/api/temp-kb/route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return getTempKb(request)
}

export async function POST(request: NextRequest) {
  return postTempKb(request)
}

export async function DELETE(request: NextRequest) {
  return deleteTempKb(request)
}

