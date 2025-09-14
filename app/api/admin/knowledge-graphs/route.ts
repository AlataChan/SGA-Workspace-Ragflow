import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PrismaClient } from "@prisma/client"
import { verifyAdminAuth } from "@/lib/auth/admin"

const prisma = new PrismaClient()

// 知识图谱创建验证模式
const createKnowledgeGraphSchema = z.object({
  name: z.string().min(1, "知识图谱名称不能为空"),
  description: z.string().optional(),
  ragflowUrl: z.string().url("RAGFlow URL格式不正确"),
  apiKey: z.string().min(1, "API Key不能为空"),
  kbId: z.string().min(1, "知识库ID不能为空"),
  sortOrder: z.number().optional().default(0),
})

// 获取知识图谱列表
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAdminAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const knowledgeGraphs = await prisma.knowledgeGraph.findMany({
      where: { companyId: user.companyId },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        company: {
          select: { name: true }
        }
      }
    })

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

// 创建知识图谱
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAdminAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createKnowledgeGraphSchema.parse(body)

    // 检查名称是否已存在
    const existingKG = await prisma.knowledgeGraph.findFirst({
      where: {
        companyId: user.companyId,
        name: validatedData.name
      }
    })

    if (existingKG) {
      return NextResponse.json(
        { error: "知识图谱名称已存在" },
        { status: 400 }
      )
    }

    // 如果没有指定排序，设置为最大值+1
    let finalSortOrder = validatedData.sortOrder
    if (finalSortOrder === 0) {
      const maxSortOrder = await prisma.knowledgeGraph.findFirst({
        where: { companyId: user.companyId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true }
      })
      finalSortOrder = (maxSortOrder?.sortOrder || 0) + 1
    }

    // 创建知识图谱
    const newKnowledgeGraph = await prisma.knowledgeGraph.create({
      data: {
        companyId: user.companyId,
        name: validatedData.name,
        description: validatedData.description,
        ragflowUrl: validatedData.ragflowUrl,
        apiKey: validatedData.apiKey,
        kbId: validatedData.kbId,
        sortOrder: finalSortOrder,
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: newKnowledgeGraph,
      message: "知识图谱创建成功"
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: "数据验证失败",
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }

    console.error('创建知识图谱失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}
