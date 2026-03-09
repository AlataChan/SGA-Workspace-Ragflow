import { NextRequest } from "next/server"
import { UserRole } from "@prisma/client"
import prisma from "@/lib/prisma"
import { extractTokenFromHeader, verifyToken } from "./jwt"
import { validateAuthSessionForJwtPayload } from "./auth-session"

export interface AuthUser {
  id: string
  userId: string  // 别名，与 id 相同
  username: string
  companyId: string
  role: string
  departmentId?: string | null
}

export async function verifyUserAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    // 从Cookie或Authorization头获取token
    const cookieToken = request.cookies.get('auth-token')?.value
    const headerToken = extractTokenFromHeader(request.headers.get('authorization'))
    
    const token = cookieToken || headerToken
    
    if (!token) {
      return null
    }

    const payload = verifyToken(token)
    if (!payload || !payload.sessionId) {
      return null
    }

    const session = await validateAuthSessionForJwtPayload({
      sessionId: payload.sessionId,
      userId: payload.userId,
      companyId: payload.companyId,
    })

    if (!session) {
      return null
    }

    // 从数据库获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        companyId: true,
        role: true,
        isActive: true,
        departmentId: true,
        department: {
          select: {
            isActive: true
          }
        }
      }
    })

    if (!user || !user.isActive) {
      return null
    }

    if (user.companyId !== payload.companyId) {
      return null
    }

    if (
      user.role !== UserRole.ADMIN
      && user.departmentId
      && user.department
      && !user.department.isActive
    ) {
      return null
    }

    return {
      id: user.id,
      userId: user.id,  // 别名
      username: user.username,
      companyId: user.companyId,
      role: user.role,
      departmentId: user.departmentId ?? null,
    }

  } catch (error) {
    console.error('用户认证失败:', error)
    return null
  }
}
