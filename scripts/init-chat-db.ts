import fs from 'fs'
import path from 'path'

async function initChatDatabase() {
  console.log('🚀 聊天数据库初始化指南')
  console.log('='.repeat(50))

  // 读取SQL文件
  const sqlPath = path.join(process.cwd(), 'lib/database/chat-schema.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('📋 由于当前使用演示配置，请手动在Supabase控制台执行以下SQL:')
  console.log('-'.repeat(50))
  console.log(sql)
  console.log('-'.repeat(50))

  console.log('📝 操作步骤:')
  console.log('1. 登录您的Supabase控制台')
  console.log('2. 进入SQL编辑器')
  console.log('3. 复制上面的SQL语句并执行')
  console.log('4. 确认创建了以下表:')
  console.log('   - chat_sessions (聊天会话表)')
  console.log('   - chat_messages (聊天消息表)')
  console.log('5. 更新.env.local中的Supabase配置')

  console.log('\n✅ 初始化指南完成！')
  console.log('💡 提示: 在生产环境中，请使用真实的Supabase配置')
}

// 如果直接运行此脚本
if (require.main === module) {
  initChatDatabase()
    .then(() => {
      console.log('数据库初始化完成')
      process.exit(0)
    })
    .catch((error) => {
      console.error('数据库初始化失败:', error)
      process.exit(1)
    })
}

export { initChatDatabase }
