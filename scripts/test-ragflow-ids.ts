#!/usr/bin/env tsx
/**
 * RAGFlow ID测试脚本
 * 测试给定的ID是什么类型的资源
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// 配置信息
const CONFIG = {
  baseUrl: process.env.RAGFLOW_URL || '',
  apiKey: process.env.RAGFLOW_API_KEY || '',
}

// 要测试的ID
const TEST_IDS = [
  '93d1d18edafe11f09b6eba83a5fbacbf',
  'dc949110906a11f08b78aa7cd3e67281',
]

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green')
}

function logError(message: string) {
  log(`❌ ${message}`, 'red')
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'cyan')
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow')
}

// RAGFlow API调用函数
async function callRAGFlowAPI(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any
) {
  const url = `${CONFIG.baseUrl}${endpoint}`
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()
    return { 
      success: response.ok, 
      status: response.status, 
      data,
      url 
    }
  } catch (error) {
    return { 
      success: false, 
      status: 0, 
      error: error instanceof Error ? error.message : String(error),
      url
    }
  }
}

// 测试ID是否为Dataset (知识库)
async function testAsDataset(id: string) {
  logInfo(`测试作为Dataset (知识库)...`)

  // 尝试多个可能的端点
  const endpoints = [
    `/api/v1/datasets/${id}`,
    `/api/v1/kb/${id}`,
    `/v1/datasets/${id}`,
    `/v1/kb/${id}`,
  ]

  for (const endpoint of endpoints) {
    const result = await callRAGFlowAPI(endpoint, 'GET')

    if (result.success && result.data?.code === 0) {
      logSuccess(`这是一个Dataset (知识库)! [端点: ${endpoint}]`)
      const dataset = result.data.data
      log(`\n知识库信息:`, 'magenta')
      logInfo(`  ID: ${dataset.id}`)
      logInfo(`  名称: ${dataset.name}`)
      logInfo(`  描述: ${dataset.description || '无'}`)
      logInfo(`  文档数: ${dataset.document_count || 0}`)
      logInfo(`  分块数: ${dataset.chunk_count || 0}`)
      logInfo(`  创建时间: ${dataset.create_time || '未知'}`)
      return { type: 'dataset', data: dataset, endpoint }
    }
  }

  return null
}

// 测试ID是否为Chat Assistant
async function testAsChat(id: string) {
  logInfo(`测试作为Chat Assistant...`)

  // 尝试多个可能的端点
  const endpoints = [
    `/api/v1/chats/${id}`,
    `/v1/chats/${id}`,
    `/api/v1/chat/${id}`,
    `/v1/chat/${id}`,
  ]

  for (const endpoint of endpoints) {
    const result = await callRAGFlowAPI(endpoint, 'GET')

    if (result.success && result.data?.code === 0) {
      logSuccess(`这是一个Chat Assistant! [端点: ${endpoint}]`)
      const chat = result.data.data
      log(`\nChat Assistant信息:`, 'magenta')
      logInfo(`  ID: ${chat.id}`)
      logInfo(`  名称: ${chat.name}`)
      logInfo(`  描述: ${chat.description || '无'}`)
      logInfo(`  LLM: ${chat.llm?.model_name || '未知'}`)
      logInfo(`  创建时间: ${chat.create_time || '未知'}`)
      return { type: 'chat', data: chat, endpoint }
    }
  }

  return null
}

// 测试ID是否为Agent
async function testAsAgent(id: string) {
  logInfo(`测试作为Agent...`)

  // 尝试多个可能的端点
  const endpoints = [
    `/api/v1/agents/${id}`,
    `/v1/agents/${id}`,
    `/api/v1/agent/${id}`,
    `/v1/agent/${id}`,
  ]

  for (const endpoint of endpoints) {
    const result = await callRAGFlowAPI(endpoint, 'GET')

    if (result.success && result.data?.code === 0) {
      logSuccess(`这是一个Agent! [端点: ${endpoint}]`)
      const agent = result.data.data
      log(`\nAgent信息:`, 'magenta')
      logInfo(`  ID: ${agent.id}`)
      logInfo(`  名称: ${agent.name}`)
      logInfo(`  描述: ${agent.description || '无'}`)
      logInfo(`  创建时间: ${agent.create_time || '未知'}`)
      return { type: 'agent', data: agent, endpoint }
    }
  }

  return null
}

// 测试ID是否为Document
async function testAsDocument(id: string, datasetId?: string) {
  if (!datasetId) {
    logWarning(`跳过Document测试 (需要Dataset ID)`)
    return null
  }
  
  logInfo(`测试作为Document...`)
  
  const result = await callRAGFlowAPI(`/api/v1/datasets/${datasetId}/documents/${id}`, 'GET')
  
  if (result.success && result.data?.code === 0) {
    logSuccess(`这是一个Document!`)
    const doc = result.data.data
    log(`\nDocument信息:`, 'magenta')
    logInfo(`  ID: ${doc.id}`)
    logInfo(`  名称: ${doc.name}`)
    logInfo(`  大小: ${doc.size || 0} bytes`)
    logInfo(`  状态: ${doc.status || '未知'}`)
    logInfo(`  创建时间: ${doc.create_time || '未知'}`)
    return { type: 'document', data: doc }
  }
  
  return null
}

// 测试单个ID
async function testSingleId(id: string, index: number) {
  log('\n' + '='.repeat(70), 'bright')
  log(`测试ID ${index + 1}: ${id}`, 'bright')
  log('='.repeat(70), 'bright')

  const tests = [
    { name: 'Dataset (知识库)', fn: () => testAsDataset(id) },
    { name: 'Chat Assistant', fn: () => testAsChat(id) },
    { name: 'Agent', fn: () => testAsAgent(id) },
  ]

  let found = false
  let result: any = null

  for (const test of tests) {
    try {
      const testResult = await test.fn()
      if (testResult) {
        found = true
        result = testResult
        break
      }
    } catch (error) {
      logError(`${test.name} 测试异常: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (!found) {
    logError(`无法识别此ID的类型`)
    logWarning(`可能是无效的ID或需要其他参数`)
  }

  return result
}

// 主函数
async function main() {
  log('\n' + '█'.repeat(70), 'bright')
  log('RAGFlow ID 类型测试', 'bright')
  log('█'.repeat(70) + '\n', 'bright')

  logInfo(`RAGFlow URL: ${CONFIG.baseUrl}`)
  logInfo(`测试 ${TEST_IDS.length} 个ID\n`)

  const results: any[] = []

  for (let i = 0; i < TEST_IDS.length; i++) {
    const result = await testSingleId(TEST_IDS[i], i)
    results.push({ id: TEST_IDS[i], result })
  }

  // 输出总结
  log('\n' + '='.repeat(70), 'bright')
  log('测试总结', 'bright')
  log('='.repeat(70), 'bright')

  results.forEach((item, index) => {
    log(`\nID ${index + 1}: ${item.id}`, 'cyan')
    if (item.result) {
      logSuccess(`类型: ${item.result.type.toUpperCase()}`)
      logInfo(`名称: ${item.result.data.name || '未知'}`)
    } else {
      logError(`类型: 未识别`)
    }
  })

  // 生成环境变量建议
  log('\n' + '='.repeat(70), 'bright')
  log('环境变量配置建议', 'bright')
  log('='.repeat(70) + '\n', 'bright')

  const datasetResult = results.find(r => r.result?.type === 'dataset')
  const chatResult = results.find(r => r.result?.type === 'chat')
  const agentResult = results.find(r => r.result?.type === 'agent')

  if (datasetResult) {
    log(`# 知识库配置`, 'green')
    log(`RAGFLOW_KB_ID=${datasetResult.id}`, 'cyan')
    log(`# 知识库名称: ${datasetResult.result.data.name}\n`, 'yellow')
  }

  if (chatResult) {
    log(`# Chat Assistant配置`, 'green')
    log(`RAGFLOW_CHAT_ID=${chatResult.id}`, 'cyan')
    log(`# Chat名称: ${chatResult.result.data.name}\n`, 'yellow')
  }

  if (agentResult) {
    log(`# Agent配置`, 'green')
    log(`RAGFLOW_AGENT_ID=${agentResult.id}`, 'cyan')
    log(`# Agent名称: ${agentResult.result.data.name}\n`, 'yellow')
  }

  log('\n🎉 测试完成！\n', 'green')
}

// 运行测试
main().catch(error => {
  logError(`测试脚本执行失败: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

