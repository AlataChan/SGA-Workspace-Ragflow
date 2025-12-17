"use client"

import React, { useCallback, useState } from "react"
import { Upload, X, FileText, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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

interface UploadingFile {
  file: File
  progress: number
  status: 'uploading' | 'success' | 'error'
  error?: string
  docId?: string
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
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return `不支持的文件类型: ${file.type}`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `文件大小超过限制 (最大100MB)`
    }
    return null
  }

  const uploadFile = async (file: File) => {
    const uploadingFile: UploadingFile = {
      file,
      progress: 0,
      status: 'uploading',
    }

    setUploadingFiles((prev) => [...prev, uploadingFile])

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('run', autoRun ? '1' : '0')

      const response = await fetch(`/api/knowledge-bases/${kbId}/documents`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '上传失败')
      }

      const data = await response.json()
      const docId = data.data?.id

      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, progress: 100, status: 'success', docId }
            : f
        )
      )

      toast.success(`${file.name} 上传成功`)
      onUploadSuccess?.(docId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '上传失败'
      
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.file === file
            ? { ...f, status: 'error', error: errorMessage }
            : f
        )
      )

      toast.error(`${file.name} 上传失败: ${errorMessage}`)
      onUploadError?.(errorMessage)
    }
  }

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return

      const fileArray = Array.from(files)

      for (const file of fileArray) {
        const error = validateFile(file)
        if (error) {
          toast.error(`${file.name}: ${error}`)
          continue
        }

        uploadFile(file)
      }
    },
    [kbId, autoRun]
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

  const removeFile = (file: File) => {
    setUploadingFiles((prev) => prev.filter((f) => f.file !== file))
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
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">上传列表</h4>
          {uploadingFiles.map((uploadingFile, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {uploadingFile.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                </p>

                {uploadingFile.status === 'uploading' && (
                  <div className="mt-2">
                    <Progress value={uploadingFile.progress} className="h-1" />
                  </div>
                )}

                {uploadingFile.status === 'error' && uploadingFile.error && (
                  <p className="text-xs text-destructive mt-1">
                    {uploadingFile.error}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {uploadingFile.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                )}

                {uploadingFile.status === 'success' && (
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

                {uploadingFile.status === 'error' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadingFile.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


