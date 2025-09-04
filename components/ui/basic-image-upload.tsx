"use client"

import { useId, useRef, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Upload, User, Image as ImageIcon } from "lucide-react"

interface BasicImageUploadProps {
  onUpload: (photoUrl: string, avatarUrl: string) => void
  photoUrl?: string
  avatarUrl?: string
}

export function BasicImageUpload({ onUpload, photoUrl, avatarUrl }: BasicImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = useId()

  // 触发文件选择器的函数
  const triggerFileSelect = () => {
    console.log('triggerFileSelect 被调用')
    if (inputRef.current) {
      console.log('inputRef.current 存在，尝试点击')
      try {
        inputRef.current.click()
        console.log('inputRef.current.click() 执行成功')
      } catch (error) {
        console.error('inputRef.current.click() 执行失败:', error)
      }
    } else {
      console.error('inputRef.current 为 null')
    }
  }

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('文件选择事件触发', e.target.files)
    const file = e.target.files?.[0]
    if (!file) {
      console.log('没有选择文件')
      return
    }

    console.log('开始上传文件:', file.name, file.size)
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/upload/process-image", { method: "POST", body: formData })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      console.log('上传成功:', data)
      onUpload(data.photoUrl, data.avatarUrl)
    } catch (err) {
      console.error("图片上传失败", err)
      alert("图片上传失败，请重试")
    } finally {
      setIsUploading(false)
      // 允许重复选择同一文件
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-4">
      <Label className="text-white text-base font-medium">Agent照片上传</Label>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      {/* 使用div而不是label，避免可能的label问题 */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          console.log('点击上传区域 - div onClick')
          e.preventDefault()
          e.stopPropagation()
          triggerFileSelect()
        }}
        onKeyDown={(e) => {
          console.log('键盘事件:', e.key)
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            triggerFileSelect()
          }
        }}
        className="block cursor-pointer relative z-[100] pointer-events-auto"
      >
        <div className="border-2 border-dashed border-[#3c4043] rounded-lg p-6 text-center bg-[#1a1a1a] hover:bg-[#202020] transition-colors">
          <div className="space-y-3">
            <Upload className="w-12 h-12 text-gray-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-white font-medium">{isUploading ? "正在上传..." : "点击选择图片"}</p>
              <p className="text-gray-400 text-xs">上传后将自动生成展示照片和聊天头像</p>
            </div>
          </div>
          {/* 添加一个备用按钮 */}
          <button
            type="button"
            onClick={(e) => {
              console.log('备用按钮被点击')
              e.preventDefault()
              e.stopPropagation()
              triggerFileSelect()
            }}
            className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
          >
            备用上传按钮
          </button>
        </div>
      </div>

      {(photoUrl || avatarUrl) && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-[#1a1a1a] rounded-lg border border-[#3c4043]">
          <div className="space-y-2">
            <Label className="text-white text-sm">展示照片</Label>
            <div className="aspect-[3/4] border border-[#3c4043] rounded-lg overflow-hidden bg-[#2a2a2a] flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt="展示照片预览" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-500" />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-white text-sm">聊天头像</Label>
            <div className="aspect-square border border-[#3c4043] rounded-full overflow-hidden bg-[#2a2a2a] flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="聊天头像预览" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-gray-500" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
