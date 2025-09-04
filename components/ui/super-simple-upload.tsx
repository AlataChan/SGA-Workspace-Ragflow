"use client"

import { useState, useRef } from "react"
import { Label } from "@/components/ui/label"
import { Upload, User, Image as ImageIcon, CheckCircle, AlertCircle, X } from "lucide-react"

interface SuperSimpleUploadProps {
  onUpload: (photoUrl: string, avatarUrl: string) => void
  photoUrl?: string
  avatarUrl?: string
}

export function SuperSimpleUpload({ onUpload, photoUrl, avatarUrl }: SuperSimpleUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文件上传的通用函数
  const processFile = async (file: File) => {
    // 重置状态
    setError(null)
    setUploadProgress(0)
    setIsUploading(true)
    setUploadSuccess(false)

    // 文件大小检查
    if (file.size > 10 * 1024 * 1024) {
      setError("文件大小不能超过 10MB")
      setIsUploading(false)
      return
    }

    // 文件类型检查
    if (!file.type.startsWith('image/')) {
      setError("只能上传图片文件")
      setIsUploading(false)
      return
    }

    try {
      const formData = new FormData()
      formData.append("file", file)

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 8, 85))
      }, 150)

      const response = await fetch("/api/upload/process-image", {
        method: "POST",
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      onUpload(data.photoUrl, data.avatarUrl)

      // 显示成功状态
      setUploadSuccess(true)

      // 成功后重置进度
      setTimeout(() => {
        setUploadProgress(0)
      }, 2000)

    } catch (error) {
      console.error("图片上传失败:", error)
      setError(error instanceof Error ? error.message : "图片上传失败，请重试")
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    await processFile(file)
    // 清空文件输入
    event.target.value = ""
  }

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))

    if (imageFile) {
      await processFile(imageFile)
    } else {
      setError("请拖拽图片文件")
    }
  }

  // 点击上传区域触发文件选择
  const handleUploadAreaClick = () => {
    fileInputRef.current?.click()
  }

  // 清除错误
  const clearError = () => {
    setError(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label className="text-white text-lg font-semibold">Agent照片上传</Label>
        {uploadSuccess && (
          <div className="flex items-center space-x-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">上传成功</span>
          </div>
        )}
      </div>

      {/* 拖拽上传区域 */}
      <div className="space-y-4">
        <div
          className={`
            relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer
            ${isDragOver
              ? 'border-blue-400 bg-blue-500/10 scale-[1.02]'
              : error
                ? 'border-red-400 bg-red-500/5'
                : uploadSuccess
                  ? 'border-green-400 bg-green-500/5'
                  : 'border-gray-600 bg-[#1a1a1a] hover:border-blue-500 hover:bg-blue-500/5'
            }
            ${isUploading ? 'pointer-events-none' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadAreaClick}
        >
          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
          />

          {/* 上传区域内容 */}
          <div className="flex flex-col items-center justify-center space-y-4">
            {isUploading ? (
              // 上传中状态
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-blue-400" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="text-blue-400 font-medium">
                    {uploadProgress < 85 ? "正在上传..." : "正在处理图片..."}
                  </p>
                  <div className="w-48 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-gray-400 text-sm">{uploadProgress}%</span>
                </div>
              </div>
            ) : uploadSuccess ? (
              // 成功状态
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-green-400 font-medium">上传成功！</p>
                  <p className="text-gray-400 text-sm">图片已处理完成</p>
                </div>
              </div>
            ) : error ? (
              // 错误状态
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-red-400 font-medium">上传失败</p>
                  <p className="text-gray-400 text-sm">{error}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearError()
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm underline"
                  >
                    重新尝试
                  </button>
                </div>
              </div>
            ) : (
              // 默认状态
              <div className="flex flex-col items-center space-y-4">
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
                  ${isDragOver ? 'bg-blue-500 scale-110' : 'bg-gray-700'}
                `}>
                  <Upload className={`w-8 h-8 transition-colors duration-300 ${isDragOver ? 'text-white' : 'text-gray-400'}`} />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-white font-medium">
                    {isDragOver ? '松开鼠标上传图片' : '拖拽图片到此处，或点击选择'}
                  </p>
                  <p className="text-gray-400 text-sm">
                    支持 JPG、PNG 格式，最大 10MB
                  </p>
                  <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                    <span>• 自动生成展示照片</span>
                    <span>• 智能裁剪头像</span>
                    <span>• 高清优化</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 精美的预览区域 */}
      {(photoUrl || avatarUrl) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label className="text-white text-lg font-semibold">预览效果</Label>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm font-medium">处理完成</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 展示照片预览 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <Label className="text-white text-base font-medium">展示照片</Label>
                  <p className="text-gray-400 text-sm">用于主页和详情页展示</p>
                </div>
              </div>

              <div className="relative group">
                <div className="aspect-[4/5] border-2 border-[#3c4043] rounded-2xl overflow-hidden bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] shadow-2xl">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt="展示照片预览"
                      className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">高分辨率 • 1200x1200</span>
                <span className="text-green-400">✓ 已优化</span>
              </div>
            </div>

            {/* 聊天头像预览 */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <Label className="text-white text-base font-medium">聊天头像</Label>
                  <p className="text-gray-400 text-sm">用于聊天界面显示</p>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="relative group">
                  <div className="w-48 h-48 border-2 border-[#3c4043] rounded-full overflow-hidden bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] shadow-2xl">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="聊天头像预览"
                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-16 h-16 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">智能裁剪 • 400x400</span>
                <span className="text-green-400">✓ 已优化</span>
              </div>
            </div>
          </div>

          {/* 使用说明 */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
              <div className="space-y-2">
                <p className="text-blue-400 font-medium text-sm">图片处理完成</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
                  <div>• 展示照片：保持原始比例，高清优化</div>
                  <div>• 聊天头像：智能裁剪，突出主体</div>
                  <div>• 自动压缩：减少存储空间</div>
                  <div>• 格式统一：转换为JPEG格式</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
