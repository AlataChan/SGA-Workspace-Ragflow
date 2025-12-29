#!/usr/bin/env tsx
/**
 * 列出所有RAGFlow资源
 * 用于查找给定ID对应的资源类型
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const CONFIG = {
  baseUrl: process.env.RAGFLOW_URL || '',
  apiKey: process.env.RAGFLOW_API_KEY || '',
}

const TARGET_IDS = [
  '93d1d18edafe11f09b6eba83a5fbacbf',
  'dc949110906a11f08b78aa7cd3e67281',
]

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
}

function log(msg: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`)
}

async function callAPI(endpoint: string) {
  const url = `${CONFIG.baseUrl}${endpoint}`
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    const data = await response.json()
    return { success: response.ok, data, status: response.status }
  } catch (error) {
    return { success: false, error: String(error), status: 0 }
  }
}

function checkId(id: string, name: string) {
  if (TARGET_IDS.includes(id)) {
    log(`\n🎯 找到匹配的ID: ${id}`, 'green')
    log(`   资源名称: ${name}`, 'cyan')
    return true
  }
  return false
}

async function main() {
  log('\n' + '='.repeat(70), 'cyan')
  log('列出所有RAGFlow资源', 'cyan')
  log('='.repeat(70) + '\n', 'cyan')
  
  log(`目标ID 1: ${TARGET_IDS[0]}`, 'yellow')
  log(`目标ID 2: ${TARGET_IDS[1]}\n`, 'yellow')

  // 1. 列出所有Datasets
  log('1. 获取所有Datasets (知识库)...', 'magenta')
  const datasetsResult = await callAPI('/api/v1/datasets')
  if (datasetsResult.success && datasetsResult.data?.data) {
    log(`   找到 ${datasetsResult.data.data.length} 个知识库`, 'cyan')
    datasetsResult.data.data.forEach((kb: any) => {
      const matched = checkId(kb.id, kb.name)
      if (!matched) {
        log(`   - ${kb.name} (${kb.id})`, 'reset')
      }
    })
  } else {
    log(`   ❌ 失败: ${JSON.stringify(datasetsResult.data)}`, 'red')
  }

  // 2. 列出所有Chats
  log('\n2. 获取所有Chat Assistants...', 'magenta')
  const chatsResult = await callAPI('/api/v1/chats')
  if (chatsResult.success && chatsResult.data?.data) {
    log(`   找到 ${chatsResult.data.data.length} 个Chat`, 'cyan')
    chatsResult.data.data.forEach((chat: any) => {
      const matched = checkId(chat.id, chat.name)
      if (!matched) {
        log(`   - ${chat.name} (${chat.id})`, 'reset')
      }
    })
  } else {
    log(`   ❌ 失败: ${JSON.stringify(chatsResult.data)}`, 'red')
  }

  // 3. 列出所有Agents
  log('\n3. 获取所有Agents...', 'magenta')
  const agentsResult = await callAPI('/api/v1/agents')
  if (agentsResult.success && agentsResult.data?.data) {
    log(`   找到 ${agentsResult.data.data.length} 个Agent`, 'cyan')
    agentsResult.data.data.forEach((agent: any) => {
      const matched = checkId(agent.id, agent.name || agent.title)
      if (!matched) {
        log(`   - ${agent.name || agent.title} (${agent.id})`, 'reset')
      }
    })
  } else {
    log(`   ❌ 失败: ${JSON.stringify(agentsResult.data)}`, 'red')
  }

  // 4. 尝试v1端点
  log('\n4. 尝试 /v1/datasets...', 'magenta')
  const v1DatasetsResult = await callAPI('/v1/datasets')
  if (v1DatasetsResult.success && v1DatasetsResult.data?.data) {
    log(`   找到 ${v1DatasetsResult.data.data.length} 个知识库`, 'cyan')
    v1DatasetsResult.data.data.forEach((kb: any) => {
      const matched = checkId(kb.id, kb.name)
      if (!matched) {
        log(`   - ${kb.name} (${kb.id})`, 'reset')
      }
    })
  } else {
    log(`   ❌ 失败`, 'red')
  }

  // 5. 尝试kb端点
  log('\n5. 尝试 /api/v1/kb/list...', 'magenta')
  const kbListResult = await callAPI('/api/v1/kb/list')
  if (kbListResult.success && kbListResult.data?.data) {
    log(`   找到 ${kbListResult.data.data.length} 个知识库`, 'cyan')
    kbListResult.data.data.forEach((kb: any) => {
      const matched = checkId(kb.id, kb.name)
      if (!matched) {
        log(`   - ${kb.name} (${kb.id})`, 'reset')
      }
    })
  } else {
    log(`   ❌ 失败`, 'red')
  }

  log('\n' + '='.repeat(70), 'cyan')
  log('搜索完成', 'cyan')
  log('='.repeat(70) + '\n', 'cyan')
}

main().catch(console.error)

