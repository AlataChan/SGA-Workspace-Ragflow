/**
 * 单个Agent管理 API
 * GET /api/admin/agents/[id] - 获取Agent详情
 * PUT /api/admin/agents/[id] - 更新Agent
 * DELETE /api/admin/agents/[id] - 删除Agent
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

// 定义平台枚举
enum AgentPlatform {
  DIFY = 'DIFY',
  RAGFLOW = 'RAGFLOW',
  HIAGENT = 'HIAGENT',
  OPENAI = 'OPENAI',
  CLAUDE = 'CLAUDE',
  CUSTOM = 'CUSTOM'
}

// 平台配置验证模式（复用）
const platformConfigSchemas = {
  DIFY: z.object({
    baseUrl: z.string().min(1, "Dify URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    timeout: z.number().optional().default(30000),
  }),
  RAGFLOW: z.object({
    baseUrl: z.string().min(1, "RAGFlow URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    idType: z.enum(['CHAT', 'AGENT']).default('CHAT'),
    agentId: z.string().min(1, "Agent ID或Chat ID不能为空"),
    datasetId: z.string().optional(), // 知识库ID，用于PDF预览功能
  }),
  HIAGENT: z.object({
    baseUrl: z.string().min(1, "HiAgent URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    agentId: z.string().optional(),
  }),
  OPENAI: z.object({
    apiKey: z.string().min(1, "API Key不能为空"),
    model: z.string().default("gpt-3.5-turbo"),
    baseUrl: z.string().optional(),
  }),
  CLAUDE: z.object({
    apiKey: z.string().min(1, "API Key不能为空"),
    model: z.string().default("claude-3-sonnet-20240229"),
  }),
  CUSTOM: z.object({
    baseUrl: z.string().min(1, "自定义URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    headers: z.record(z.string()).optional(),
  }),
}

// 更新Agent的验证模式
const updateAgentSchema = z.object({
  departmentId: z.string().min(1, "部门ID不能为空").optional(),
  chineseName: z.string().min(1, "中文名称不能为空").max(50, "中文名称过长").optional(),
  englishName: z.string().max(50, "英文名称过长").optional(),
  position: z.string().min(1, "职位不能为空").max(100, "职位过长").optional(),
  description: z.string().max(500, "描述过长").optional(),
  avatarUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  platform: z.nativeEnum(AgentPlatform).optional(),
  platformConfig: z.any().optional(),
  sortOrder: z.number().int().min(0).optional(),
  // 新增连接状态字段
  isOnline: z.boolean().optional(),
  connectionTestedAt: z.string().optional(),
  lastError: z.string().optional(),
})

// GET /api/admin/agents/[id] - 获取Agent详情
export const GET = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        companyId: user.companyId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        },
        userPermissions: {
          include: {
            user: {
              select: {
                id: true,
                userId: true,
                displayName: true,
                avatarUrl: true,
              }
            }
          }
        }
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
        { status: 404 }
      )
    }

    return NextResponse.json({
      data: agent,
      message: '获取Agent详情成功'
    })

  } catch (error) {
    console.error('获取Agent详情失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取Agent详情失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// PUT /api/admin/agents/[id] - 更新Agent
export const PUT = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id
    const body = await request.json()
    
    // 验证请求参数
    const validationResult = updateAgentSchema.safeParse(body)
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

    const updateData = validationResult.data

    // 检查Agent是否存在
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        companyId: user.companyId,
      }
    })

    if (!existingAgent) {
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

    // 如果更新部门，检查部门是否存在
    if (updateData.departmentId && updateData.departmentId !== existingAgent.departmentId) {
      const department = await prisma.department.findFirst({
        where: {
          id: updateData.departmentId,
          companyId: user.companyId,
        }
      })

      if (!department) {
        return NextResponse.json(
          {
            error: {
              code: 'DEPARTMENT_NOT_FOUND',
              message: '部门不存在'
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 如果更新名称，检查是否与其他Agent重名
    if (updateData.chineseName && updateData.chineseName !== existingAgent.chineseName) {
      const duplicateAgent = await prisma.agent.findFirst({
        where: {
          companyId: user.companyId,
          chineseName: updateData.chineseName,
          id: { not: agentId }
        }
      })

      if (duplicateAgent) {
        return NextResponse.json(
          {
            error: {
              code: 'AGENT_EXISTS',
              message: 'Agent名称已存在'
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 验证平台配置（更新时更宽松，允许空的API Key；同时写回默认值/规范化字段）
    const platformToValidate = (updateData.platform ?? existingAgent.platform) as AgentPlatform
    let normalizedPlatformConfig: any = updateData.platformConfig
    if (updateData.platformConfig) {
      const platformSchema = platformConfigSchemas[platformToValidate]
      if (platformSchema) {
        const hasApiKey =
          typeof updateData.platformConfig.apiKey === 'string' &&
          updateData.platformConfig.apiKey.trim() !== ''

        if (hasApiKey) {
          const configValidation = platformSchema.safeParse(updateData.platformConfig)
          if (!configValidation.success) {
            return NextResponse.json(
              {
                error: {
                  code: 'PLATFORM_CONFIG_ERROR',
                  message: '平台配置错误',
                  details: configValidation.error.flatten().fieldErrors,
                },
              },
              { status: 400, headers: corsHeaders }
            )
          }
          normalizedPlatformConfig = configValidation.data
        } else {
          if (updateData.platformConfig.baseUrl && updateData.platformConfig.baseUrl.trim() === '') {
            return NextResponse.json(
              {
                error: {
                  code: 'PLATFORM_CONFIG_ERROR',
                  message: '平台配置错误：Base URL不能为空',
                },
              },
              { status: 400, headers: corsHeaders }
            )
          }
        }
      }

      if (platformToValidate === 'RAGFLOW' && normalizedPlatformConfig && !normalizedPlatformConfig.idType) {
        normalizedPlatformConfig = { ...normalizedPlatformConfig, idType: 'CHAT' }
      }
    }

    // 准备更新数据
    const finalUpdateData: any = {
      ...updateData,
      updatedAt: new Date(),
    }

    if (updateData.platformConfig) {
      finalUpdateData.platformConfig = normalizedPlatformConfig
    }

    // 处理连接状态字段
    if (updateData.connectionTestedAt) {
      finalUpdateData.connectionTestedAt = new Date(updateData.connectionTestedAt)
    }

    // 如果更新了平台配置，同时更新兼容性字段
    if (platformToValidate === 'DIFY' && normalizedPlatformConfig) {
      finalUpdateData.difyUrl = (normalizedPlatformConfig as any)?.baseUrl
      finalUpdateData.difyKey = (normalizedPlatformConfig as any)?.apiKey
    }

    // 更新Agent
    const updatedAgent = await prisma.agent.update({
      where: { id: agentId },
      data: finalUpdateData,
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

    return NextResponse.json({
      data: updatedAgent,
      message: 'Agent更新成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('更新Agent失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新Agent失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// DELETE /api/admin/agents/[id] - 删除Agent
export const DELETE = withAdminAuth(async (request, context) => {
  try {
    const user = request.user!
    const agentId = context.params.id

    // 检查Agent是否存在
    const existingAgent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        companyId: user.companyId,
      },
      include: {
        userPermissions: { select: { id: true } },
        sessions: { select: { id: true } }
      }
    })

    if (!existingAgent) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_NOT_FOUND',
            message: 'Agent不存在'
          }
        },
        { status: 404 }
      )
    }

    // 检查是否有用户权限或聊天记录
    const hasPermissions = existingAgent.userPermissions.length > 0
    const hasSessions = existingAgent.sessions.length > 0

    if (hasPermissions || hasSessions) {
      return NextResponse.json(
        {
          error: {
            code: 'AGENT_HAS_DEPENDENCIES',
            message: `Agent还有关联数据：${hasPermissions ? '用户权限' : ''}${hasPermissions && hasSessions ? '、' : ''}${hasSessions ? '聊天记录' : ''}，请先清理这些数据`
          }
        },
        { status: 400 }
      )
    }

    // 删除Agent
    await prisma.agent.delete({
      where: { id: agentId }
    })

    return NextResponse.json({
      message: 'Agent删除成功'
    })

  } catch (error) {
    console.error('删除Agent失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '删除Agent失败'
        }
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
})
