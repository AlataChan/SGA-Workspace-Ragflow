import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

// 获取知识图谱列表（普通用户版本）
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    let knowledgeGraphs

    // 管理员可以看到所有活跃的知识图谱
    if (user.role === 'admin') {
      knowledgeGraphs = await prisma.knowledgeGraph.findMany({
        where: {
          companyId: user.companyId,
          isActive: true
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'desc' }
        ],
        select: {
          id: true,
          name: true,
          description: true,
          nodeCount: true,
          edgeCount: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true
        }
      })
    } else {
      // 普通用户只能看到被分配给他们的知识图谱
      const userPermissions = await prisma.userKnowledgeGraphPermission.findMany({
        where: {
          userId: user.userId,
        },
        include: {
          knowledgeGraph: {
            select: {
              id: true,
              name: true,
              description: true,
              nodeCount: true,
              edgeCount: true,
              isActive: true,
              sortOrder: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      })

      // 只返回活跃的知识图谱
      knowledgeGraphs = userPermissions
        .filter(permission => permission.knowledgeGraph.isActive)
        .map(permission => permission.knowledgeGraph)
        .sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) {
            return a.sortOrder - b.sortOrder
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
    }

    return NextResponse.json({
      success: true,
      data: knowledgeGraphs
    })

  } catch (error) {
    console.error('获取知识图谱列表失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}
