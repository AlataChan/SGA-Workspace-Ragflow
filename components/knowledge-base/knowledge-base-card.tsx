"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreVertical, Edit, Trash2, Database, FileText, Calendar } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * 知识库卡片组件
 * 
 * 用于展示单个知识库的信息，包括名称、描述、统计数据和操作按钮
 */

interface KnowledgeBaseCardProps {
  /** 知识库ID */
  id: string
  /** 知识库名称 */
  name: string
  /** 知识库描述 */
  description?: string
  /** 是否激活 */
  isActive: boolean
  /** 文档数量 */
  documentCount?: number
  /** 节点数量 */
  nodeCount?: number
  /** 边数量 */
  edgeCount?: number
  /** 最后同步时间 */
  lastSyncAt?: Date | string
  /** 创建时间 */
  createdAt: Date | string
  /** 点击卡片时的回调 */
  onClick?: () => void
  /** 编辑回调 */
  onEdit?: () => void
  /** 删除回调 */
  onDelete?: () => void
}

export function KnowledgeBaseCard({
  id: _id,
  name,
  description,
  isActive,
  documentCount = 0,
  nodeCount = 0,
  edgeCount: _edgeCount = 0,
  lastSyncAt,
  createdAt,
  onClick,
  onEdit,
  onDelete,
}: KnowledgeBaseCardProps) {
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  const formatDateTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{name}</CardTitle>
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? "激活" : "未激活"}
              </Badge>
            </div>
            {description && (
              <CardDescription className="mt-1.5 line-clamp-2">
                {description}
              </CardDescription>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.()
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                编辑
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.()
                }}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{documentCount}</div>
              <div className="text-xs text-muted-foreground">文档</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{nodeCount}</div>
              <div className="text-xs text-muted-foreground">节点</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium text-xs">{formatDate(createdAt)}</div>
              <div className="text-xs text-muted-foreground">创建</div>
            </div>
          </div>
        </div>
        
        {lastSyncAt && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            最后同步: {formatDateTime(lastSyncAt)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

