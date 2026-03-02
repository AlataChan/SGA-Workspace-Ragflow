import { describe, it, expect, beforeEach, vi } from 'vitest'

const { prismaMock, verifyUserAuthMock, verifyAdminAuthMock } = vi.hoisted(() => ({
  prismaMock: {
    knowledgeGraph: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
  verifyUserAuthMock: vi.fn(),
  verifyAdminAuthMock: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ default: prismaMock }))
vi.mock('@/lib/auth', () => ({
  verifyUserAuth: verifyUserAuthMock,
  verifyAdminAuth: verifyAdminAuthMock,
}))

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

describe('Knowledge Base API (route handlers)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.fetch = vi.fn()
  })

  it('GET /api/knowledge-bases returns 401 when unauthenticated', async () => {
    verifyUserAuthMock.mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/knowledge-bases/route')
    const response = await GET(new Request('http://test.local/api/knowledge-bases') as any)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: '未授权' })
  })

  it('GET /api/knowledge-bases returns list when authenticated', async () => {
    verifyUserAuthMock.mockResolvedValueOnce({
      id: 'user-1',
      userId: 'user-1',
      username: 'test',
      companyId: 'company-1',
      role: 'USER',
    })

    prismaMock.knowledgeGraph.findMany.mockResolvedValueOnce([
      {
        id: 'kb-1',
        name: 'KB One',
        description: 'desc',
        kbId: 'ragflow-kb-1',
        ragflowUrl: 'http://ragflow.test',
        nodeCount: 1,
        edgeCount: 2,
        lastSyncAt: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      },
    ])

    const { GET } = await import('@/app/api/knowledge-bases/route')
    const response = await GET(new Request('http://test.local/api/knowledge-bases') as any)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data).toHaveLength(1)
    expect(data.data[0].id).toBe('kb-1')
  })

  it('POST /api/knowledge-bases returns 401 when not admin', async () => {
    verifyAdminAuthMock.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/knowledge-bases/route')
    const response = await POST(
      new Request('http://test.local/api/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'KB',
          ragflowUrl: 'http://ragflow.test',
          apiKey: 'test-key',
        }),
      }) as any
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: '未授权，需要管理员权限' })
  })

  it('POST /api/knowledge-bases returns 400 for invalid payload', async () => {
    verifyAdminAuthMock.mockResolvedValueOnce({
      id: 'admin-1',
      userId: 'admin-1',
      username: 'admin',
      companyId: 'company-1',
      role: 'ADMIN',
    })

    const { POST } = await import('@/app/api/knowledge-bases/route')
    const response = await POST(
      new Request('http://test.local/api/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '',
          ragflowUrl: 'not-a-url',
          apiKey: '',
        }),
      }) as any
    )

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('数据验证失败')
    expect(data.details).toBeDefined()
  })

  it('POST /api/knowledge-bases creates a knowledge base when valid', async () => {
    verifyAdminAuthMock.mockResolvedValueOnce({
      id: 'admin-1',
      userId: 'admin-1',
      username: 'admin',
      companyId: 'company-1',
      role: 'ADMIN',
    })

    prismaMock.knowledgeGraph.findFirst
      .mockResolvedValueOnce(null) // name uniqueness check
      .mockResolvedValueOnce({ sortOrder: 5 }) // max sortOrder

    ;(globalThis.fetch as any).mockResolvedValueOnce(
      jsonResponse({
        retcode: 0,
        data: { id: 'ragflow-kb-123' },
      })
    )

    prismaMock.knowledgeGraph.create.mockResolvedValueOnce({
      id: 'kb-1',
      companyId: 'company-1',
      name: 'KB One',
      description: 'desc',
      ragflowUrl: 'http://ragflow.test',
      apiKey: 'test-key',
      kbId: 'ragflow-kb-123',
      sortOrder: 6,
      company: { name: 'Test Company' },
    })

    const { POST } = await import('@/app/api/knowledge-bases/route')
    const response = await POST(
      new Request('http://test.local/api/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'KB One',
          description: 'desc',
          ragflowUrl: 'http://ragflow.test',
          apiKey: 'test-key',
        }),
      }) as any
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('kb-1')
    expect(data.data.kbId).toBe('ragflow-kb-123')
    expect(data.message).toBe('知识库创建成功')
  })

  it('GET /api/knowledge-bases/[id] returns 404 when missing', async () => {
    verifyUserAuthMock.mockResolvedValueOnce({
      id: 'user-1',
      userId: 'user-1',
      username: 'test',
      companyId: 'company-1',
      role: 'USER',
    })

    prismaMock.knowledgeGraph.findFirst.mockResolvedValueOnce(null)

    const { GET } = await import('@/app/api/knowledge-bases/[id]/route')
    const response = await GET(
      new Request('http://test.local/api/knowledge-bases/kb-missing') as any,
      { params: Promise.resolve({ id: 'kb-missing' }) } as any
    )

    expect(response.status).toBe(404)
    const data = await response.json()
    expect(data.error).toBe('知识库不存在或已禁用')
  })

  it('GET /api/knowledge-bases/[id] returns detail when present', async () => {
    verifyUserAuthMock.mockResolvedValueOnce({
      id: 'user-1',
      userId: 'user-1',
      username: 'test',
      companyId: 'company-1',
      role: 'USER',
    })

    prismaMock.knowledgeGraph.findFirst.mockResolvedValueOnce({
      id: 'kb-1',
      companyId: 'company-1',
      name: 'KB One',
      description: 'desc',
      ragflowUrl: 'http://ragflow.test',
      apiKey: 'test-key',
      kbId: 'ragflow-kb-123',
      isActive: true,
      company: { name: 'Test Company' },
    })

    ;(globalThis.fetch as any).mockResolvedValueOnce(
      jsonResponse({
        retcode: 0,
        data: { id: 'ragflow-kb-123', name: 'RAGFlow KB' },
      })
    )

    const { GET } = await import('@/app/api/knowledge-bases/[id]/route')
    const response = await GET(
      new Request('http://test.local/api/knowledge-bases/kb-1') as any,
      { params: Promise.resolve({ id: 'kb-1' }) } as any
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.id).toBe('kb-1')
    expect(data.data.ragflowDetail.id).toBe('ragflow-kb-123')
  })
})

