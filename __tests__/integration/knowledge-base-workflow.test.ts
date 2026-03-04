import { describe, it, expect, beforeAll, afterAll } from 'vitest'

/**
 * 知识库管理完整工作流集成测试
 * 
 * 测试从创建知识库到上传文档、解析、删除的完整流程
 *
 * 注意：该用例依赖本地服务（默认 http://localhost:3000）和可用的认证/数据源。
 * 默认不在单元测试套件中执行；如需运行请设置环境变量 RUN_INTEGRATION_TESTS=1。
 */

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(process.env.RUN_INTEGRATION_TESTS === '1')('Knowledge Base Workflow Integration Test', () => {
  const baseUrl = 'http://localhost:3000'
  let authToken: string
  let kbId: string
  let docId: string

  beforeAll(async () => {
    // 模拟登录获取token
    authToken = 'test-token'
  })

  afterAll(async () => {
    // 清理测试数据
    if (docId && kbId) {
      try {
        await fetch(`${baseUrl}/api/knowledge-bases/${kbId}/documents/${docId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
      } catch (error) {
        console.error('清理文档失败:', error)
      }
    }

    if (kbId) {
      try {
        await fetch(`${baseUrl}/api/knowledge-bases/${kbId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        })
      } catch (error) {
        console.error('清理知识库失败:', error)
      }
    }
  })

  it('完整工作流: 创建 → 上传 → 解析 → 删除', async () => {
    // 步骤1: 创建知识库
    console.log('步骤1: 创建知识库')
    const createResponse = await fetch(`${baseUrl}/api/knowledge-bases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Integration Test KB',
        description: 'This is an integration test knowledge base',
        isActive: true,
      }),
    })

    expect(createResponse.status).toBe(200)
    const createData = await createResponse.json()
    expect(createData.success).toBe(true)
    expect(createData.data).toHaveProperty('id')
    
    kbId = createData.data.id
    console.log(`✅ 知识库创建成功: ${kbId}`)

    // 步骤2: 验证知识库详情
    console.log('步骤2: 验证知识库详情')
    const detailResponse = await fetch(`${baseUrl}/api/knowledge-bases/${kbId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    })

    expect(detailResponse.status).toBe(200)
    const detailData = await detailResponse.json()
    expect(detailData.data.name).toBe('Integration Test KB')
    console.log('✅ 知识库详情验证成功')

    // 步骤3: 上传文档
    console.log('步骤3: 上传文档')
    const formData = new FormData()
    const testFile = new File(['Test content'], 'test.txt', { type: 'text/plain' })
    formData.append('file', testFile)
    formData.append('run', '1')

    const uploadResponse = await fetch(
      `${baseUrl}/api/knowledge-bases/${kbId}/documents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      }
    )

    expect(uploadResponse.status).toBe(200)
    const uploadData = await uploadResponse.json()
    expect(uploadData.success).toBe(true)
    expect(uploadData.data).toHaveProperty('id')
    
    docId = uploadData.data.id
    console.log(`✅ 文档上传成功: ${docId}`)

    // 步骤4: 查询文档列表
    console.log('步骤4: 查询文档列表')
    const listResponse = await fetch(
      `${baseUrl}/api/knowledge-bases/${kbId}/documents`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    )

    expect(listResponse.status).toBe(200)
    const listData = await listResponse.json()
    expect(listData.success).toBe(true)
    expect(Array.isArray(listData.data)).toBe(true)
    expect(listData.data.length).toBeGreaterThan(0)
    console.log(`✅ 文档列表查询成功: ${listData.data.length} 个文档`)

    // 步骤5: 查询解析状态
    console.log('步骤5: 查询解析状态')
    const statusResponse = await fetch(
      `${baseUrl}/api/knowledge-bases/${kbId}/documents/${docId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    )

    expect(statusResponse.status).toBe(200)
    const statusData = await statusResponse.json()
    expect(statusData.success).toBe(true)
    expect(statusData.data).toHaveProperty('status')
    expect([0, 1, 2]).toContain(statusData.data.status) // 0=等待, 1=完成, 2=失败
    console.log(`✅ 解析状态查询成功: ${statusData.data.status}`)

    // 步骤6: 删除文档
    console.log('步骤6: 删除文档')
    const deleteDocResponse = await fetch(
      `${baseUrl}/api/knowledge-bases/${kbId}/documents/${docId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      }
    )

    expect(deleteDocResponse.status).toBe(200)
    const deleteDocData = await deleteDocResponse.json()
    expect(deleteDocData.success).toBe(true)
    console.log('✅ 文档删除成功')

    // 步骤7: 删除知识库
    console.log('步骤7: 删除知识库')
    const deleteKbResponse = await fetch(`${baseUrl}/api/knowledge-bases/${kbId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    })

    expect(deleteKbResponse.status).toBe(200)
    const deleteKbData = await deleteKbResponse.json()
    expect(deleteKbData.success).toBe(true)
    console.log('✅ 知识库删除成功')

    console.log('🎉 完整工作流测试通过！')
  })
})
