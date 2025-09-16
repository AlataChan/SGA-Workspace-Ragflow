const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkKnowledgeGraphs() {
  try {
    console.log('🔍 检查知识图谱状态...\n')
    
    const kgs = await prisma.knowledgeGraph.findMany({
      include: {
        company: {
          select: { name: true }
        }
      }
    })
    
    console.log(`📊 数据库中共有 ${kgs.length} 个知识图谱:`)
    kgs.forEach(kg => {
      console.log(`- ${kg.name}`)
      console.log(`  ID: ${kg.id}`)
      console.log(`  状态: ${kg.isActive ? '✅ 活跃' : '❌ 非活跃'}`)
      console.log(`  公司: ${kg.company.name}`)
      console.log(`  创建时间: ${kg.createdAt}`)
      console.log('')
    })
    
    // 检查活跃的知识图谱
    const activeKgs = kgs.filter(kg => kg.isActive)
    console.log(`✅ 活跃的知识图谱: ${activeKgs.length} 个`)
    
    // 检查用户权限
    const permissions = await prisma.userKnowledgeGraphPermission.findMany({
      include: {
        knowledgeGraph: {
          select: {
            id: true,
            name: true,
            isActive: true
          }
        },
        user: {
          select: {
            username: true
          }
        }
      }
    })
    
    console.log(`\n👥 用户权限记录: ${permissions.length} 条`)
    permissions.forEach(perm => {
      console.log(`- 用户 ${perm.user.username} -> ${perm.knowledgeGraph.name} (${perm.knowledgeGraph.isActive ? '活跃' : '非活跃'})`)
    })
    
  } catch (error) {
    console.error('❌ 检查失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkKnowledgeGraphs()
