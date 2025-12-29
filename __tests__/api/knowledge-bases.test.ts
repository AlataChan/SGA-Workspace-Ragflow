import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

/**
 * 知识库API测试
 * 
 * 测试知识库CRUD操作的API端点
 */

describe('Knowledge Base API', () => {
  const baseUrl = 'http://localhost:3000'
  let authToken: string
  let testKbId: string

  beforeAll(async () => {
    // 模拟登录获取token
    authToken = 'test-token'
  })

  afterAll(async () => {
    // 清理测试数据
    if (testKbId) {
      try {
        await fetch(`${baseUrl}/api/knowledge-bases/${testKbId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
      } catch (error) {
        console.error('清理测试数据失败:', error)
      }
    }
  })

  describe('POST /api/knowledge-bases', () => {
    it('应该成功创建知识库', async () => {
      const response = await fetch(`${baseUrl}/api/knowledge-bases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: 'Test Knowledge Base',
          description: 'This is a test knowledge base',
          isActive: true,
        }),
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('id')
      expect(data.data.name).toBe('Test Knowledge Base')
      
      testKbId = data.data.id
    })

    it('应该拒绝空名称的知识库', async () => {
      const response = await fetch(`${baseUrl}/api/knowledge-bases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name: '',
          description: 'Invalid knowledge base',
        }),
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('应该拒绝未授权的请求', async () => {
      const response = await fetch(`${baseUrl}/api/knowledge-bases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Unauthorized KB',
        }),
      })

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/knowledge-bases', () => {
    it('应该返回知识库列表', async () => {
      const response = await fetch(`${baseUrl}/api/knowledge-bases`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
    })

    it('应该支持分页', async () => {
      const response = await fetch(
        `${baseUrl}/api/knowledge-bases?page=1&pageSize=10`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      )

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.pageSize).toBe(10)
    })
  })

  describe('GET /api/knowledge-bases/[id]', () => {
    it('应该返回知识库详情', async () => {
      if (!testKbId) {
        // 如果没有测试ID，先创建一个
        const createResponse = await fetch(`${baseUrl}/api/knowledge-bases`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            name: 'Test KB for Detail',
          }),
        })
        const createData = await createResponse.json()
        testKbId = createData.data.id
      }

      const response = await fetch(`${baseUrl}/api/knowledge-bases/${testKbId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(testKbId)
    })

    it('应该返回404对于不存在的知识库', async () => {
      const response = await fetch(
        `${baseUrl}/api/knowledge-bases/non-existent-id`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      )

      expect(response.status).toBe(404)
    })
  })
})

