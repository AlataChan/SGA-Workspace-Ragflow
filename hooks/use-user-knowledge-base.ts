/**
 * 用户私人知识库 Hook
 * 提供知识库状态管理和常用操作
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface UserKnowledgeBase {
  id: string
  ragflowKbId: string
  ragflowKbName: string | null
  ragflowDialogId: string | null
  isDefault: boolean
  isTemporary?: boolean
  mode?: 'temporary' | 'persistent'
}

interface UseUserKnowledgeBaseReturn {
  /** 知识库数据 */
  knowledgeBase: UserKnowledgeBase | null
  /** 是否正在加载 */
  loading: boolean
  /** 错误信息 */
  error: string | null
  /** 是否已初始化 */
  initialized: boolean
  /** 当前模式 */
  mode: 'temporary' | 'persistent'
  /** 初始化知识库 */
  initialize: (sessionId?: string) => Promise<boolean>
  /** 刷新数据 */
  refresh: () => Promise<void>
  /** 同步 Dialog */
  syncDialog: () => Promise<boolean>
  /** 清理临时知识库 */
  cleanup: (sessionId?: string) => Promise<boolean>
}

/**
 * 用户私人知识库 Hook
 */
export function useUserKnowledgeBase(): UseUserKnowledgeBaseReturn {
  const [knowledgeBase, setKnowledgeBase] = useState<UserKnowledgeBase | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const [mode, setMode] = useState<'temporary' | 'persistent'>('persistent')

  /**
   * 获取知识库信息
   */
  const fetchKnowledgeBase = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/ragflow/user-kb/init')
      const result = await response.json()

      if (result.code === 0 && result.data) {
        setKnowledgeBase(result.data)
        setInitialized(true)
        if (result.data.mode) setMode(result.data.mode)
      } else if (result.code === 404) {
        setKnowledgeBase(null)
        setInitialized(false)
      } else {
        setError(result.message || '获取知识库信息失败')
      }
    } catch (err: any) {
      setError(err.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 初始化知识库
   * @param sessionId 会话ID（临时模式下使用）
   */
  const initialize = useCallback(async (sessionId?: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/ragflow/user-kb/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      })
      const result = await response.json()

      if (result.code === 0 && result.data) {
        setKnowledgeBase(result.data)
        setInitialized(true)
        if (result.data.mode) setMode(result.data.mode)
        toast.success('私人知识库创建成功')
        return true
      } else {
        setError(result.message || '初始化失败')
        toast.error(result.message || '初始化失败')
        return false
      }
    } catch (err: any) {
      setError(err.message || '网络错误')
      toast.error('初始化失败，请重试')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 清理临时知识库
   * @param sessionId 会话ID（可选）
   */
  const cleanup = useCallback(async (sessionId?: string): Promise<boolean> => {
    try {
      const url = sessionId
        ? `/api/ragflow/user-kb/cleanup?sessionId=${sessionId}`
        : '/api/ragflow/user-kb/cleanup'

      const response = await fetch(url, { method: 'DELETE' })
      const result = await response.json()

      if (result.code === 0) {
        if (result.data.cleaned > 0) {
          setKnowledgeBase(null)
          setInitialized(false)
          toast.success(`已清理 ${result.data.cleaned} 个临时知识库`)
        }
        return true
      } else {
        toast.error(result.message || '清理失败')
        return false
      }
    } catch {
      toast.error('清理失败，请重试')
      return false
    }
  }, [])

  /**
   * 同步 Dialog（多知识库检索配置）
   */
  const syncDialog = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/ragflow/dialog/sync', {
        method: 'POST'
      })
      const result = await response.json()

      if (result.code === 0) {
        // 刷新知识库数据以获取新的 dialogId
        await fetchKnowledgeBase()
        toast.success('检索配置同步成功')
        return true
      } else {
        toast.error(result.message || '同步失败')
        return false
      }
    } catch (err: any) {
      toast.error('同步失败，请重试')
      return false
    }
  }, [fetchKnowledgeBase])

  /**
   * 刷新数据
   */
  const refresh = useCallback(async () => {
    await fetchKnowledgeBase()
  }, [fetchKnowledgeBase])

  // 组件挂载时获取数据
  useEffect(() => {
    fetchKnowledgeBase()
  }, [fetchKnowledgeBase])

  return {
    knowledgeBase,
    loading,
    error,
    initialized,
    mode,
    initialize,
    refresh,
    syncDialog,
    cleanup
  }
}

