import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

// 获取知识图谱数据
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await verifyUserAuth(request)
    if (!user) {
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    // 获取知识图谱配置
    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId,
        isActive: true
      }
    })

    if (!knowledgeGraph) {
      return NextResponse.json(
        { error: "知识图谱不存在或已禁用" },
        { status: 404 }
      )
    }

    // 调用RAGFlow API获取图谱数据
    const graphData = await fetchRAGFlowGraph(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId
    )

    if (!graphData.success) {
      return NextResponse.json(
        { error: graphData.error },
        { status: 500 }
      )
    }

    // 更新统计信息
    if (graphData.data?.graph) {
      // RAGFlow API返回的数据结构是 {data: {graph: {nodes: [], edges: []}}}
      const nodes = graphData.data.graph.nodes || []
      const edges = graphData.data.graph.edges || []
      const nodeCount = nodes.length
      const edgeCount = edges.length

      console.log(`知识图谱统计信息: 节点数=${nodeCount}, 边数=${edgeCount}`)

      await prisma.knowledgeGraph.update({
        where: { id },
        data: {
          nodeCount,
          edgeCount,
          lastSyncAt: new Date(),
          lastError: null
        }
      })
    }

    // 转换RAGFlow数据格式为前端期望的格式
    const ragflowGraph = graphData.data.graph || {}
    const nodes = ragflowGraph.nodes || []
    const edges = ragflowGraph.edges || []

    // 转换为前端期望的格式：edges -> links
    const transformedData = {
      nodes: nodes.map((node: any) => ({
        id: node.id || node.entity_name,
        name: node.entity_name || node.id,
        type: node.entity_type || 'UNKNOWN',
        description: node.description || '',
        pagerank: node.pagerank || 0,
        // 添加文件相关信息
        sourceFilesCount: node.source_files_count || 0,
        hasSourceFiles: node.has_source_files || false,
        sourceIds: node.source_id || [], // 官方API字段名是source_id，不是source_ids
        count: node.source_files_count || 0 // 用于重要性显示
      })),
      links: edges.map((edge: any) => ({
        source: edge.source,
        target: edge.target,
        description: edge.description || '',
        weight: edge.weight || 1
      }))
    }

    console.log(`转换后的数据格式: 节点数=${transformedData.nodes.length}, 连线数=${transformedData.links.length}`)

    return NextResponse.json({
      success: true,
      data: {
        knowledgeGraph: {
          id: knowledgeGraph.id,
          name: knowledgeGraph.name,
          description: knowledgeGraph.description
        },
        ...transformedData
      }
    })

  } catch (error) {
    console.error('获取知识图谱数据失败:', error)
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined,
      knowledgeGraphId: id
    })
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// 调用RAGFlow API获取图谱数据
async function fetchRAGFlowGraph(
  ragflowUrl: string,
  apiKey: string,
  kbId: string
): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  try {
    const baseUrl = ragflowUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/v1/datasets/${kbId}/knowledge_graph`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(60000) // 60秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `RAGFlow API错误: ${response.status} ${response.statusText} - ${errorText}`
      }
    }

    const data = await response.json()

    // RAGFlow API 使用 code 字段而不是 retcode
    if (data.code !== 0) {
      return {
        success: false,
        error: `RAGFlow API返回错误: ${data.message || data.retmsg || '未知错误'}`
      }
    }

    return {
      success: true,
      data: data.data
    }

  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: '请求超时'
        }
      }
      
      return {
        success: false,
        error: `网络错误: ${error.message}`
      }
    }
    
    return {
      success: false,
      error: '未知错误'
    }
  }
}
