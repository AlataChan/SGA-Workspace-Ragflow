/**
 * Agent管理 API
 * GET /api/admin/agents - 获取Agent列表
 * POST /api/admin/agents - 创建Agent
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

// 平台配置验证模式
const platformConfigSchemas = {
  DIFY: z.object({
    baseUrl: z.string().min(1, "Dify URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
    timeout: z.number().optional().default(30000),
  }),
  RAGFLOW: z.object({
    baseUrl: z.string().min(1, "RAGFlow URL不能为空"),
    apiKey: z.string().min(1, "API Key不能为空"),
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

// 创建Agent的验证模式
const createAgentSchema = z.object({
  departmentId: z.string().min(1, "部门ID不能为空"),
  chineseName: z.string().min(1, "中文名称不能为空").max(50, "中文名称过长"),
  englishName: z.string().max(50, "英文名称过长").optional(),
  position: z.string().min(1, "职位不能为空").max(100, "职位过长"),
  description: z.string().max(500, "描述过长").optional(),
  avatarUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  platform: z.nativeEnum(AgentPlatform),
  platformConfig: z.any(), // 根据platform动态验证
  sortOrder: z.number().int().min(0).optional(),
  // 新增连接状态字段
  isOnline: z.boolean().optional(),
  connectionTestedAt: z.string().optional(),
  lastError: z.string().optional(),
})

// GET /api/admin/agents - 获取Agent列表
export const GET = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const platform = searchParams.get('platform')
    
    const whereClause: any = { companyId: user.companyId }
    
    if (departmentId) {
      whereClause.departmentId = departmentId
    }
    
    if (platform && Object.values(AgentPlatform).includes(platform as AgentPlatform)) {
      whereClause.platform = platform as AgentPlatform
    }

    const agents = await prisma.agent.findMany({
      where: whereClause,
      include: {
        department: {
          select: {
            id: true,
            name: true,
            icon: true,
          }
        },
        userPermissions: {
          select: {
            userId: true,
            user: {
              select: {
                displayName: true,
                userId: true,
              }
            }
          }
        }
      },
      orderBy: [
        { department: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    // 统计信息
    const stats = {
      total: agents.length,
      online: agents.filter(agent => agent.isOnline).length,
      byPlatform: agents.reduce((acc, agent) => {
        acc[agent.platform] = (acc[agent.platform] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      byDepartment: agents.reduce((acc, agent) => {
        const deptName = agent.department.name
        acc[deptName] = (acc[deptName] || 0) + 1
        return acc
      }, {} as Record<string, number>),
    }

    return NextResponse.json({
      data: agents,
      stats,
      message: '获取Agent列表成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('获取Agent列表失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取Agent列表失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})

// POST /api/admin/agents - 创建Agent
export const POST = withAdminAuth(async (request) => {
  try {
    const user = request.user!
    const body = await request.json()
    
    // 基础验证
    const validationResult = createAgentSchema.safeParse(body)
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

    const { platform, platformConfig, departmentId, ...agentData } = validationResult.data

    // 验证部门是否存在
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
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

    // 验证平台配置
    const platformSchema = platformConfigSchemas[platform]
    if (platformSchema) {
      const configValidation = platformSchema.safeParse(platformConfig)
      if (!configValidation.success) {
        return NextResponse.json(
          {
            error: {
              code: 'PLATFORM_CONFIG_ERROR',
              message: '平台配置错误',
              details: configValidation.error.flatten().fieldErrors
            }
          },
          { status: 400, headers: corsHeaders }
        )
      }
    }

    // 检查Agent名称是否已存在
    const existingAgent = await prisma.agent.findFirst({
      where: {
        companyId: user.companyId,
        chineseName: agentData.chineseName
      }
    })

    if (existingAgent) {
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

    // 如果没有指定排序，设置为最大值+1
    let finalSortOrder = agentData.sortOrder
    if (finalSortOrder === undefined) {
      const maxSortOrder = await prisma.agent.findFirst({
        where: { 
          companyId: user.companyId,
          departmentId: departmentId
        },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true }
      })
      finalSortOrder = (maxSortOrder?.sortOrder || 0) + 1
    }

    // 准备创建数据
    const createData: any = {
      companyId: user.companyId,
      departmentId,
      platform,
      platformConfig,
      sortOrder: finalSortOrder,
      // 兼容性字段（如果是Dify平台）
      difyUrl: platform === 'DIFY' ? (platformConfig as any)?.baseUrl : null,
      difyKey: platform === 'DIFY' ? (platformConfig as any)?.apiKey : null,
      ...agentData,
    }

    // 处理连接状态字段
    if (agentData.connectionTestedAt) {
      createData.connectionTestedAt = new Date(agentData.connectionTestedAt)
    }

    // 创建Agent
    const newAgent = await prisma.agent.create({
      data: createData,
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
      data: newAgent,
      message: 'Agent创建成功'
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('创建Agent失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '创建Agent失败'
        }
      },
      { status: 500, headers: corsHeaders }
    )
  } finally {
    await prisma.$disconnect()
  }
})
