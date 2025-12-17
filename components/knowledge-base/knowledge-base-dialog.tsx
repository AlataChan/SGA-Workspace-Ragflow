"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

/**
 * 知识库创建/编辑对话框
 */

interface KnowledgeBaseDialogProps {
  /** 是否打开 */
  open: boolean
  /** 关闭回调 */
  onOpenChange: (open: boolean) => void
  /** 编辑模式的知识库数据 */
  knowledgeBase?: {
    id: string
    name: string
    description?: string
    isActive: boolean
  }
  /** 成功回调 */
  onSuccess?: () => void
}

interface FormData {
  name: string
  description: string
  isActive: boolean
}

export function KnowledgeBaseDialog({
  open,
  onOpenChange,
  knowledgeBase,
  onSuccess,
}: KnowledgeBaseDialogProps) {
  const isEditMode = !!knowledgeBase

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    isActive: true,
  })
  const [isLoading, setIsLoading] = useState(false)

  // 编辑模式时填充表单
  useEffect(() => {
    if (knowledgeBase) {
      setFormData({
        name: knowledgeBase.name,
        description: knowledgeBase.description || "",
        isActive: knowledgeBase.isActive,
      })
    } else {
      setFormData({
        name: "",
        description: "",
        isActive: true,
      })
    }
  }, [knowledgeBase, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("请输入知识库名称")
      return
    }

    setIsLoading(true)

    try {
      const url = isEditMode
        ? `/api/knowledge-bases/${knowledgeBase.id}`
        : `/api/knowledge-bases`

      const method = isEditMode ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isActive: formData.isActive,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "操作失败")
      }

      toast.success(isEditMode ? "知识库更新成功" : "知识库创建成功")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "操作失败"
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "编辑知识库" : "创建知识库"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "修改知识库的基本信息"
                : "创建一个新的知识库，用于存储和管理文档"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="输入知识库名称"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={100}
                required
              />
              <p className="text-xs text-muted-foreground">
                {formData.name.length}/100
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                placeholder="输入知识库描述（可选）"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {formData.description.length}/500
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">激活状态</Label>
                <p className="text-xs text-muted-foreground">
                  激活后可以使用此知识库
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


