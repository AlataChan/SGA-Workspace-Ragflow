import { NextRequest, NextResponse } from "next/server"
import { verifyUserAuth } from "@/lib/auth/user"
import prisma from "@/lib/prisma"
import { getEffectiveKnowledgeGraphIdsForUser } from "@/lib/auth/knowledge-graph-access"

export const dynamic = 'force-dynamic'

// 获取知识图谱列表（普通用户版本）
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    let knowledgeGraphs

    // 管理员可以看到所有活跃的知识图谱
    if (user.role === 'ADMIN') {
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
      const { knowledgeGraphIds } = await getEffectiveKnowledgeGraphIdsForUser(user as any)

      knowledgeGraphs = knowledgeGraphIds.length > 0
        ? await prisma.knowledgeGraph.findMany({
            where: {
              companyId: user.companyId,
              id: { in: knowledgeGraphIds },
              isActive: true,
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
        : []
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
