import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, clientState, RAGFlowTempKbClientMock } = vi.hoisted(() => {
  const prismaMock = {
    user: { findUnique: vi.fn() },
    userSavedChunk: { findMany: vi.fn(), update: vi.fn() },
    userTempKnowledgeBase: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  }

  const clientState = {
    instances: [] as any[],
    behaviors: [] as Array<Record<string, any>>,
  }

  class RAGFlowTempKbClientMock {
    config: any
    checkDatasetAccess: any
    createDataset: any
    createVirtualDocument: any
    addChunk: any

    constructor(config: any) {
      this.config = config
      clientState.instances.push(this)

      const behavior = clientState.behaviors.shift() || {}
      this.checkDatasetAccess = vi.fn().mockResolvedValue(
        behavior.checkDatasetAccess ?? { success: true, data: { owned: true } },
      )
      this.createDataset = vi.fn().mockResolvedValue(behavior.createDataset)
      this.createVirtualDocument = vi.fn().mockResolvedValue(behavior.createVirtualDocument)
      this.addChunk = vi.fn().mockResolvedValue(behavior.addChunk)
    }
  }

  return { prismaMock, clientState, RAGFlowTempKbClientMock }
})

vi.mock("@/lib/prisma", () => ({ default: prismaMock }))
vi.mock("@/lib/ragflow-temp-kb-client", () => ({ RAGFlowTempKbClient: RAGFlowTempKbClientMock }))

describe("TempKbService.getOrCreateTempKb", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    clientState.instances.length = 0
    clientState.behaviors.length = 0
  })

  it("rebuilds dataset when existing dataset is not owned", async () => {
    const now = new Date("2026-03-04T00:00:00Z")
    const tempKb = {
      id: "tkb1",
      userId: "u1",
      ragflowKbId: "old_kb",
      ragflowDocId: "old_doc",
      ragflowUrl: "http://ragflow:9380",
      apiKey: "rk",
      status: "ACTIVE",
      chunkCount: 2,
      nodeCount: 1,
      edgeCount: 1,
      lastActiveAt: now,
      createdAt: now,
    }

    prismaMock.userTempKnowledgeBase.findUnique.mockResolvedValue(tempKb)
    prismaMock.user.findUnique.mockResolvedValue({ username: "admin", chineseName: "张三" })
    prismaMock.userSavedChunk.findMany.mockResolvedValue([
      { id: "c1", content: "hello", keywords: [] },
      { id: "c2", content: "world", keywords: ["k"] },
    ])

    prismaMock.userSavedChunk.update.mockResolvedValue({})
    prismaMock.userTempKnowledgeBase.update.mockImplementation(async ({ data }: any) => ({
      ...tempKb,
      ...data,
    }))

    clientState.behaviors.push(
      { checkDatasetAccess: { success: true, data: { owned: false }, error: "not owned" } },
      {
        createDataset: { success: true, data: { id: "new_kb", name: "n" } },
        createVirtualDocument: { success: true, data: { documentId: "new_doc" } },
        addChunk: { success: true, data: { chunkId: "chunk1" } },
      },
    )

    const { TempKbService } = await import("@/lib/services/temp-kb-service")
    const service = new TempKbService()

    const res = await service.getOrCreateTempKb("u1")

    expect(res.success).toBe(true)
    expect(res.data?.ragflowKbId).toBe("new_kb")

    expect(clientState.instances).toHaveLength(2)
    expect(clientState.instances[1].createDataset).toHaveBeenCalledTimes(1)
    expect(clientState.instances[1].addChunk).toHaveBeenCalledTimes(2)

    expect(prismaMock.userTempKnowledgeBase.update).toHaveBeenCalled()
    const lastUpdate = prismaMock.userTempKnowledgeBase.update.mock.calls.at(-1)?.[0]
    expect(lastUpdate.data.ragflowKbId).toBe("new_kb")
    expect(lastUpdate.data.ragflowDocId).toBe("new_doc")
    expect(lastUpdate.data.chunkCount).toBe(2)
    expect(lastUpdate.data.nodeCount).toBe(0)
    expect(lastUpdate.data.edgeCount).toBe(0)
  })

  it("reuses existing dataset when owned", async () => {
    const now = new Date("2026-03-04T00:00:00Z")
    const tempKb = {
      id: "tkb1",
      userId: "u1",
      ragflowKbId: "kb1",
      ragflowDocId: "doc1",
      ragflowUrl: "http://ragflow:9380",
      apiKey: "rk",
      status: "ACTIVE",
      chunkCount: 0,
      nodeCount: 0,
      edgeCount: 0,
      lastActiveAt: now,
      createdAt: now,
    }

    prismaMock.userTempKnowledgeBase.findUnique.mockResolvedValue(tempKb)
    prismaMock.userTempKnowledgeBase.update.mockImplementation(async ({ data }: any) => ({
      ...tempKb,
      ...data,
    }))

    clientState.behaviors.push({ checkDatasetAccess: { success: true, data: { owned: true } } })

    const { TempKbService } = await import("@/lib/services/temp-kb-service")
    const service = new TempKbService()

    const res = await service.getOrCreateTempKb("u1")

    expect(res.success).toBe(true)
    expect(res.data?.ragflowKbId).toBe("kb1")
    expect(clientState.instances).toHaveLength(1)
    expect(clientState.instances[0].createDataset).not.toHaveBeenCalled()
  })
})

