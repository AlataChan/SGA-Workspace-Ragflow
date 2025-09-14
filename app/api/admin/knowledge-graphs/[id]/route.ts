import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { PrismaClient } from "@prisma/client"
import { verifyAdminAuth } from "@/lib/auth/admin"

const prisma = new PrismaClient()

// 知识图谱更新验证模式
const updateKnowledgeGraphSchema = z.object({
  name: z.string().min(1, "知识图谱名称不能为空").optional(),
  description: z.string().optional(),
  ragflowUrl: z.string().url("RAGFlow URL格式不正确").optional(),
  apiKey: z.string().min(1, "API Key不能为空").optional(),
  kbId: z.string().min(1, "知识库ID不能为空").optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
})

// 获取单个知识图谱
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyAdminAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    })

    if (!knowledgeGraph) {
      return NextResponse.json(
        { error: "知识图谱不存在" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: knowledgeGraph
    })

  } catch (error) {
    console.error('获取知识图谱失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

// 更新知识图谱
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyAdminAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateKnowledgeGraphSchema.parse(body)

    // 检查知识图谱是否存在
    const existingKG = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId
      }
    })

    if (!existingKG) {
      return NextResponse.json(
        { error: "知识图谱不存在" },
        { status: 404 }
      )
    }

    // 如果更新名称，检查是否重复
    if (validatedData.name && validatedData.name !== existingKG.name) {
      const duplicateKG = await prisma.knowledgeGraph.findFirst({
        where: {
          companyId: user.companyId,
          name: validatedData.name,
          id: { not: id }
        }
      })

      if (duplicateKG) {
        return NextResponse.json(
          { error: "知识图谱名称已存在" },
          { status: 400 }
        )
      }
    }

    // 更新知识图谱
    const updatedKnowledgeGraph = await prisma.knowledgeGraph.update({
      where: { id },
      data: {
        ...validatedData,
        updatedAt: new Date()
      },
      include: {
        company: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedKnowledgeGraph,
      message: "知识图谱更新成功"
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

    console.error('更新知识图谱失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

// 删除知识图谱
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyAdminAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 检查知识图谱是否存在
    const existingKG = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId
      }
    })

    if (!existingKG) {
      return NextResponse.json(
        { error: "知识图谱不存在" },
        { status: 404 }
      )
    }

    // 删除知识图谱
    await prisma.knowledgeGraph.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: "知识图谱删除成功"
    })

  } catch (error) {
    console.error('删除知识图谱失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}
