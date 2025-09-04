"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Upload,
  File,
  Image,
  FileText,
  X,
  Check,
  AlertCircle,
  Loader2,
  Download,
  Eye
} from "lucide-react"
import { cn } from "@/lib/utils"
import { logger } from "@/lib/utils/logger"

export interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  url: string
  status: "uploading" | "completed" | "error"
  progress: number
  error?: string
  preview?: string
}

interface FileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void
  maxFiles?: number
  maxSize?: number // MB
  acceptedTypes?: string[]
  className?: string
  disabled?: boolean
}

const DEFAULT_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png", 
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
]

export default function FileUpload({
  onFilesUploaded,
  maxFiles = 5,
  maxSize = 10, // 10MB
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  className,
  disabled = false
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 获取文件图标
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4" />
    if (type === "application/pdf") return <FileText className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // 验证文件
  const validateFile = (file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return "不支持的文件类型"
    }
    if (file.size > maxSize * 1024 * 1024) {
      return `文件大小超过 ${maxSize}MB 限制`
    }
    return null
  }

  // 生成文件预览
  const generatePreview = async (file: File): Promise<string | undefined> => {
    if (file.type.startsWith("image/")) {
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })
    }
    return undefined
  }

  // 上传文件到服务器
  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const formData = new FormData()
    formData.append("file", file)

    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const preview = await generatePreview(file)

    const uploadedFile: UploadedFile = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: "",
      status: "uploading",
      progress: 0,
      preview
    }

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setFiles(prev => prev.map(f => 
          f.id === fileId 
            ? { ...f, progress: Math.min(f.progress + Math.random() * 30, 90) }
            : f
        ))
      }, 200)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "上传失败")
      }

      const data = await response.json()

      return {
        ...uploadedFile,
        url: data.url,
        status: "completed",
        progress: 100
      }

    } catch (error) {
      logger.error("文件上传失败", error as Error, { fileName: file.name })
      return {
        ...uploadedFile,
        status: "error",
        progress: 0,
        error: error instanceof Error ? error.message : "上传失败"
      }
    }
  }

  // 处理文件选择
  const handleFiles = async (selectedFiles: FileList) => {
    if (disabled || isUploading) return

    const fileArray = Array.from(selectedFiles)
    
    // 检查文件数量限制
    if (files.length + fileArray.length > maxFiles) {
      alert(`最多只能上传 ${maxFiles} 个文件`)
      return
    }

    setIsUploading(true)

    const newFiles: UploadedFile[] = []

    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        alert(`${file.name}: ${error}`)
        continue
      }

      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const preview = await generatePreview(file)

      const uploadedFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: "",
        status: "uploading",
        progress: 0,
        preview
      }

      newFiles.push(uploadedFile)
    }

    setFiles(prev => [...prev, ...newFiles])

    // 并行上传文件
    const uploadPromises = fileArray.map(async (file, index) => {
      const error = validateFile(file)
      if (error) return null

      try {
        const result = await uploadFile(file)
        setFiles(prev => prev.map(f => 
          f.id === newFiles[index].id ? result : f
        ))
        return result
      } catch (error) {
        logger.error("文件上传失败", error as Error)
        return null
      }
    })

    const results = await Promise.all(uploadPromises)
    const successfulUploads = results.filter(Boolean) as UploadedFile[]
    
    setIsUploading(false)
    onFilesUploaded(successfulUploads)
  }

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled) return

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFiles(droppedFiles)
    }
  }, [disabled])

  // 移除文件
  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  // 重试上传
  const retryUpload = async (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return

    // 这里需要重新获取原始文件，实际实现中可能需要保存原始文件引用
    // 暂时跳过重试功能的完整实现
  }

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {/* 上传区域 */}
        <Card
          className={cn(
            "border-2 border-dashed transition-colors cursor-pointer",
            isDragging && "border-blue-500 bg-blue-50 dark:bg-blue-950",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <CardContent className="p-6 text-center">
            <Upload className="w-8 h-8 mx-auto mb-4 text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              点击上传或拖拽文件到此处
            </p>
            <p className="text-xs text-gray-500">
              支持图片、PDF、文档等格式，最大 {maxSize}MB，最多 {maxFiles} 个文件
            </p>
          </CardContent>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(",")}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">已选择的文件</h4>
            {files.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center space-x-3">
                  {/* 文件图标/预览 */}
                  <div className="flex-shrink-0">
                    {file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                        {getFileIcon(file.type)}
                      </div>
                    )}
                  </div>

                  {/* 文件信息 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    
                    {/* 进度条 */}
                    {file.status === "uploading" && (
                      <Progress value={file.progress} className="mt-1 h-1" />
                    )}
                    
                    {/* 错误信息 */}
                    {file.status === "error" && file.error && (
                      <Alert variant="destructive" className="mt-1">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription className="text-xs">{file.error}</AlertDescription>
                      </Alert>
                    )}
                  </div>

                  {/* 状态和操作 */}
                  <div className="flex items-center space-x-2">
                    {file.status === "uploading" && (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    )}
                    
                    {file.status === "completed" && (
                      <Tooltip>
                        <TooltipTrigger>
                          <Check className="w-4 h-4 text-green-500" />
                        </TooltipTrigger>
                        <TooltipContent>上传完成</TooltipContent>
                      </Tooltip>
                    )}
                    
                    {file.status === "error" && (
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </TooltipTrigger>
                        <TooltipContent>上传失败</TooltipContent>
                      </Tooltip>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(file.id)
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
