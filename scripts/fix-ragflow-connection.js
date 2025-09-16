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
    console.log('💡 提示：如需修复智能体配置，请在管理界面手动将localhost改为host.docker.internal')
    
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
