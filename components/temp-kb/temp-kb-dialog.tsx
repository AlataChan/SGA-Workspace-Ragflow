"use client"

import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Database, BookMarked } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import TempKbPanel from './temp-kb-panel'

interface TempKbDialogProps {
  /** 触发器变体 */
  variant?: 'default' | 'sidebar' | 'minimal'
  /** 额外的类名 */
  className?: string
}

/**
 * 临时知识库对话框组件
 * 提供一个按钮打开知识库面板
 */
export default function TempKbDialog({
  variant = 'default',
  className
}: TempKbDialogProps) {
  const [open, setOpen] = useState(false)
  const [chunkCount, setChunkCount] = useState(0)

  // 监听知识库变化
  const handleKbChange = (info: { chunkCount: number }) => {
    setChunkCount(info.chunkCount)
  }

  const renderTrigger = () => {
    switch (variant) {
      case 'sidebar':
        return (
          <Button
            variant="ghost"
            className="w-full justify-start text-blue-200 hover:text-white hover:bg-blue-500/10 px-3 py-2"
          >
            <BookMarked className="w-4 h-4 mr-2" />
            我的知识库
            {chunkCount > 0 && (
              <Badge variant="secondary" className="ml-auto text-xs">
                {chunkCount}
              </Badge>
            )}
          </Button>
        )
      case 'minimal':
        return (
          <Button
            variant="ghost"
            size="icon"
            className="text-blue-200 hover:text-white hover:bg-blue-500/10"
          >
            <Database className="w-4 h-4" />
          </Button>
        )
      default:
        return (
          <Button variant="outline" className={className}>
            <Database className="w-4 h-4 mr-2" />
            我的知识库
            {chunkCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {chunkCount}
              </Badge>
            )}
          </Button>
        )
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {renderTrigger()}
      </DialogTrigger>
      <DialogContent className="max-w-2xl h-[92vh] flex flex-col bg-slate-900 border border-slate-600 p-0">
        <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-white">
            <Database className="w-5 h-5 text-blue-400" />
            我的知识库
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden px-5 pb-4">
          <TempKbPanel
            className="border-0 shadow-none h-full"
            onKbChange={handleKbChange}
            compact
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

