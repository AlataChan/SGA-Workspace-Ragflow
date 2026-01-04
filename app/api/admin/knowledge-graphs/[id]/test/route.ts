import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { verifyAdminAuth } from "@/lib/auth/admin"

const prisma = new PrismaClient()

// 测试RAGFlow连接
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('开始测试知识图谱连接, ID:', id)

    const user = await verifyAdminAuth(request)
    if (!user) {
      console.log('用户未授权')
      return NextResponse.json({ error: "未授权" }, { status: 401 })
    }

    console.log('用户认证成功:', { userId: user.userId, companyId: user.companyId })

    // 获取知识图谱配置
    const knowledgeGraph = await prisma.knowledgeGraph.findFirst({
      where: {
        id,
        companyId: user.companyId
      }
    })

    if (!knowledgeGraph) {
      console.log('知识图谱不存在:', { id, companyId: user.companyId })
      return NextResponse.json(
        { error: "知识图谱不存在" },
        { status: 404 }
      )
    }

    console.log('找到知识图谱配置:', {
      id: knowledgeGraph.id,
      name: knowledgeGraph.name,
      ragflowUrl: knowledgeGraph.ragflowUrl,
      kbId: knowledgeGraph.kbId,
      apiKeyLength: knowledgeGraph.apiKey?.length || 0
    })

    // 测试RAGFlow API连接
    const testResult = await testRAGFlowConnection(
      knowledgeGraph.ragflowUrl,
      knowledgeGraph.apiKey,
      knowledgeGraph.kbId
    )

    console.log('RAGFlow连接测试结果:', testResult)

    // 更新连接状态和统计信息
    const updateData: any = {
      lastError: testResult.success ? null : testResult.error,
      updatedAt: new Date()
    }

    // 如果测试成功，更新统计信息
    if (testResult.success && testResult.details?.statistics) {
      const stats = testResult.details.statistics
      updateData.nodeCount = stats.nodes || 0
      updateData.edgeCount = stats.edges || 0
    }

    await prisma.knowledgeGraph.update({
      where: { id },
      data: updateData
    })

    console.log('知识图谱状态已更新')

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      details: testResult.details
    })

  } catch (error) {
    console.error('测试知识图谱连接失败:', error)
    return NextResponse.json(
      { error: "服务器内部错误", details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}

// RAGFlow连接测试函数
async function testRAGFlowConnection(
  ragflowUrl: string,
  apiKey: string,
  kbId: string
): Promise<{
  success: boolean
  message: string
  error?: string
  details?: any
}> {
  try {
    // 清理URL，确保格式正确
    const baseUrl = ragflowUrl.replace(/\/$/, '')

    // 尝试多种API路径
    const testUrls = [
      `${baseUrl}/api/v1/datasets/${kbId}/knowledge_graph`, // 新版本API
      `${baseUrl}/api/v1/graphrag/kb/${kbId}/statistics`,   // 文档中的API
      `${baseUrl}/api/v1/graphrag/kb/${kbId}/graph`,        // 图谱数据API
    ]

    console.log('准备测试RAGFlow连接:', {
      baseUrl,
      testUrls,
      kbId,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey?.substring(0, 10) + '...'
    })

    let lastError = null

    // 依次尝试不同的API路径
    for (const testUrl of testUrls) {
      try {
        console.log(`尝试API路径: ${testUrl}`)

        const response = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(30000) // 30秒超时
        })

        console.log(`API路径 ${testUrl} 响应状态:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`API路径 ${testUrl} 响应数据:`, data)

          // 检查不同API的响应格式
          if (data.retcode === 0 || data.code === 0 || data.success === true || data.data) {
            console.log('RAGFlow连接测试成功，使用API路径:', testUrl)

            // 解析不同API的统计数据
            let statistics = { nodes: 0, edges: 0, message: '连接成功' }

            if (data.data) {
              // 如果是知识图谱数据API
              if (data.data.graph) {
                const graph = data.data.graph
                statistics = {
                  nodes: graph.nodes ? graph.nodes.length : 0,
                  edges: graph.edges ? graph.edges.length : 0,
                  message: '图谱数据获取成功'
                }
              }
              // 如果是统计信息API
              else if (data.data.statistics) {
                statistics = {
                  nodes: data.data.statistics.total_nodes || 0,
                  edges: data.data.statistics.total_edges || 0,
                  message: '统计信息获取成功'
                }
              }
              // 如果是实体列表（从终端输出看到的格式）
              else if (data.data.entities && Array.isArray(data.data.entities)) {
                statistics = {
                  nodes: data.data.entities.length,
                  edges: 0, // 实体列表API通常不包含边信息
                  message: '实体数据获取成功'
                }
              }
              // 其他格式的数据
              else {
                statistics = {
                  nodes: 0,
                  edges: 0,
                  message: '连接成功，但无法解析统计数据'
                }
              }
            }

            return {
              success: true,
              message: `RAGFlow连接测试成功 (使用API: ${testUrl.split('/').slice(-2).join('/')})`,
              details: {
                status: response.status,
                apiPath: testUrl,
                statistics
              }
            }
          } else {
            console.log(`API路径 ${testUrl} 返回错误:`, { retcode: data.retcode, retmsg: data.retmsg })
            lastError = data.retmsg || data.message || '未知错误'
          }
        } else {
          const errorText = await response.text()
          console.log(`API路径 ${testUrl} 连接失败:`, {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 200)
          })
          lastError = `${response.status} ${response.statusText}`
        }
      } catch (error) {
        console.error(`API路径 ${testUrl} 异常:`, error)
        lastError = error instanceof Error ? error.message : '连接异常'
      }
    }

    // 所有API路径都失败了
    return {
      success: false,
      message: `所有RAGFlow API路径测试失败，最后错误: ${lastError}`,
      error: lastError,
      details: {
        testedUrls: testUrls,
        lastError
      }
    }


  } catch (error) {
    console.error('RAGFlow连接测试异常:', error)

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.log('RAGFlow连接超时')
        return {
          success: false,
          message: 'RAGFlow连接超时',
          error: '连接超时（30秒）'
        }
      }

      if (error.message.includes('ECONNREFUSED')) {
        console.log('RAGFlow服务拒绝连接')
        return {
          success: false,
          message: 'RAGFlow服务不可达，请检查URL和服务状态',
          error: error.message
        }
      }

      if (error.message.includes('ENOTFOUND')) {
        console.log('RAGFlow域名解析失败')
        return {
          success: false,
          message: 'RAGFlow域名解析失败，请检查URL格式',
          error: error.message
        }
      }

      return {
        success: false,
        message: `RAGFlow连接测试失败: ${error.message}`,
        error: error.message
      }
    }

    return {
      success: false,
      message: 'RAGFlow连接测试失败: 未知错误',
      error: '未知错误'
    }
  }
}
