/**
 * i国贸开放平台 API 客户端
 * 用于与i国贸 SSO 服务通信
 */

import { logger } from '@/lib/utils/simple-logger'

// i国贸 API 响应接口
interface YunzhijiaResponse<T = any> {
  success: boolean
  errorCode?: string
  data?: T
}

// accessToken 响应
interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number // 秒
}

// 用户信息响应
interface UserInfoResponse {
  userid: string 
  username: string
  appid: string  //轻应用id
  eid?: string   //团队id
  jobNo?: string //工号
  networkid?: string //工作圈id
  deviceId?: string //设备id
  openid?: string //团队用户id
  ticket?: string
  photoUrl?:string //头像
  orgId?:string //部门id
  department?:string //部门name
  projectCode?:string
  mobile?:string
  email?:string
  [key: string]: any // 其他可能的字段
}

// i国贸客户端配置
interface YunzhijiaConfig {
  appId: string
  secret: string
  baseUrl?: string
}

/**
 * i国贸 API 客户端类
 */
export class YunzhijiaClient {
  private appId: string
  private secret: string
  private baseUrl: string

  constructor(config: YunzhijiaConfig) {
    this.appId = config.appId
    this.secret = config.secret
    this.baseUrl = config.baseUrl || process.env.YUNZHIJIA_API_BASE_URL || 'https://api.yunzhijia.com'
    
    logger.info('i国贸客户端初始化', {
      appId: this.appId,
      baseUrl: this.baseUrl
    })
  }

  /**
   * 使用 ticket 换取 accessToken
   * @param ticket i国贸生成的临时票据
   * @returns accessToken 和 refreshToken
   */
  async getAccessToken(ticket: string): Promise<TokenResponse> {
    try {
      logger.info('获取 accessToken', { ticket: ticket.substring(0, 8) + '...' })

      const response = await fetch(`${this.baseUrl}/gateway/oauth2/token/getAccessToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId: this.appId,
          secret: this.secret,
          timestamp: new Date().getTime(),
          scope: "app"
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP 错误: ${response.status}`)
      }

      const result: YunzhijiaResponse<any> = await response.json()
      logger.info("获取 accessToken resp", result)
      if (!result.success) {
        throw new Error(result.errorCode || '获取 accessToken 失败')
      }

      if (!result.data) {
        throw new Error('i国贸 API 返回数据为空')
      }

      // i国贸返回的字段是 expireIn，需要映射为 expiresIn
      const tokenResponse: TokenResponse = {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        expiresIn: result.data.expireIn || result.data.expiresIn || 7200, // 默认2小时
      }


      return tokenResponse
    } catch (error) {
      logger.error('获取 accessToken 失败', error as Error, { ticket })
      throw new Error(`获取 accessToken 失败: ${(error as Error).message}`)
    }
  }

  /**
   * 使用 refreshToken 刷新 accessToken
   * @param refreshToken 刷新令牌
   * @returns 新的 accessToken
   */
  async refreshAccessToken(refreshToken: string): Promise<Omit<TokenResponse, 'refreshToken'>> {
    try {
      logger.info('刷新 accessToken')

      const response = await fetch(`${this.baseUrl}/gateway/oauth2/token/refreshToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appId: this.appId,
          refreshToken: refreshToken,
          timestamp: new Date().getTime(),
          scope: "app"
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP 错误: ${response.status}`)
      }

      const result: YunzhijiaResponse<any> = await response.json()

      if (!result.success) {
        throw new Error(result.errorCode || '刷新 accessToken 失败')
      }

      if (!result.data) {
        throw new Error('i国贸 API 返回数据为空')
      }

      // i国贸返回的字段是 expireIn，需要映射为 expiresIn
      const tokenResponse = {
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        expiresIn: result.data.expireIn || result.data.expiresIn || 7200,
      }

      logger.info('成功刷新 accessToken', {
        expiresIn: tokenResponse.expiresIn
      })

      return tokenResponse
    } catch (error) {
      logger.error('刷新 accessToken 失败', error as Error)
      throw new Error(`刷新 accessToken 失败: ${(error as Error).message}`)
    }
  }

  /**
   * 获取用户信息
   * @param accessToken 访问令牌
   * @param ticket 原始票据（用于验证）
   * @returns 用户信息
   */
  async getUserInfo(accessToken: string, ticket: string): Promise<UserInfoResponse> {
    try {
      logger.info('获取用户信息', { ticket: ticket.substring(0, 8) + '...' })

      const url = new URL(`${this.baseUrl}/gateway/ticket/user/acquirecontext`)
      url.searchParams.append('accessToken', accessToken)

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appid: this.appId,
          ticket: ticket,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP 错误: ${response.status}`)
      }

      const result: YunzhijiaResponse<UserInfoResponse> = await response.json()
      logger.info('成功获取用户信息', result)
      if (!result.success) {
        throw new Error(result.errorCode || '获取用户信息失败')
      }

      if (!result.data) {
        throw new Error('i国贸 API 返回数据为空')
      }

      return result.data
    } catch (error) {
      logger.error('获取用户信息失败', error as Error, { ticket })
      throw new Error(`获取用户信息失败: ${(error as Error).message}`)
    }
  }
}

/**
 * 创建i国贸客户端实例
 * 使用环境变量配置
 */
export function createYunzhijiaClient(): YunzhijiaClient {
  const appId = process.env.YUNZHIJIA_APP_ID
  const secret = process.env.YUNZHIJIA_APP_SECRET

  if (!appId || !secret) {
    throw new Error('i国贸配置缺失: 请设置 YUNZHIJIA_APP_ID 和 YUNZHIJIA_APP_SECRET')
  }

  return new YunzhijiaClient({
    appId,
    secret,
    baseUrl: process.env.YUNZHIJIA_API_BASE_URL,
  })
}

// 导出类型
export type { YunzhijiaConfig, TokenResponse, UserInfoResponse }




