import { NextRequest } from "next/server"
import { PrismaClient } from "@prisma/client"
import jwt from "jsonwebtoken"

const prisma = new PrismaClient()

export interface AdminUser {
  id: string
  userId: string  // 别名，与 id 相同
  username: string
  companyId: string
  role: string
}

export async function verifyAdminAuth(request: NextRequest): Promise<AdminUser | null> {
  try {
    // 从Cookie或Authorization头获取token
    const cookieToken = request.cookies.get('auth-token')?.value
    const authHeader = request.headers.get('authorization')
    const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
    
    const token = cookieToken || headerToken
    
    if (!token) {
      return null
    }

    // 验证JWT token
    let decoded: any
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    } catch (error) {
      console.error('JWT验证失败:', error)
      return null
    }

    // 从数据库获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        companyId: true,
        role: true,
        isActive: true
      }
    })

    if (!user || !user.isActive || user.role !== 'ADMIN') {
      return null
    }

    return {
      id: user.id,
      userId: user.id,  // 别名
      username: user.username,
      companyId: user.companyId,
      role: user.role
    }

  } catch (error) {
    console.error('管理员认证失败:', error)
    return null
  }
}
