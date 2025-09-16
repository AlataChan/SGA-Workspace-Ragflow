/**
 * 知识图谱显示问题诊断脚本
 * 用于检查用户权限和知识图谱配置
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function diagnoseKnowledgeGraphIssue() {
  try {
    console.log('🔍 开始诊断知识图谱显示问题...\n')

    // 1. 检查所有知识图谱
    console.log('📊 检查知识图谱配置:')
    const allKnowledgeGraphs = await prisma.knowledgeGraph.findMany({
      include: {
        company: {
          select: { name: true }
        }
      }
    })

    if (allKnowledgeGraphs.length === 0) {
      console.log('❌ 没有找到任何知识图谱配置')
      console.log('💡 解决方案: 请先在管理后台创建知识图谱配置')
      return
    }

    console.log(`✅ 找到 ${allKnowledgeGraphs.length} 个知识图谱:`)
    allKnowledgeGraphs.forEach(kg => {
      console.log(`   - ${kg.name} (ID: ${kg.id})`)
      console.log(`     公司: ${kg.company.name}`)
      console.log(`     状态: ${kg.isActive ? '✅ 活跃' : '❌ 非活跃'}`)
      console.log(`     RAGFlow URL: ${kg.ragflowUrl}`)
      console.log(`     API Key: ${kg.apiKey ? '✅ 已配置' : '❌ 未配置'}`)
      console.log(`     知识库ID: ${kg.kbId}`)
      console.log('')
    })

    // 2. 检查用户权限
    console.log('👥 检查用户权限配置:')
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        companyId: true
      }
    })

    for (const user of allUsers) {
      console.log(`\n用户: ${user.username} (${user.role})`)
      
      if (user.role === 'ADMIN') {
        console.log('   ✅ 管理员用户，可以访问所有活跃的知识图谱')
        continue
      }

      // 检查普通用户的权限
      const userPermissions = await prisma.userKnowledgeGraphPermission.findMany({
        where: { userId: user.id },
        include: {
          knowledgeGraph: {
            select: {
              id: true,
              name: true,
              isActive: true
            }
          }
        }
      })

      if (userPermissions.length === 0) {
        console.log('   ❌ 没有分配任何知识图谱权限')
        console.log('   💡 解决方案: 在管理后台为用户分配知识图谱权限')
      } else {
        console.log(`   ✅ 已分配 ${userPermissions.length} 个知识图谱权限:`)
        userPermissions.forEach(perm => {
          const status = perm.knowledgeGraph.isActive ? '✅ 活跃' : '❌ 非活跃'
          console.log(`      - ${perm.knowledgeGraph.name} (${status})`)
        })
      }
    }

    // 3. 检查RAGFlow连接
    console.log('\n🔗 检查RAGFlow连接:')
    const activeKnowledgeGraphs = allKnowledgeGraphs.filter(kg => kg.isActive)
    
    for (const kg of activeKnowledgeGraphs) {
      console.log(`\n测试知识图谱: ${kg.name}`)
      try {
        const baseUrl = kg.ragflowUrl.replace(/\/$/, '')
        const url = `${baseUrl}/api/v1/datasets/${kg.kbId}/knowledge_graph`
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${kg.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(10000) // 10秒超时
        })

        if (response.ok) {
          const data = await response.json()
          console.log(`   ✅ RAGFlow连接成功`)
          console.log(`   📊 节点数量: ${data.data?.graph?.nodes?.length || 0}`)
          console.log(`   🔗 边数量: ${data.data?.graph?.edges?.length || 0}`)
        } else {
          console.log(`   ❌ RAGFlow连接失败: ${response.status} ${response.statusText}`)
          const errorText = await response.text()
          console.log(`   错误详情: ${errorText}`)
        }
      } catch (error) {
        console.log(`   ❌ RAGFlow连接错误: ${error.message}`)
      }
    }

    // 4. 提供修复建议
    console.log('\n🔧 修复建议:')
    console.log('1. 确保知识图谱状态为活跃 (isActive = true)')
    console.log('2. 为普通用户分配知识图谱权限')
    console.log('3. 检查RAGFlow服务是否正常运行')
    console.log('4. 验证RAGFlow API密钥是否正确')
    console.log('5. 确认知识库ID (kbId) 是否正确')

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 自动分配权限的函数
async function autoAssignPermissions() {
  try {
    console.log('🔧 开始自动分配知识图谱权限...\n')

    // 获取所有活跃的知识图谱
    const activeKnowledgeGraphs = await prisma.knowledgeGraph.findMany({
      where: { isActive: true }
    })

    if (activeKnowledgeGraphs.length === 0) {
      console.log('❌ 没有找到活跃的知识图谱')
      return
    }

    // 获取所有非管理员用户
    const regularUsers = await prisma.user.findMany({
      where: { role: { not: 'ADMIN' } }
    })

    if (regularUsers.length === 0) {
      console.log('❌ 没有找到普通用户')
      return
    }

    console.log(`📊 将为 ${regularUsers.length} 个用户分配 ${activeKnowledgeGraphs.length} 个知识图谱的权限`)

    for (const user of regularUsers) {
      for (const kg of activeKnowledgeGraphs) {
        // 检查是否已存在权限
        const existingPermission = await prisma.userKnowledgeGraphPermission.findUnique({
          where: {
            userId_knowledgeGraphId: {
              userId: user.id,
              knowledgeGraphId: kg.id
            }
          }
        })

        if (!existingPermission) {
          await prisma.userKnowledgeGraphPermission.create({
            data: {
              userId: user.id,
              knowledgeGraphId: kg.id,
              grantedBy: 'system' // 系统自动分配
            }
          })
          console.log(`✅ 为用户 ${user.username} 分配知识图谱 ${kg.name} 的权限`)
        } else {
          console.log(`⏭️  用户 ${user.username} 已有知识图谱 ${kg.name} 的权限`)
        }
      }
    }

    console.log('\n✅ 权限分配完成!')

  } catch (error) {
    console.error('❌ 自动分配权限时发生错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--fix')) {
    await autoAssignPermissions()
  } else {
    await diagnoseKnowledgeGraphIssue()
    console.log('\n💡 如果要自动修复权限问题，请运行: node scripts/diagnose-knowledge-graph.js --fix')
  }
}

main().catch(console.error)
