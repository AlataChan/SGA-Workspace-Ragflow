/**
 * 生成图谱按钮组件
 * 调用 RAGFlow GraphRAG API 构建知识图谱
 */
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface GenerateGraphButtonProps {
  /** RAGFlow 知识库 ID */
  ragflowKbId?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 构建成功后的回调 */
  onSuccess?: () => void
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function GenerateGraphButton({
  ragflowKbId,
  disabled,
  onSuccess,
  variant = 'outline',
  size = 'sm'
}: GenerateGraphButtonProps) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  /**
   * 处理图谱构建
   */
  const handleBuild = async () => {
    if (!ragflowKbId) {
      toast.error('请先初始化私人知识库')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/ragflow/graphrag/${ragflowKbId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entity_types: ['人物', '组织', '地点', '事件', '概念', '产品', '技术']
        })
      })

      const result = await response.json()

      if (result.code === 0) {
        toast.success('图谱构建已启动，请稍后查看')
        setOpen(false)
        onSuccess?.()
      } else {
        toast.error(result.message || '图谱构建失败')
      }
    } catch (error: any) {
      console.error('[GenerateGraphButton] 错误:', error)
      toast.error('图谱构建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || !ragflowKbId}
          title={!ragflowKbId ? '请先初始化私人知识库' : '生成知识图谱'}
        >
          <Network className="w-4 h-4 mr-2" />
          生成图谱
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>生成知识图谱</DialogTitle>
          <DialogDescription>
            从您的私人知识库中提取实体和关系，构建知识图谱。
            构建过程可能需要几分钟时间。
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            将提取以下类型的实体：
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['人物', '组织', '地点', '事件', '概念', '产品', '技术'].map((type) => (
              <span
                key={type}
                className="px-2 py-1 text-xs rounded-full bg-secondary"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleBuild} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                构建中...
              </>
            ) : (
              '开始构建'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

