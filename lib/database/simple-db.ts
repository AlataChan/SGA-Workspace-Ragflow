// 简化的数据库层 - 用于开发和演示
import { logger } from "@/lib/utils/simple-logger"

// 模拟数据存储
const mockData = {
  users: [
    {
      id: 'admin-user-id',
      username: 'admin',
      email: 'admin@demo.com',
      password: '$2a$10$hash_for_admin123', // bcrypt hash for 'admin123'
      displayName: '系统管理员',
      role: 'admin',
      isActive: true,
      companyId: 'demo-company-id',
      createdAt: new Date().toISOString(),
      lastSignIn: new Date().toISOString()
    },
    {
      id: 'user-user-id',
      username: 'user',
      email: 'user@demo.com',
      password: '$2a$10$hash_for_user123', // bcrypt hash for 'user123'
      displayName: '演示用户',
      role: 'user',
      isActive: true,
      companyId: 'demo-company-id',
      createdAt: new Date().toISOString(),
      lastSignIn: null
    }
  ],
  companies: [
    {
      id: 'demo-company-id',
      name: '演示企业',
      description: '这是一个演示企业，用于展示AI工作空间的功能',
      logoUrl: '',
      website: 'https://demo.com',
      contactEmail: 'contact@demo.com',
      settings: {
        theme: 'auto',
        language: 'zh-CN',
        maxUsers: 100,
        maxAgents: 10,
        features: {
          chatHistory: true,
          fileUpload: true,
          apiAccess: false
        }
      },
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ],
  agents: [
    {
      id: 'demo-agent-1',
      name: 'GPT助手',
      description: '基于GPT的通用AI助手，可以回答各种问题，协助完成多种任务',
      platform: 'openai',
      apiUrl: 'https://api.openai.com/v1',
      apiKey: 'demo-api-key',
      modelConfig: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 2000
      },
      avatarUrl: '',
      isActive: true,
      companyId: 'demo-company-id',
      createdBy: 'admin-user-id',
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-agent-2',
      name: 'Dify智能体',
      description: '基于Dify平台的智能助手，具备强大的对话能力和知识库支持',
      platform: 'dify',
      apiUrl: 'http://192.144.232.60/v1',
      apiKey: 'demo-dify-key',
      modelConfig: {
        temperature: 0.8,
        maxTokens: 4000
      },
      avatarUrl: '',
      isActive: true,
      companyId: 'demo-company-id',
      createdBy: 'admin-user-id',
      createdAt: new Date().toISOString()
    },
    {
      id: 'demo-agent-3',
      name: '代码助手',
      description: '专门用于编程和代码相关问题的AI助手，支持多种编程语言',
      platform: 'custom',
      apiUrl: 'https://api.custom.com/v1',
      apiKey: 'demo-custom-key',
      modelConfig: {
        temperature: 0.3,
        maxTokens: 3000,
        systemPrompt: '你是一个专业的编程助手...'
      },
      avatarUrl: '',
      isActive: true,
      companyId: 'demo-company-id',
      createdBy: 'admin-user-id',
      createdAt: new Date().toISOString()
    }
  ],
  userAgentAccess: [
    { id: '1', userId: 'admin-user-id', agentId: 'demo-agent-1', createdAt: new Date().toISOString() },
    { id: '2', userId: 'admin-user-id', agentId: 'demo-agent-2', createdAt: new Date().toISOString() },
    { id: '3', userId: 'admin-user-id', agentId: 'demo-agent-3', createdAt: new Date().toISOString() },
    { id: '4', userId: 'user-user-id', agentId: 'demo-agent-1', createdAt: new Date().toISOString() },
    { id: '5', userId: 'user-user-id', agentId: 'demo-agent-2', createdAt: new Date().toISOString() }
  ],
  sessions: [
    {
      id: 'demo-session-1',
      title: '与GPT助手的对话',
      userId: 'admin-user-id',
      agentId: 'demo-agent-1',
      conversationId: null,
      isActive: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(), // 1天前
      updatedAt: new Date(Date.now() - 3600000).toISOString()   // 1小时前
    },
    {
      id: 'demo-session-2',
      title: '代码问题咨询',
      userId: 'admin-user-id',
      agentId: 'demo-agent-3',
      conversationId: null,
      isActive: true,
      createdAt: new Date(Date.now() - 172800000).toISOString(), // 2天前
      updatedAt: new Date(Date.now() - 7200000).toISOString()    // 2小时前
    }
  ],
  messages: [
    {
      id: 'demo-msg-1',
      sessionId: 'demo-session-1',
      userId: 'admin-user-id',
      role: 'user',
      content: '你好，请介绍一下你的功能',
      metadata: {},
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'demo-msg-2',
      sessionId: 'demo-session-1',
      userId: 'admin-user-id',
      role: 'assistant',
      content: '你好！我是GPT助手，我可以帮助您回答各种问题，包括但不限于：\n\n1. 知识问答\n2. 文本创作\n3. 代码编写\n4. 数据分析\n5. 创意思考\n\n有什么我可以帮助您的吗？',
      metadata: { agentId: 'demo-agent-1' },
      createdAt: new Date(Date.now() - 3590000).toISOString()
    }
  ]
}

