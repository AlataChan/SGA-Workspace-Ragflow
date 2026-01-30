/**
 * 用户Agent权限管理 API
 * GET /api/admin/users/[id]/agents - 获取用户的Agent权限
 * POST /api/admin/users/[id]/agents - 添加Agent权限
 * DELETE /api/admin/users/[id]/agents/[agentId] - 移除Agent权限
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withAdminAuth } from '@/lib/auth/middleware'
import type { CurrentUser } from '@/lib/auth/middleware'
import { z } from 'zod'
import { getEffectiveAgentIdsForUser } from '@/lib/auth/agent-access'

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

    // 管理员用户拥有全部权限：无需返回完整列表，避免大 payload
    if (targetUser.role === 'ADMIN') {
      return NextResponse.json({
        data: {
          user: targetUser,
          userAgents: [],
          availableAgents: [],
          permissions: [],
        },
        message: '获取用户Agent权限成功',
      }, { headers: corsHeaders })
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

    // 计算 EffectiveAgents(user)（explicit ∪ policy − revoked）
    const targetAsCurrentUser: CurrentUser = {
      userId: targetUser.id,
      companyId: targetUser.companyId,
      role: targetUser.role,
      departmentId: targetUser.departmentId ?? undefined,
    }

    const { agentIds, sourcesByAgentId, revokedAgentIds } = await getEffectiveAgentIdsForUser(targetAsCurrentUser)

    const effectiveAgents = agentIds.length > 0
      ? await prisma.agent.findMany({
          where: {
            companyId: user.companyId,
            id: { in: agentIds },
          },
          select: {
            id: true,
            chineseName: true,
            englishName: true,
            position: true,
            platform: true,
            isOnline: true,
            avatarUrl: true,
            department: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
          orderBy: [
            { department: { sortOrder: 'asc' } },
            { sortOrder: 'asc' },
            { createdAt: 'desc' },
          ],
        })
      : []

    // 可添加的 Agent = 所有 Agent − 当前已具备访问权限的 Agent（policy/explicit）
    // 说明：被撤销的 Agent 不在 effectiveSet 中，会出现在可添加列表，可用于“显式恢复”（POST 会清除撤销黑名单）。
    const availableAgents = await prisma.agent.findMany({
      where: {
        companyId: user.companyId,
        ...(agentIds.length > 0 ? { id: { notIn: agentIds } } : {}),
      },
      select: {
        id: true,
        chineseName: true,
        englishName: true,
        position: true,
        platform: true,
        isOnline: true,
        avatarUrl: true,
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
      orderBy: [
        { department: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    // 将 accessSource 标注到返回的 userAgents
    const userAgents = effectiveAgents.map((agent) => ({
      ...agent,
      accessSource: sourcesByAgentId[agent.id] ?? 'policy',
    }))

    return NextResponse.json({
      data: {
        user: targetUser,
        userAgents,
        availableAgents: availableAgents,
        permissions: userAgentPermissions,
        revokedAgentIds,
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

    // 创建权限
    const [newPermission] = await prisma.$transaction([
      prisma.userAgentPermission.create({
        data: {
          userId: targetUserId,
          agentId: agentId,
          grantedBy: user.userId,
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
      }),
      // 如果该用户-该Agent存在撤销黑名单，则本次“单独授权”视为显式恢复：解除黑名单
      prisma.userAgentPermissionRevocation.updateMany({
        where: {
          userId: targetUserId,
          agentId: agentId,
          isActive: true,
        },
        data: {
          isActive: false,
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

    // 检查权限是否存在（显式授权）
    const existingPermission = await prisma.userAgentPermission.findFirst({
      where: {
        userId: targetUserId,
        agentId: agentId,
      }
    })

    // 删除显式权限（如果存在） + 记录撤销黑名单（避免后续部门规则/批量授权恢复）
    const tx: any[] = []
    if (existingPermission) {
      tx.push(prisma.userAgentPermission.delete({ where: { id: existingPermission.id } }))
    }

    tx.push(
      prisma.userAgentPermissionRevocation.upsert({
        where: {
          unique_user_agent_revocation: {
            userId: targetUserId,
            agentId: agentId,
          },
        },
        create: {
          userId: targetUserId,
          agentId: agentId,
          revokedBy: user.userId,
          isActive: true,
        },
        update: {
          revokedBy: user.userId,
          revokedAt: new Date(),
          isActive: true,
          expiresAt: null,
          reason: null,
        },
      })
    )

    await prisma.$transaction(tx)

    return NextResponse.json({
      data: { explicitDeleted: existingPermission ? 1 : 0, revoked: true },
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
