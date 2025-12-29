/**
 * RAGFlow 知识库API 测试脚本
 * 测试知识库管理、文档上传、知识图谱等功能
 * 
 * 使用方法:
 * 1. 配置环境变量
 * 2. 运行: npx tsx scripts/test-ragflow-knowledge-base.ts
 */

// ==========================================
// 配置部分
// ==========================================
const CONFIG = {
  baseUrl: process.env.RAGFLOW_URL || 'http://localhost:9380',
  apiKey: process.env.RAGFLOW_API_KEY || 'your-api-key-here',
  kbId: process.env.RAGFLOW_KB_ID || '', // 可选，如果为空则创建新知识库
}

// ==========================================
// 测试工具函数
// ==========================================

function printHeader(title: string) {
  console.log('\n' + '='.repeat(60))
  console.log(`🧪 ${title}`)
  console.log('='.repeat(60))
}

function printSuccess(message: string) {
  console.log(`✅ ${message}`)
}

function printError(message: string, error?: any) {
  console.log(`❌ ${message}`)
  if (error) {
    console.error('   错误:', error.message || error)
  }
}

function printInfo(message: string) {
  console.log(`ℹ️  ${message}`)
}

// ==========================================
// API调用函数
// ==========================================

/** 调用RAGFlow API */
async function callRAGFlowAPI(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
) {
  const url = `${CONFIG.baseUrl}${endpoint}`
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${CONFIG.apiKey}`,
      'Content-Type': 'application/json',
    },
  }
  
  if (body) {
    options.body = JSON.stringify(body)
  }
  
  const response = await fetch(url, options)
  const data = await response.json()
  
  return { response, data }
}

// ==========================================
// 测试用例
// ==========================================

/** 测试1: 列出知识库 */
async function test1_ListKnowledgeBases() {
  printHeader('测试1: 列出知识库')
  
  try {
    const { data } = await callRAGFlowAPI('/v1/kb/list', 'GET')
    
    if (data.retcode === 0) {
      printSuccess(`成功获取知识库列表`)
      printInfo(`知识库数量: ${data.data?.length || 0}`)
      
      if (data.data && data.data.length > 0) {
        console.log('\n知识库列表:')
        data.data.forEach((kb: any, index: number) => {
          console.log(`  ${index + 1}. ${kb.name} (ID: ${kb.id})`)
          console.log(`     文档数: ${kb.document_count || 0}, 分块数: ${kb.chunk_count || 0}`)
        })
        
        // 如果没有配置KB ID，使用第一个
        if (!CONFIG.kbId && data.data[0]) {
          CONFIG.kbId = data.data[0].id
          printInfo(`使用知识库: ${data.data[0].name} (${CONFIG.kbId})`)
        }
      }
      
      return true
    } else {
      printError('获取知识库列表失败', data.retmsg)
      return false
    }
  } catch (error) {
    printError('API调用失败', error)
    return false
  }
}

/** 测试2: 创建知识库 */
async function test2_CreateKnowledgeBase() {
  printHeader('测试2: 创建知识库')
  
  try {
    const { data } = await callRAGFlowAPI('/api/v1/datasets', 'POST', {
      name: `测试知识库_${Date.now()}`,
      description: 'RAGFlow API测试创建的知识库',
      language: 'Chinese',
      embedding_model: 'BAAI/bge-large-zh-v1.5',
      permission: 'me',
      chunk_method: 'naive',
    })
    
    if (data.code === 0) {
      printSuccess('知识库创建成功')
      printInfo(`知识库ID: ${data.data.id}`)
      printInfo(`知识库名称: ${data.data.name}`)
      return true
    } else {
      printError('知识库创建失败', data.message)
      return false
    }
  } catch (error) {
    printError('API调用失败', error)
    return false
  }
}

/** 测试3: 获取知识图谱 */
async function test3_GetKnowledgeGraph() {
  printHeader('测试3: 获取知识图谱')
  
  if (!CONFIG.kbId) {
    printInfo('跳过: 未配置知识库ID')
    return true
  }
  
  try {
    const { data } = await callRAGFlowAPI(
      `/api/v1/datasets/${CONFIG.kbId}/knowledge_graph`,
      'GET'
    )
    
    if (data.code === 0) {
      printSuccess('成功获取知识图谱')
      
      const graph = data.data?.graph
      if (graph) {
        printInfo(`节点数量: ${graph.nodes?.length || 0}`)
        printInfo(`边数量: ${graph.edges?.length || 0}`)
        
        if (graph.nodes && graph.nodes.length > 0) {
          console.log('\n前5个节点:')
          graph.nodes.slice(0, 5).forEach((node: any, index: number) => {
            console.log(`  ${index + 1}. ${node.name} (类型: ${node.entity_type})`)
          })
        }
      } else {
        printInfo('知识图谱为空，可能需要先上传文档并启用GraphRAG')
      }
      
      return true
    } else {
      printError('获取知识图谱失败', data.message)
      return false
    }
  } catch (error) {
    printError('API调用失败', error)
    return false
  }
}

/** 测试4: 列出文档 */
async function test4_ListDocuments() {
  printHeader('测试4: 列出文档')
  
  if (!CONFIG.kbId) {
    printInfo('跳过: 未配置知识库ID')
    return true
  }
  
  try {
    const { data } = await callRAGFlowAPI(
      `/v1/document/list?kb_id=${CONFIG.kbId}`,
      'GET'
    )
    
    if (data.retcode === 0) {
      printSuccess('成功获取文档列表')
      printInfo(`文档数量: ${data.data?.length || 0}`)
      
      if (data.data && data.data.length > 0) {
        console.log('\n文档列表:')
        data.data.forEach((doc: any, index: number) => {
          console.log(`  ${index + 1}. ${doc.name}`)
          console.log(`     状态: ${doc.status}, 分块数: ${doc.chunk_count || 0}`)
        })
      }
      
      return true
    } else {
      printError('获取文档列表失败', data.retmsg)
      return false
    }
  } catch (error) {
    printError('API调用失败', error)
    return false
  }
}

// ==========================================
// 主测试流程
// ==========================================

async function runAllTests() {
  console.log('\n🚀 开始RAGFlow知识库API测试\n')
  console.log('配置信息:')
  console.log(`  Base URL: ${CONFIG.baseUrl}`)
  console.log(`  API Key: ${CONFIG.apiKey.substring(0, 20)}...`)
  console.log(`  KB ID: ${CONFIG.kbId || '(未配置)'}`)
  
  const results = []
  
  // 运行测试
  results.push({ name: '列出知识库', passed: await test1_ListKnowledgeBases() })
  results.push({ name: '创建知识库', passed: await test2_CreateKnowledgeBase() })
  results.push({ name: '获取知识图谱', passed: await test3_GetKnowledgeGraph() })
  results.push({ name: '列出文档', passed: await test4_ListDocuments() })
  
  // 打印总结
  printHeader('测试总结')
  let passedCount = 0
  for (const result of results) {
    if (result.passed) {
      printSuccess(`${result.name}: 通过`)
      passedCount++
    } else {
      printError(`${result.name}: 失败`)
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log(`总计: ${passedCount}/${results.length} 测试通过`)
  console.log('='.repeat(60) + '\n')
}

runAllTests().catch(console.error)

