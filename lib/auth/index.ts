export * from './simple-auth'
// export * from './session-manager' // 暂时注释掉，避免Redis依赖问题
// export * from './permissions' // 暂时注释掉，避免依赖问题
export * from './user'
export * from './admin'
export * from './jwt'
export * from './middleware'

// 导出常用的认证函数
import { SimpleAuth } from './simple-auth'

// 获取用户信息的便捷函数
export async function getUserInfo() {
  try {
    // 在浏览器环境中，从localStorage获取用户信息
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user')
      if (userStr) {
        return JSON.parse(userStr)
      }
    }
    
    // 在服务器环境中，返回默认用户信息（开发环境）
    return {
      userId: 'admin-user-id',
      username: 'admin',
      email: 'admin@demo.com',
      displayName: '管理员',
      role: 'admin',
      companyId: 'demo-company-id'
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return null
  }
}

// 从请求中获取用户信息
export async function getUserFromRequest(request: Request) {
  try {
    // 从请求头中获取token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    
    const token = authHeader.substring(7)
    const user = SimpleAuth.verifyToken(token)
    
    return user
  } catch (error) {
    console.error('从请求获取用户信息失败:', error)
    return null
  }
}
