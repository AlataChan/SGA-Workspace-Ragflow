import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import EnhancedChatWithSidebar from '@/app/components/enhanced-chat-with-sidebar'

vi.mock('@/components/temp-kb/temp-kb-dialog', () => ({
  default: () => null,
}))

vi.mock('@/components/chat/save-knowledge-button', () => ({
  default: () => null,
}))

describe('EnhancedChatWithSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a clean new session after viewing history', async () => {
    const difyUrl = 'http://dify.test'
    const difyKey = 'test-key'
    const userId = 'user-1'

    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith(`${difyUrl}/conversations`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'conv_1', name: '会议管理制度要点', created_at: '1700000000', inputs: {} },
              { id: 'conv_2', name: '数字化项目执行管理注意要点', created_at: '1700000001', inputs: {} },
            ],
            has_more: false,
          }),
        } as any
      }

      if (url.startsWith(`${difyUrl}/messages?conversation_id=conv_1`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'm1', query: '会议管理制度要点', answer: 'answer 1', created_at: 1700000000 },
            ],
          }),
        } as any
      }

      if (url.startsWith(`${difyUrl}/messages?conversation_id=conv_2`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'm2', query: '数字化项目执行管理注意要点', answer: 'answer 2', created_at: 1700000001 },
            ],
          }),
        } as any
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    ;(global.fetch as any) = mockFetch

    const { container } = render(
      <EnhancedChatWithSidebar
        agentName="智能体"
        onBack={() => {}}
        agentConfig={{
          platform: 'DIFY',
          userId,
          difyUrl,
          difyKey,
        }}
      />
    )

    // History list loads on mount
    await waitFor(() => {
      expect(screen.getByText('会议管理制度要点')).toBeInTheDocument()
    })

    // View history session 1
    fireEvent.click(screen.getByText('会议管理制度要点'))

    await waitFor(() => {
      const userBubbles = container.querySelectorAll('.user-message')
      expect(userBubbles.length).toBeGreaterThan(0)
    })

    // View history session 2
    fireEvent.click(screen.getByText('数字化项目执行管理注意要点'))

    await waitFor(() => {
      const userBubbles = container.querySelectorAll('.user-message')
      expect(userBubbles.length).toBeGreaterThan(0)
    })

    // Create a new session: should not keep any user messages from history
    fireEvent.click(screen.getByRole('button', { name: '新对话' }))

    await waitFor(() => {
      const userBubbles = container.querySelectorAll('.user-message')
      expect(userBubbles.length).toBe(0)
    })
  })

  it('ignores stale history load after creating a new session', async () => {
    const difyUrl = 'http://dify.test'
    const difyKey = 'test-key'
    const userId = 'user-1'

    let resolveMessages: ((value: any) => void) | null = null
    const messagesPromise = new Promise((resolve) => {
      resolveMessages = resolve
    })

    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.startsWith(`${difyUrl}/conversations`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'conv_1', name: '会议管理制度要点', created_at: '1700000000', inputs: {} }],
            has_more: false,
          }),
        } as any
      }

      if (url.startsWith(`${difyUrl}/messages?conversation_id=conv_1`)) {
        // Delay the history messages so we can click "新对话" while it is in-flight.
        await messagesPromise
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ id: 'm1', query: '会议管理制度要点', answer: 'answer 1', created_at: 1700000000 }],
          }),
        } as any
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    ;(global.fetch as any) = mockFetch

    const { container } = render(
      <EnhancedChatWithSidebar
        agentName="智能体"
        onBack={() => {}}
        agentConfig={{
          platform: 'DIFY',
          userId,
          difyUrl,
          difyKey,
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('会议管理制度要点')).toBeInTheDocument()
    })

    // Start loading history conversation, then immediately create a new session.
    fireEvent.click(screen.getByText('会议管理制度要点'))
    fireEvent.click(screen.getByRole('button', { name: '新对话' }))

    // Complete the history fetch; stale results should be ignored.
    resolveMessages?.(true)

    await waitFor(() => {
      const userBubbles = container.querySelectorAll('.user-message')
      expect(userBubbles.length).toBe(0)
      expect(screen.getByText('你好！我是智能体。')).toBeInTheDocument()
    })
  })

  it('creates a clean new session after viewing RAGFlow history', async () => {
    const userId = 'user-1'
    const localAgentId = 'local-agent-1'

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      // Initial history list fetch may fall back to /api/ragflow/conversations before proxy client is ready.
      if (url.startsWith(`/api/ragflow/conversations?agent_id=${localAgentId}`)) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              { id: 'session_1', name: '会议管理制度要点', create_time: Date.now() - 1000 },
              { id: 'session_2', name: '数字化项目执行管理注意要点', create_time: Date.now() - 500 },
            ],
            has_more: false,
          }),
        } as any
      }

      // Proxy endpoints
      if (url === `/api/agents/${localAgentId}/ragflow` && init?.method === 'POST') {
        const body = JSON.parse(String(init.body ?? '{}'))
        if (body.action === 'getHistory' && body.sessionId === 'session_1') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                messages: [
                  { id: 'h1_u', role: 'user', content: '会议管理制度要点', created_at: '2024-01-01T00:00:00Z' },
                  { id: 'h1_a', role: 'assistant', content: 'answer 1', created_at: '2024-01-01T00:00:01Z' },
                ],
              },
            }),
          } as any
        }
        if (body.action === 'getHistory' && body.sessionId === 'session_2') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                messages: [
                  { id: 'h2_u', role: 'user', content: '数字化项目执行管理注意要点', created_at: '2024-01-01T00:01:00Z' },
                  { id: 'h2_a', role: 'assistant', content: 'answer 2', created_at: '2024-01-01T00:01:01Z' },
                ],
              },
            }),
          } as any
        }

        if (body.action === 'listSessions') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [
                { id: 'session_1', name: '会议管理制度要点', create_time: Date.now() - 1000 },
                { id: 'session_2', name: '数字化项目执行管理注意要点', create_time: Date.now() - 500 },
              ],
            }),
          } as any
        }
      }

      // Local Prisma reference lookup (optional in app; safe empty here)
      if (url === `/api/chat-sessions/${encodeURIComponent('session_1')}/messages`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as any
      }
      if (url === `/api/chat-sessions/${encodeURIComponent('session_2')}/messages`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [] }),
        } as any
      }

      throw new Error(`Unexpected fetch: ${url}`)
    })

    ;(global.fetch as any) = mockFetch

    const { container } = render(
      <EnhancedChatWithSidebar
        agentName="智能体"
        onBack={() => {}}
        agentConfig={{
          platform: 'RAGFLOW',
          userId,
          localAgentId,
          // Provide baseUrl/apiKey to satisfy history bootstrapping conditions.
          baseUrl: 'http://ragflow.test',
          apiKey: 'test-key',
          agentId: 'ragflow-agent-id',
        }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('会议管理制度要点')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('会议管理制度要点'))
    await waitFor(() => {
      const userBubbles = container.querySelectorAll('.user-message')
      expect(userBubbles.length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByText('数字化项目执行管理注意要点'))
    await waitFor(() => {
      const userBubbles = container.querySelectorAll('.user-message')
      expect(userBubbles.length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: '新对话' }))

    await waitFor(() => {
      const userBubbles = container.querySelectorAll('.user-message')
      expect(userBubbles.length).toBe(0)
    })
  })
})
