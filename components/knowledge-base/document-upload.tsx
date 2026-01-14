"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Upload, X, FileText, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { nanoid } from "nanoid"
import { useTaskStore } from "@/app/store/task"
import { useTaskQueue } from "@/lib/task-queue"
import {
  calculateTaskProgress,
  getTaskStatusText,
  isFinalTaskStatus,
  type Task,
} from "@/lib/types/task"

/**
 * 文档上传组件
 * 
 * 支持拖拽上传、批量上传、进度显示
 */

interface DocumentUploadProps {
  /** 知识库ID */
  kbId: string
  /** 是否立即触发解析 */
  autoRun?: boolean
  /** 上传成功回调 */
  onUploadSuccess?: (docId: string) => void
  /** 上传失败回调 */
  onUploadError?: (error: string) => void
  /** 自定义类名 */
  className?: string
}

// 支持的文件类型
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
]

// 文件大小限制 (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024

export function DocumentUpload({
  kbId,
  autoRun = true,
  onUploadSuccess,
  onUploadError,
  className,
}: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [taskIds, setTaskIds] = useState<string[]>([])

  const tasks = useTaskStore((s) => s.tasks)
  const removeTask = useTaskStore((s) => s.removeTask)
  const taskQueue = useMemo(() => useTaskQueue(), [])

  const notifiedSuccessRef = useRef(new Set<string>())
  const notifiedErrorRef = useRef(new Set<string>())

  const localTasks = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]))
    return taskIds
      .map((id) => byId.get(id))
      .filter((t): t is Task => Boolean(t))
  }, [taskIds, tasks])

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return `不支持的文件类型: ${file.type}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件大小超过限制 (最大100MB)`
    }
    return null
  }

  useEffect(() => {
    for (const task of localTasks) {
      if (task.type !== "kb.uploadDocument") continue

      const fileName = String(task.input?.fileName || task.title || "文件")
      const docId = task.output?.docId as string | undefined

      // 上传成功：一旦拿到 docId 即回调（不等待解析完成）
      if (docId && !notifiedSuccessRef.current.has(task.id)) {
        notifiedSuccessRef.current.add(task.id)
        toast.success(`${fileName} 上传成功`)
        onUploadSuccess?.(docId)
      }

      // 上传失败：只在没有 docId 时才认为是“上传失败”
      if (
        task.status === "failed" &&
        !docId &&
        !notifiedErrorRef.current.has(task.id)
      ) {
        notifiedErrorRef.current.add(task.id)
        const msg = task.error?.message || "上传失败"
        toast.error(`${fileName} 上传失败: ${msg}`)
        onUploadError?.(msg)
      }
    }
  }, [localTasks, onUploadError, onUploadSuccess])

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      const fileArray = Array.from(files).sort((a, b) => a.size - b.size)
      const groupId = nanoid()
      const newTasks: Task[] = []
      const runtimeFiles: Record<string, File> = {}

      for (const file of fileArray) {
        const error = validateFile(file)
        if (error) {
          toast.error(`${file.name}: ${error}`)
          continue
        }

        const taskId = nanoid()
        const task: Task = {
          id: taskId,
          groupId,
          type: "kb.uploadDocument",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          title: `上传 ${file.name}`,
          input: {
            kbId,
            autoRun,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          },
          progress: { uploadProgress: 0, parseProgress: 0, totalProgress: 0 },
        }

        newTasks.push(task)
        runtimeFiles[taskId] = file
      }

      if (newTasks.length > 0) {
        taskQueue.addTasks(newTasks, runtimeFiles)
        setTaskIds((prev) => [...prev, ...newTasks.map((t) => t.id)])
        toast.success(`已添加 ${newTasks.length} 个文件到上传队列`)
      }
    },
    [kbId, autoRun, taskQueue]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files)
      // 重置input，允许上传相同文件
      e.target.value = ''
    },
    [handleFiles]
  )

  const removeLocalTask = (taskId: string) => {
    taskQueue.cancelTask(taskId)
    removeTask(taskId)
    setTaskIds((prev) => prev.filter((id) => id !== taskId))
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* 拖拽上传区域 */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm font-medium mb-1">
          拖拽文件到这里，或点击选择文件
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          支持 PDF, DOCX, DOC, TXT, MD 格式，最大 100MB
        </p>
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md"
          onChange={handleFileInput}
        />
        <Button asChild variant="outline">
          <label htmlFor="file-upload" className="cursor-pointer">
            选择文件
          </label>
        </Button>
      </div>

      {/* 上传列表 */}
      {localTasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">上传队列</h4>
          {localTasks.map((task) => {
            const fileName = String(task.input?.fileName || task.title || "文件")
            const fileSize = Number(task.input?.fileSize || 0)
            const pct = calculateTaskProgress(task)
            const isFinal = isFinalTaskStatus(task.status)

            return (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(fileSize / 1024 / 1024).toFixed(2)} MB
                </p>

                {!isFinal && (
                  <div className="mt-2">
                    <Progress value={pct} className="h-1" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getTaskStatusText(task.status)} · {pct}%
                    </p>
                  </div>
                )}

                {task.status === "failed" && task.error?.message && (
                  <p className="text-xs text-destructive mt-1">
                    {task.error.message}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {(task.status === "pending" || task.status === "running") && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}

                {task.status === "succeeded" && (
                  <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}

                {task.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => taskQueue.retryTask(task.id)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}

                {isFinal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLocalTask(task.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
