#!/usr/bin/env tsx
/**
 * RAGFlow连接测试脚本
 * 用于验证RAGFlow API配置是否正确
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// 配置信息
const CONFIG = {
  baseUrl: process.env.RAGFLOW_URL || '',
  apiKey: process.env.RAGFLOW_API_KEY || '',
  chatId: process.env.RAGFLOW_CHAT_ID || '',
  agentId: process.env.RAGFLOW_AGENT_ID || '',
  kbId: process.env.RAGFLOW_KB_ID || '',
}

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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
    return { success: response.ok, status: response.status, data }
  } catch (error) {
    return { 
      success: false, 
      status: 0, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

// 测试1: 验证配置
async function test1_ValidateConfig() {
  log('\n' + '='.repeat(60), 'bright')
  log('测试1: 验证配置信息', 'bright')
  log('='.repeat(60), 'bright')

  logInfo('检查环境变量配置...')
  
  const checks = [
    { name: 'RAGFLOW_URL', value: CONFIG.baseUrl, required: true },
    { name: 'RAGFLOW_API_KEY', value: CONFIG.apiKey, required: true },
    { name: 'RAGFLOW_CHAT_ID', value: CONFIG.chatId, required: true },
    { name: 'RAGFLOW_AGENT_ID', value: CONFIG.agentId, required: false },
    { name: 'RAGFLOW_KB_ID', value: CONFIG.kbId, required: false },
  ]

  let allRequired = true
  for (const check of checks) {
    if (check.value) {
      logSuccess(`${check.name}: ${check.value.substring(0, 40)}...`)
    } else if (check.required) {
      logError(`${check.name}: 未配置 (必需)`)
      allRequired = false
    } else {
      logWarning(`${check.name}: 未配置 (可选)`)
    }
  }

  if (!allRequired) {
    logError('配置验证失败: 缺少必需的环境变量')
    return false
  }

  logSuccess('配置验证通过')
  return true
}

// 测试2: 测试API连接
async function test2_TestConnection() {
  log('\n' + '='.repeat(60), 'bright')
  log('测试2: 测试API连接', 'bright')
  log('='.repeat(60), 'bright')

  logInfo('尝试连接RAGFlow API...')
  
  // 测试获取知识库列表
  const result = await callRAGFlowAPI('/api/v1/datasets', 'GET')
  
  if (result.success) {
    logSuccess(`连接成功! 状态码: ${result.status}`)
    if (result.data?.data) {
      logInfo(`找到 ${result.data.data.length} 个知识库`)
    }
    return true
  } else {
    logError(`连接失败! 状态码: ${result.status}`)
    if (result.error) {
      logError(`错误信息: ${result.error}`)
    } else if (result.data) {
      logError(`响应数据: ${JSON.stringify(result.data, null, 2)}`)
    }
    return false
  }
}

// 测试3: 测试Chat对话
async function test3_TestChat() {
  log('\n' + '='.repeat(60), 'bright')
  log('测试3: 测试Chat对话功能', 'bright')
  log('='.repeat(60), 'bright')

  if (!CONFIG.chatId) {
    logWarning('跳过: 未配置RAGFLOW_CHAT_ID')
    return true
  }

  logInfo('创建对话会话...')
  
  // 创建会话
  const sessionResult = await callRAGFlowAPI(
    `/api/v1/chats/${CONFIG.chatId}/sessions`,
    'POST',
    { name: 'RAGFlow连接测试' }
  )

  if (!sessionResult.success) {
    logError('创建会话失败')
    logError(`响应: ${JSON.stringify(sessionResult.data, null, 2)}`)
    return false
  }

  const sessionId = sessionResult.data?.data?.id
  if (!sessionId) {
    logError('无法获取会话ID')
    return false
  }

  logSuccess(`会话创建成功! Session ID: ${sessionId}`)

  // 发送测试消息
  logInfo('发送测试消息...')
  
  const chatResult = await callRAGFlowAPI(
    `/api/v1/chats/${CONFIG.chatId}/sessions/${sessionId}/completions`,
    'POST',
    {
      question: '你好，这是一条测试消息',
      stream: false
    }
  )

  if (chatResult.success) {
    logSuccess('对话测试成功!')
    if (chatResult.data?.data?.answer) {
      logInfo(`AI回复: ${chatResult.data.data.answer.substring(0, 100)}...`)
    }
    return true
  } else {
    logError('对话测试失败')
    logError(`响应: ${JSON.stringify(chatResult.data, null, 2)}`)
    return false
  }
}

// 测试4: 获取知识库列表
async function test4_ListKnowledgeBases() {
  log('\n' + '='.repeat(60), 'bright')
  log('测试4: 获取知识库列表', 'bright')
  log('='.repeat(60), 'bright')

  logInfo('获取知识库列表...')
  
  const result = await callRAGFlowAPI('/api/v1/datasets', 'GET')

  if (result.success && result.data?.data) {
    const datasets = result.data.data
    logSuccess(`成功获取 ${datasets.length} 个知识库`)
    
    datasets.forEach((kb: any, index: number) => {
      log(`\n知识库 ${index + 1}:`, 'cyan')
      logInfo(`  ID: ${kb.id}`)
      logInfo(`  名称: ${kb.name}`)
      logInfo(`  文档数: ${kb.document_count || 0}`)
      logInfo(`  分块数: ${kb.chunk_count || 0}`)
    })
    
    return true
  } else {
    logError('获取知识库列表失败')
    return false
  }
}

// 主函数
async function main() {
  log('\n' + '█'.repeat(60), 'bright')
  log('RAGFlow API 连接测试', 'bright')
  log('█'.repeat(60) + '\n', 'bright')

  const tests = [
    { name: '配置验证', fn: test1_ValidateConfig },
    { name: 'API连接', fn: test2_TestConnection },
    { name: 'Chat对话', fn: test3_TestChat },
    { name: '知识库列表', fn: test4_ListKnowledgeBases },
  ]

  const results: { name: string; success: boolean }[] = []

  for (const test of tests) {
    try {
      const success = await test.fn()
      results.push({ name: test.name, success })
    } catch (error) {
      logError(`测试异常: ${error instanceof Error ? error.message : String(error)}`)
      results.push({ name: test.name, success: false })
    }
  }

  // 输出测试总结
  log('\n' + '='.repeat(60), 'bright')
  log('测试总结', 'bright')
  log('='.repeat(60), 'bright')

  results.forEach(result => {
    if (result.success) {
      logSuccess(`${result.name}: 通过`)
    } else {
      logError(`${result.name}: 失败`)
    }
  })

  const passedCount = results.filter(r => r.success).length
  const totalCount = results.length

  log('\n' + '-'.repeat(60), 'bright')
  if (passedCount === totalCount) {
    logSuccess(`所有测试通过! (${passedCount}/${totalCount})`)
    log('\n🎉 RAGFlow API配置正确，可以开始集成开发！\n', 'green')
  } else {
    logWarning(`部分测试失败 (${passedCount}/${totalCount})`)
    log('\n⚠️  请检查失败的测试项并修复配置\n', 'yellow')
  }
}

// 运行测试
main().catch(error => {
  logError(`测试脚本执行失败: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

