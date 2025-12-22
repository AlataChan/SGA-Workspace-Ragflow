/**
 * 添加到知识库按钮组件
 * 将聊天内容添加到用户私人知识库
 */
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { BookmarkPlus, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface AddToKBButtonProps {
  /** 要添加的内容 */
  content: string
  /** 默认标题 */
  defaultTitle?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 添加成功后的回调 */
  onSuccess?: () => void
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** 是否显示文字 */
  showLabel?: boolean
}

export function AddToKBButton({
  content,
  defaultTitle,
  disabled,
  onSuccess,
  variant = 'ghost',
  size = 'icon',
  showLabel = false
}: AddToKBButtonProps) {
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(defaultTitle || '')
  const [editedContent, setEditedContent] = useState(content)

  /**
   * 处理添加到知识库
   */
  const handleAdd = async () => {
    if (!editedContent.trim()) {
      toast.error('内容不能为空')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/ragflow/user-kb/add-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editedContent,
          title: title || `对话提取_${new Date().toLocaleString()}`
        })
      })

      const result = await response.json()

      if (result.code === 0) {
        toast.success('已添加到私人知识库')
        setAdded(true)
        setOpen(false)
        onSuccess?.()
      } else {
        toast.error(result.message || '添加失败')
      }
    } catch (error: any) {
      console.error('[AddToKBButton] 错误:', error)
      toast.error('添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 打开编辑对话框
   */
  const handleOpenDialog = () => {
    setEditedContent(content)
    setTitle(defaultTitle || '')
    setOpen(true)
  }

  // 已添加状态
  if (added) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={variant} size={size} disabled className="text-green-600">
              <Check className="w-4 h-4" />
              {showLabel && <span className="ml-2">已添加</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>已添加到私人知识库</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size}
              disabled={disabled || loading}
              onClick={handleOpenDialog}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BookmarkPlus className="w-4 h-4" />
              )}
              {showLabel && <span className="ml-2">添加到知识库</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>添加到私人知识库</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加到私人知识库</DialogTitle>
            <DialogDescription>
              您可以编辑内容和标题后再添加到知识库
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入标题（可选）"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">内容</Label>
              <Textarea
                id="content"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                rows={8}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={loading || !editedContent.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  添加中...
                </>
              ) : (
                '确认添加'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

