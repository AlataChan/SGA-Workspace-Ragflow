"use client"

import { useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Upload, User, Image as ImageIcon } from "lucide-react"

interface ReliableImageUploadProps {
  onUpload: (photoUrl: string, avatarUrl: string) => void
  photoUrl?: string
  avatarUrl?: string
}

export function ReliableImageUpload({ onUpload, photoUrl, avatarUrl }: ReliableImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('文件选择事件触发', event.target.files)
    const file = event.target.files?.[0]
    if (!file) {
      console.log('没有选择文件')
      return
    }

    console.log('开始上传文件:', file.name, file.size)
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      
      const response = await fetch("/api/upload/process-image", {
        method: "POST",
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('上传成功:', data)
      onUpload(data.photoUrl, data.avatarUrl)
    } catch (error) {
      console.error("图片上传失败:", error)
      alert("图片上传失败，请重试")
    } finally {
      setIsUploading(false)
      // 清空文件输入，允许重复选择同一文件
      if (event.target) {
        event.target.value = ""
      }
    }
  }

  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">Agent照片上传</Label>

      {/* 最简单的方案：直接使用label包裹input */}
      <label className="block cursor-pointer">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="sr-only"
        />

        {/* 上传区域 */}
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="space-y-3">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <p className="text-foreground font-medium">
                {isUploading ? "正在上传..." : "点击选择图片"}
              </p>
              <p className="text-muted-foreground text-xs">
                上传后将自动生成展示照片和聊天头像
              </p>
            </div>
          </div>
        </div>
      </label>

      {/* 预览区域 */}
      {(photoUrl || avatarUrl) && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
          <div className="space-y-2">
            <Label className="text-sm">展示照片</Label>
            <div className="aspect-[3/4] border border-border rounded-lg overflow-hidden bg-background flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt="展示照片预览" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">聊天头像</Label>
            <div className="aspect-square border border-border rounded-full overflow-hidden bg-background flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="聊天头像预览" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
