import { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { extractTokenFromHeader, verifyToken } from "./jwt"
import { validateAuthSessionForJwtPayload } from "./auth-session"

export interface AdminUser {
  id: string
  userId: string // 别名，与 id 相同
  username: string
  companyId: string
  role: string
}

export async function verifyAdminAuth(request: NextRequest): Promise<AdminUser | null> {
  try {
    const cookieToken = request.cookies.get("auth-token")?.value
    const headerToken = extractTokenFromHeader(request.headers.get("authorization"))
    const token = cookieToken || headerToken

    if (!token) return null

    const payload = verifyToken(token)
    if (!payload || !payload.sessionId) return null

    const session = await validateAuthSessionForJwtPayload({
      sessionId: payload.sessionId,
      userId: payload.userId,
      companyId: payload.companyId,
    })

    if (!session) return null

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        companyId: true,
        role: true,
        isActive: true,
      },
    })

    if (!user || !user.isActive || user.role !== UserRole.ADMIN) return null
    if (user.companyId !== payload.companyId) return null

    return {
      id: user.id,
      userId: user.id,
      username: user.username,
      companyId: user.companyId,
      role: user.role,
    }
  } catch (error) {
    console.error("管理员认证失败:", error)
    return null
  }
}

