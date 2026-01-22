/**
 * 用户Agent权限管理 API
 * GET /api/admin/users/[id]/agents - 获取用户的Agent权限
 * POST /api/admin/users/[id]/agents - 添加Agent权限
 * DELETE /api/admin/users/[id]/agents/[agentId] - 移除Agent权限
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

// 添加Agent权限的验证模式
const addAgentPermissionSchema = z.object({
  agentId: z.string().min(1, "Agent ID不能为空"),
})

const SUPER_ADMIN_ID = '00000000-0000-0000-0000-000000000001'

// GET /api/admin/users/[id]/agents - 获取用户的Agent权限
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

    if (targetUser.id === SUPER_ADMIN_ID) {
      return NextResponse.json(
        {
          error: {
            code: 'PROTECTED_USER',
            message: '系统超级管理员账号不能被操作'
          }
        },
        { status: 403, headers: corsHeaders }
      )
    }

    // 获取用户的Agent权限
    const userAgentPermissions = await prisma.userAgentPermission.findMany({
      where: {
        userId: targetUserId,
      },
      include: {
        agent: {
          select: {
            id: true,
            chineseName: true,
            englishName: true,
            position: true,
            platform: true,
            isOnline: true,
            department: {
              select: {
                id: true,
                name: true,
                icon: true,
              }
            }
          }
        }
      }
    })

    const now = new Date()
    const activeRevocations = await prisma.userAgentPermissionRevocation.findMany({
      where: {
        userId: targetUserId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      include: {
        agent: {
          select: {
            id: true,
            chineseName: true,
            englishName: true,
            position: true,
            platform: true,
            isOnline: true,
            department: {
              select: {
                id: true,
                name: true,
                icon: true,
              }
            }
          }
        }
      }
    })

    // 获取所有可用的Agent（用于显示可添加的Agent）
    const allAgents = await prisma.agent.findMany({
      where: {
        companyId: user.companyId,
      },
      select: {
        id: true,
        chineseName: true,
        englishName: true,
        position: true,
        platform: true,
        isOnline: true,
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        }
      },
      orderBy: [
        { department: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // 过滤出用户还没有权限的Agent（Set 避免 O(n^2)）
    const userAgentIdSet = new Set(userAgentPermissions.map(p => p.agentId))
    const revokedAgentIdSet = new Set(activeRevocations.map(r => r.agentId))
    const availableAgents = allAgents.filter(agent => !userAgentIdSet.has(agent.id) && !revokedAgentIdSet.has(agent.id))

    return NextResponse.json({
      data: {
        user: targetUser,
        userAgents: userAgentPermissions.map(p => ({
          ...p.agent,
          permission: {
            grantedBy: p.grantedBy,
            grantedVia: p.grantedVia,
            grantBatchId: p.grantBatchId,
            createdAt: p.createdAt,
          }
        })),
        availableAgents: availableAgents,
        revokedAgents: activeRevocations.map(r => ({
          ...r.agent,
          revocation: {
            revokedBy: r.revokedBy,
            revokedAt: r.revokedAt,
            reason: r.reason,
            expiresAt: r.expiresAt,
          }
        })),
        permissions: userAgentPermissions
      },
      message: '获取用户Agent权限成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取用户Agent权限失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取用户Agent权限失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// POST /api/admin/users/[id]/agents - 添加Agent权限
export const POST = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id
    const body = await request.json()
    
    // 验证请求参数
    const validationResult = addAgentPermissionSchema.safeParse(body)
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

    const { agentId } = validationResult.data

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

    if (targetUser.id === SUPER_ADMIN_ID) {
      return NextResponse.json(
        {
          error: {
            code: 'PROTECTED_USER',
            message: '系统超级管理员账号不能被操作'
          }
        },
        { status: 403, headers: corsHeaders }
      )
    }

    // 检查Agent是否存在
    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        companyId: user.companyId,
      }
    })

    if (!agent) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_NOT_FOUND',
            message: 'Agent不存在'
          }
        },
        { status: 404, headers: corsHeaders }
      )
    }

    // 检查权限是否已存在
    const existingPermission = await prisma.userAgentPermission.findFirst({
      where: {
        userId: targetUserId,
        agentId: agentId,
      }
    })

    if (existingPermission) {
      return NextResponse.json(
        {
          error: {
            code: 'PERMISSION_EXISTS',
            message: '用户已拥有该Agent权限'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

    // 创建权限（同时解除黑名单）
    const [, newPermission] = await prisma.$transaction([
      prisma.userAgentPermissionRevocation.updateMany({
        where: { userId: targetUserId, agentId, isActive: true },
        data: { isActive: false },
      }),
      prisma.userAgentPermission.create({
        data: {
          userId: targetUserId,
          agentId: agentId,
          grantedBy: user.userId,
          grantedVia: 'single',
        },
        include: {
          agent: {
            select: {
              id: true,
              chineseName: true,
              englishName: true,
              position: true,
              platform: true,
              isOnline: true,
              department: {
                select: {
                  id: true,
                  name: true,
                  icon: true,
                }
              }
            }
          }
        }
      })
    ])

    return NextResponse.json({
      data: newPermission,
      message: 'Agent权限添加成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('添加Agent权限失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '添加Agent权限失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// DELETE /api/admin/users/[id]/agents - 移除Agent权限
export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const targetUserId = context.params.id
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_AGENT_ID',
            message: '缺少Agent ID参数'
          }
        },
        { status: 400, headers: corsHeaders }
      )
    }

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

    if (targetUser.id === SUPER_ADMIN_ID) {
      return NextResponse.json(
        {
          error: {
            code: 'PROTECTED_USER',
            message: '系统超级管理员账号不能被操作'
          }
        },
        { status: 403, headers: corsHeaders }
      )
    }

    const agent = await prisma.agent.findFirst({
      where: { id: agentId, companyId: user.companyId },
      select: { id: true }
    })
    if (!agent) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_NOT_FOUND',
            message: 'Agent不存在'
          }
        },
        { status: 404, headers: corsHeaders }
      )
    }

    // 检查权限是否存在
    const existingPermission = await prisma.userAgentPermission.findFirst({
      where: {
        userId: targetUserId,
        agentId: agentId,
      }
    })

    if (!existingPermission) {
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

    // 删除权限，并记录黑名单（撤销后批量授权不会恢复）
    await prisma.$transaction([
      prisma.userAgentPermission.delete({
        where: {
          id: existingPermission.id,
        }
      }),
      prisma.userAgentPermissionRevocation.upsert({
        where: { unique_user_agent_revocation: { userId: targetUserId, agentId } },
        create: {
          userId: targetUserId,
          agentId,
          revokedBy: user.userId,
          isActive: true,
        },
        update: {
          revokedBy: user.userId,
          revokedAt: new Date(),
          isActive: true,
          expiresAt: null,
        }
      })
    ])

    return NextResponse.json({
      message: 'Agent权限移除成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('移除Agent权限失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '移除Agent权限失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})
