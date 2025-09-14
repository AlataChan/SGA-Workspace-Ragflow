import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyUserAuth } from "@/lib/auth/user"

const prisma = new PrismaClient()

// 获取节点关联文件
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const { id, nodeId } = await params

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
      console.log(`[API] 知识图谱不存在: id=${id}`)
      return NextResponse.json(
        { error: "知识图谱不存在或已禁用" },
        { status: 404 }
      )
    }

    console.log(`[API] 获取节点文件: graphId=${id}, nodeId=${nodeId}`)
    console.log(`[API] 知识图谱配置:`, JSON.stringify({
      id: knowledgeGraph.id,
      kbId: knowledgeGraph.kbId,
      ragflowUrl: knowledgeGraph.ragflowUrl
    }))

    // 重用图谱数据获取API的逻辑来获取节点信息
    console.log(`[API] 开始获取图谱数据...`)
    const graphResult = await fetchRAGFlowGraphData(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId
    )

    if (!graphResult.success) {
      console.log(`[API] 获取图谱数据失败: ${graphResult.error}`)
      return NextResponse.json(
        { error: graphResult.error },
        { status: 500 }
      )
    }

    const nodes = graphResult.data?.nodes || []
    console.log(`[API] 获取到 ${nodes.length} 个节点`)

    // 查找目标节点
    const targetNode = nodes.find((node: any) =>
      (node.id === nodeId || node.entity_name === nodeId)
    )

    if (!targetNode) {
      console.log(`[API] 节点不存在: ${nodeId}`)
      return NextResponse.json(
        { error: "节点不存在" },
        { status: 404 }
      )
    }

    console.log(`[API] 找到节点 ${nodeId} 的source信息:`, {
      sourceIds: targetNode.sourceIds,
      sourceFilesCount: targetNode.sourceFilesCount,
      hasSourceFiles: targetNode.hasSourceFiles
    })

    // 如果节点没有关联文件，直接返回空数组
    if (!targetNode.sourceIds || targetNode.sourceIds.length === 0) {
      console.log(`[API] 节点 ${nodeId} 没有关联文件`)
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // 获取所有文档，然后过滤出节点关联的文档
    console.log(`[API] 获取所有文档...`)
    const filesResult = await fetchDatasetDocuments(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId
    )

    if (!filesResult.success) {
      console.log(`[API] 获取文档失败: ${filesResult.error}`)
      return NextResponse.json(
        { error: filesResult.error },
        { status: 500 }
      )
    }

    // 过滤出节点关联的文档
    const allDocs = filesResult.files || []
    const nodeSourceIds = targetNode.sourceIds || []

    const relatedDocs = allDocs.filter((doc: any) =>
      nodeSourceIds.includes(doc.id)
    )

    console.log(`[API] 节点 ${nodeId} 关联的文档:`, {
      总文档数: allDocs.length,
      节点sourceIds: nodeSourceIds,
      关联文档数: relatedDocs.length,
      关联文档: relatedDocs.map((doc: any) => ({ id: doc.id, name: doc.name }))
    })

    return NextResponse.json({
      success: true,
      data: relatedDocs
    })

  } catch (error) {
    console.error('获取节点关联文件失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    )
  }
}

// 调用RAGFlow API获取知识图谱数据（重用图谱API逻辑）
async function fetchRAGFlowGraphData(
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
      signal: AbortSignal.timeout(30000) // 30秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `RAGFlow Graph API错误: ${response.status} ${response.statusText} - ${errorText}`
      }
    }

    const data = await response.json()

    if (data.code !== 0) {
      return {
        success: false,
        error: `RAGFlow Graph API返回错误: ${data.message || data.retmsg || '未知错误'}`
      }
    }

    // 转换数据格式，与图谱API保持一致
    const graph = data.data?.graph || {}
    const nodes = (graph.nodes || []).map((node: any) => ({
      id: node.id,
      entity_name: node.entity_name,
      entity_type: node.entity_type,
      description: node.description || '',
      pagerank: node.pagerank || 0,
      // 添加文件相关信息 - 注意：官方API返回的是source_id（单数）
      sourceFilesCount: node.source_files_count || 0,
      hasSourceFiles: node.has_source_files || false,
      sourceIds: node.source_id || [], // 官方API字段名是source_id，不是source_ids
      count: node.source_files_count || 0 // 用于重要性显示
    }))

    return {
      success: true,
      data: { nodes }
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

// 调用RAGFlow API获取知识图谱数据
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
      signal: AbortSignal.timeout(30000) // 30秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `RAGFlow Graph API错误: ${response.status} ${response.statusText} - ${errorText}`
      }
    }

    const data = await response.json()

    if (data.code !== 0) {
      return {
        success: false,
        error: `RAGFlow Graph API返回错误: ${data.message || data.retmsg || '未知错误'}`
      }
    }

    return {
      success: true,
      data
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

// 调用RAGFlow API获取数据集文档列表
async function fetchDatasetDocuments(
  ragflowUrl: string,
  apiKey: string,
  kbId: string
): Promise<{
  success: boolean
  files?: any[]
  error?: string
}> {
  try {
    const baseUrl = ragflowUrl.replace(/\/$/, '')
    const url = `${baseUrl}/api/v1/datasets/${kbId}/documents?page=1&page_size=100`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000) // 30秒超时
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `RAGFlow API错误: ${response.status} ${response.statusText} - ${errorText}`
      }
    }

    const data = await response.json()

    if (data.code !== 0) {
      return {
        success: false,
        error: `RAGFlow API返回错误: ${data.message || data.retmsg || '未知错误'}`
      }
    }

    // 转换文档格式
    const files = (data.data?.docs || []).map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type || 'document',
      size: doc.size || 0,
      location: doc.location,
      create_time: doc.create_time,
      update_time: doc.update_time
    }))

    return {
      success: true,
      files
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