// 简化的数据库操作类
export class SimpleDB {
  // 用户相关操作
  static async findUserByUsername(username: string) {
    const user = mockData.users.find(u => u.username === username && u.isActive)
    if (user) {
      logger.info("找到用户", { username, userId: user.id })
    }
    return user || null
  }

  static async findUserByEmail(email: string) {
    const user = mockData.users.find(u => u.email === email && u.isActive)
    return user || null
  }

  static async findUserById(id: string) {
    const user = mockData.users.find(u => u.id === id && u.isActive)
    return user || null
  }

  static async updateUserLastSignIn(userId: string) {
    const user = mockData.users.find(u => u.id === userId)
    if (user) {
      user.lastSignIn = new Date().toISOString()
      logger.info("更新用户最后登录时间", { userId })
    }
    return user
  }

  // 企业相关操作
  static async findCompanyById(id: string) {
    return mockData.companies.find(c => c.id === id && c.isActive) || null
  }

  // 智能体相关操作
  static async findAgentsByCompany(companyId: string) {
    return mockData.agents.filter(a => a.companyId === companyId && a.isActive)
  }

  static async findAgentById(id: string) {
    return mockData.agents.find(a => a.id === id && a.isActive) || null
  }

  static async findUserAccessibleAgents(userId: string) {
    const userAccess = mockData.userAgentAccess.filter(ua => ua.userId === userId)
    const agentIds = userAccess.map(ua => ua.agentId)
    return mockData.agents.filter(a => agentIds.includes(a.id) && a.isActive)
  }

  static async checkUserAgentAccess(userId: string, agentId: string) {
    return mockData.userAgentAccess.some(ua => ua.userId === userId && ua.agentId === agentId)
  }

  // 会话相关操作
  static async findUserSessions(userId: string, limit = 10) {
    return mockData.sessions
      .filter(s => s.userId === userId && s.isActive)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
  }

  static async findSessionById(id: string) {
    return mockData.sessions.find(s => s.id === id && s.isActive) || null
  }

  static async createSession(data: any) {
    const session = {
      id: `session-${Date.now()}`,
      title: data.title || '新对话',
      userId: data.userId,
      agentId: data.agentId,
      conversationId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    mockData.sessions.push(session)
    logger.info("创建会话", { sessionId: session.id, userId: data.userId, agentId: data.agentId })
    return session
  }

  // 消息相关操作
  static async findSessionMessages(sessionId: string, limit = 50) {
    return mockData.messages
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(-limit)
  }

  static async createMessage(data: any) {
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: data.sessionId,
      userId: data.userId,
      role: data.role,
      content: data.content,
      metadata: data.metadata || {},
      createdAt: new Date().toISOString()
    }
    mockData.messages.push(message)
    
    // 更新会话的最后更新时间
    const session = mockData.sessions.find(s => s.id === data.sessionId)
    if (session) {
      session.updatedAt = new Date().toISOString()
    }
    
    logger.info("创建消息", { messageId: message.id, sessionId: data.sessionId, role: data.role })
    return message
  }

  // 统计相关操作
  static async getCompanyStats(companyId: string) {
    const users = mockData.users.filter(u => u.companyId === companyId && u.isActive)
    const agents = mockData.agents.filter(a => a.companyId === companyId && a.isActive)
    const sessions = mockData.sessions.filter(s => 
      users.some(u => u.id === s.userId) && s.isActive
    )
    
    return {
      userCount: users.length,
      agentCount: agents.length,
      sessionCount: sessions.length,
      messageCount: mockData.messages.filter(m => 
        sessions.some(s => s.id === m.sessionId)
      ).length
    }
  }
}

// 导出实例
export const db = SimpleDB
