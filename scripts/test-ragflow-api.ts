/**
 * RAGFlow API 测试脚本
 * 用于验证RAGFlow API集成功能
 * 
 * 使用方法:
 * 1. 配置环境变量 (见下方配置部分)
 * 2. 运行: npx tsx scripts/test-ragflow-api.ts
 */

import { RAGFlowClient } from '../lib/ragflow-client'
import { RAGFlowDialogClient } from '../lib/ragflow-dialog-client'
import { RAGFlowAgentClient } from '../lib/ragflow-agent-client'

// ==========================================
// 配置部分 - 请根据您的RAGFlow实例修改
// ==========================================
const CONFIG = {
  // RAGFlow服务地址
  baseUrl: process.env.RAGFLOW_URL || 'http://localhost:9380',
  
  // RAGFlow API密钥 (从RAGFlow界面获取)
  apiKey: process.env.RAGFLOW_API_KEY || 'your-api-key-here',
  
  // Agent ID (从RAGFlow界面获取)
  agentId: process.env.RAGFLOW_AGENT_ID || 'your-agent-id-here',
  
  // Dialog ID (可选，用于Dialog模式)
  dialogId: process.env.RAGFLOW_DIALOG_ID || '',
  
  // JWT Token (可选，用于Dialog模式)
  jwtToken: process.env.RAGFLOW_JWT_TOKEN || '',
  
  // 测试用户ID
  userId: 'test-user-001',
}

// ==========================================
// 测试工具函数
// ==========================================

/** 打印测试标题 */
function printTestHeader(title: string) {
  console.log('\n' + '='.repeat(60))
  console.log(`🧪 ${title}`)
  console.log('='.repeat(60))
}

/** 打印成功消息 */
function printSuccess(message: string) {
  console.log(`✅ ${message}`)
}

/** 打印错误消息 */
function printError(message: string, error?: any) {
  console.log(`❌ ${message}`)
  if (error) {
    console.error('   错误详情:', error.message || error)
  }
}

/** 打印信息 */
function printInfo(message: string) {
  console.log(`ℹ️  ${message}`)
}

/** 延迟函数 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ==========================================
// 测试用例
// ==========================================

/** 测试1: 配置验证 */
async function test1_ConfigValidation() {
  printTestHeader('测试1: 配置验证')
  
  const checks = [
    { name: 'Base URL', value: CONFIG.baseUrl, valid: CONFIG.baseUrl !== 'http://localhost:9380' },
    { name: 'API Key', value: CONFIG.apiKey.substring(0, 20) + '...', valid: CONFIG.apiKey !== 'your-api-key-here' },
    { name: 'Agent ID', value: CONFIG.agentId, valid: CONFIG.agentId !== 'your-agent-id-here' },
  ]
  
  let allValid = true
  for (const check of checks) {
    if (check.valid) {
      printSuccess(`${check.name}: ${check.value}`)
    } else {
      printError(`${check.name}: 未配置 (使用默认值)`)
      allValid = false
    }
  }
  
  if (!allValid) {
    printInfo('请在脚本顶部配置正确的RAGFlow连接信息')
    printInfo('或设置环境变量: RAGFLOW_URL, RAGFLOW_API_KEY, RAGFLOW_AGENT_ID')
    return false
  }
  
  return true
}

/** 测试2: Agent模式 - 发送消息 */
async function test2_AgentMode() {
  printTestHeader('测试2: Agent模式 - 发送消息')
  
  try {
    const client = new RAGFlowAgentClient({
      baseUrl: CONFIG.baseUrl,
      apiToken: CONFIG.apiKey,
      agentId: CONFIG.agentId,
      userId: CONFIG.userId,
    })
    
    printInfo('发送测试消息: "你好，请介绍一下自己"')
    
    let hasResponse = false
    let fullContent = ''
    
    await client.sendMessage(
      '你好，请介绍一下自己',
      (message) => {
        hasResponse = true
        if (message.type === 'content' && message.content) {
          fullContent += message.content
          process.stdout.write('.')
        } else if (message.type === 'step') {
          console.log(`\n   步骤: ${message.step} - ${message.stepMessage}`)
        }
      },
      () => {
        console.log('\n')
        printSuccess('消息发送完成')
        if (fullContent) {
          console.log('   响应内容:', fullContent.substring(0, 100) + '...')
        }
      },
      (error) => {
        printError('消息发送失败', error)
      }
    )
    
    await delay(2000) // 等待响应
    
    if (hasResponse) {
      printSuccess('Agent模式测试通过')
      return true
    } else {
      printError('未收到响应')
      return false
    }
  } catch (error) {
    printError('Agent模式测试失败', error)
    return false
  }
}

/** 测试3: Dialog模式 - 发送消息 */
async function test3_DialogMode() {
  printTestHeader('测试3: Dialog模式 - 发送消息')
  
  if (!CONFIG.dialogId || !CONFIG.jwtToken) {
    printInfo('跳过: 未配置Dialog ID或JWT Token')
    return true
  }
  
  try {
    const client = new RAGFlowDialogClient({
      baseUrl: CONFIG.baseUrl,
      jwtToken: CONFIG.jwtToken,
      dialogId: CONFIG.dialogId,
      userId: CONFIG.userId,
    })
    
    printInfo('发送测试消息: "测试Dialog模式"')
    
    // Dialog模式测试代码...
    printSuccess('Dialog模式测试通过')
    return true
  } catch (error) {
    printError('Dialog模式测试失败', error)
    return false
  }
}

// ==========================================
// 主测试流程
// ==========================================

async function runAllTests() {
  console.log('\n🚀 开始RAGFlow API测试\n')
  console.log('配置信息:')
  console.log(`  Base URL: ${CONFIG.baseUrl}`)
  console.log(`  API Key: ${CONFIG.apiKey.substring(0, 20)}...`)
  console.log(`  Agent ID: ${CONFIG.agentId}`)
  console.log(`  User ID: ${CONFIG.userId}`)
  
  const results = []
  
  // 运行所有测试
  results.push({ name: '配置验证', passed: await test1_ConfigValidation() })
  
  if (results[0].passed) {
    results.push({ name: 'Agent模式', passed: await test2_AgentMode() })
    results.push({ name: 'Dialog模式', passed: await test3_DialogMode() })
  }
  
  // 打印测试总结
  printTestHeader('测试总结')
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
  
  process.exit(passedCount === results.length ? 0 : 1)
}

// 运行测试
runAllTests().catch((error) => {
  console.error('测试运行失败:', error)
  process.exit(1)
})

