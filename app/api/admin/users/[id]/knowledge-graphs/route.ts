import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PrismaClient } from "@prisma/client"
import { withAdminAuth } from "@/lib/auth/middleware"

const prisma = new PrismaClient()

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// 添加知识图谱权限的验证模式
const addKnowledgeGraphPermissionSchema = z.object({
  knowledgeGraphId: z.string().min(1, "知识图谱ID不能为空"),
})

// GET /api/admin/users/[id]/knowledge-graphs - 获取用户的知识图谱权限
export const GET = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        companyId: user.companyId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        }
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

    // 获取用户的知识图谱权限
    const userKnowledgeGraphPermissions = await prisma.userKnowledgeGraphPermission.findMany({
      where: {
        userId: targetUserId,
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
            createdAt: true,
          }
        }
      }
    })

    // 获取所有可用的知识图谱（用于显示可添加的知识图谱）
    const allKnowledgeGraphs = await prisma.knowledgeGraph.findMany({
      where: {
        companyId: user.companyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        nodeCount: true,
        edgeCount: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // 过滤出用户还没有权限的知识图谱
    const userKnowledgeGraphIds = userKnowledgeGraphPermissions.map(p => p.knowledgeGraph.id)
    const availableKnowledgeGraphs = allKnowledgeGraphs.filter(kg => !userKnowledgeGraphIds.includes(kg.id))

    return NextResponse.json({
      data: {
        user: targetUser,
        permissions: userKnowledgeGraphPermissions,
        availableKnowledgeGraphs: availableKnowledgeGraphs
      }
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取用户知识图谱权限失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取用户知识图谱权限失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// POST /api/admin/users/[id]/knowledge-graphs - 添加知识图谱权限
export const POST = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id
    const body = await request.json()
    
    // 验证请求参数
    const validationResult = addKnowledgeGraphPermissionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数错误',
            details: validationResult.error.flatten().fieldErrors
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const { knowledgeGraphId } = validationResult.data

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

    // 检查知识图谱是否存在
    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: {
        id: knowledgeGraphId,
        companyId: user.companyId,
        isActive: true,
      }
    })

    if (!knowledgeGraph) {
      return NextResponse.json(
        {
          error: {
            code: 'KNOWLEDGE_GRAPH_NOT_FOUND',
            message: '知识图谱不存在或已禁用'
          }
        },
        { status: 404, headers: corsHeaders }
      )
    }

    // 检查权限是否已存在
    const existingPermission = await prisma.userKnowledgeGraphPermission.findFirst({
      where: {
        userId: targetUserId,
        knowledgeGraphId: knowledgeGraphId,
      }
    })

    if (existingPermission) {
      return NextResponse.json(
        {
          error: {
            code: 'PERMISSION_EXISTS',
            message: '用户已拥有该知识图谱权限'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 创建权限
    const newPermission = await prisma.userKnowledgeGraphPermission.create({
      data: {
        userId: targetUserId,
        knowledgeGraphId: knowledgeGraphId,
        grantedBy: user.userId,
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
            createdAt: true,
          }
        }
      }
    })

    return NextResponse.json({
      data: newPermission,
      message: '知识图谱权限添加成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('添加知识图谱权限失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '添加知识图谱权限失败'
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
