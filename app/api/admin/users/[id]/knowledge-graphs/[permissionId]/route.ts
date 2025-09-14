import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { withAdminAuth } from "@/lib/auth/middleware"

const prisma = new PrismaClient()

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// DELETE /api/admin/users/[id]/knowledge-graphs/[permissionId] - 删除知识图谱权限
export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id
    const permissionId = context.params.permissionId

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: user.companyId,
      }
    })

    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        },
        { status: 404, headers: corsHeaders }
      )
    }

    // 检查权限是否存在
    const permission = await prisma.userKnowledgeGraphPermission.findFirst({
      where: {
        id: permissionId,
        userId: targetUserId,
      },
      include: {
        knowledgeGraph: {
          select: {
            id: true,
            name: true,
            companyId: true,
          }
        }
      }
    })

    if (!permission) {
      return NextResponse.json(
        {
          error: {
            code: 'PERMISSION_NOT_FOUND',
            message: '权限不存在'
          }
        },
        { status: 404, headers: corsHeaders }
      )
    }

    // 检查知识图谱是否属于同一公司
    if (permission.knowledgeGraph.companyId !== user.companyId) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: '无权限操作'
          }
        },
        { status: 403, headers: corsHeaders }
      )
    }

    // 删除权限
    await prisma.userKnowledgeGraphPermission.delete({
      where: {
        id: permissionId,
      }
    })

    return NextResponse.json({
      message: '知识图谱权限删除成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('删除知识图谱权限失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '删除知识图谱权限失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  })
}
