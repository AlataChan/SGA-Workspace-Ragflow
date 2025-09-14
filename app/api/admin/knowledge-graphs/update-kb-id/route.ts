import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

// 更新知识图谱的知识库ID
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const { knowledgeGraphId, kbId } = await request.json()

    if (!knowledgeGraphId || !kbId) {
      return NextResponse.json(
        { error: "缺少必要参数：knowledgeGraphId 和 kbId" },
        { status: 400 }
      )
    }

    // 更新知识图谱的知识库ID
    const updatedKnowledgeGraph = await prisma.knowledgeGraph.update({
      where: {
        id: knowledgeGraphId,
        companyId: user.companyId
      },
      data: {
        kbId: kbId
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedKnowledgeGraph
    })

  } catch (error) {
    console.error("更新知识图谱知识库ID失败:", error)
    return NextResponse.json(
      { error: "更新失败" },
      { status: 500 }
    )
  }
}

// 获取当前知识图谱配置
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    const knowledgeGraphs = await prisma.knowledgeGraph.findMany({
      where: {
        companyId: user.companyId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        kbId: true,
        ragflowUrl: true,
        isActive: true
      }
    })

    return NextResponse.json({
      success: true,
      data: knowledgeGraphs
    })

  } catch (error) {
    console.error("获取知识图谱配置失败:", error)
    return NextResponse.json(
      { error: "获取失败" },
      { status: 500 }
    )
  }
}
