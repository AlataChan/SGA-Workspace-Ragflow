#!/usr/bin/env node

/**
 * RAGFlow连接修复脚本
 * 自动将localhost URL替换为host.docker.internal
 */

const { PrismaClient } = require('@prisma/client')

async function fixRAGFlowConnections() {
  const prisma = new PrismaClient()
  
  try {
    console.log('🔧 开始修复RAGFlow连接配置...')
    
    // 查找所有使用localhost的知识图谱
    const knowledgeGraphs = await prisma.knowledgeGraph.findMany({
      where: {
        ragflowUrl: {
          contains: 'localhost'
        }
      }
    })
    
    console.log(`📊 找到 ${knowledgeGraphs.length} 个需要修复的知识图谱`)
    
    for (const kg of knowledgeGraphs) {
      const oldUrl = kg.ragflowUrl
      const newUrl = oldUrl.replace('localhost', 'host.docker.internal')
      
      await prisma.knowledgeGraph.update({
        where: { id: kg.id },
        data: { 
          ragflowUrl: newUrl,
          lastError: null // 清除之前的错误
        }
      })
      
      console.log(`✅ 修复: ${kg.name}`)
      console.log(`   旧URL: ${oldUrl}`)
      console.log(`   新URL: ${newUrl}`)
    }
    
    console.log('🎉 RAGFlow知识图谱连接修复完成！')

    // 修复智能体（RAGFLOW 平台）的 baseUrl 配置
    const agents = await prisma.agent.findMany({
      where: { platform: 'RAGFLOW' },
      select: { id: true, chineseName: true, englishName: true, platformConfig: true, lastError: true },
    })

    let fixedAgents = 0
    for (const agent of agents) {
      const cfg = agent.platformConfig
      if (!cfg || typeof cfg !== 'object') continue

      const baseUrl = cfg.baseUrl
      if (typeof baseUrl !== 'string' || (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1'))) {
        continue
      }

      const newBaseUrl = baseUrl
        .replace('127.0.0.1', 'host.docker.internal')
        .replace('localhost', 'host.docker.internal')

      const newConfig = { ...cfg, baseUrl: newBaseUrl }

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          platformConfig: newConfig,
          lastError: null,
        },
      })

      fixedAgents++
      console.log(`✅ 修复智能体: ${agent.chineseName || agent.englishName || agent.id}`)
      console.log(`   旧URL: ${baseUrl}`)
      console.log(`   新URL: ${newBaseUrl}`)
    }

    console.log(`🎉 RAGFlow智能体连接修复完成！共修复 ${fixedAgents} 个智能体`)
    
  } catch (error) {
    console.error('❌ 修复失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  fixRAGFlowConnections()
}

module.exports = { fixRAGFlowConnections }
