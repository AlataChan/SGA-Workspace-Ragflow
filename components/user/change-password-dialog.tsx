"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Lock,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from "lucide-react"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // 表单数据
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // 修改密码
  const handleChangePassword = async () => {
    try {
      setIsSaving(true)
      setMessage(null)

      // 验证必填字段
      if (!formData.currentPassword.trim()) {
        setMessage({ type: 'error', text: '请输入当前密码' })
        return
      }

      if (!formData.newPassword.trim()) {
        setMessage({ type: 'error', text: '请输入新密码' })
        return
      }

      if (formData.newPassword !== formData.confirmPassword) {
        setMessage({ type: 'error', text: '新密码和确认密码不一致' })
        return
      }

      if (formData.newPassword.length < 6) {
        setMessage({ type: 'error', text: '新密码至少6位' })
        return
      }

      const updateData = {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword
      }

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: '密码修改成功' })
        
        // 清空表单
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })

        // 3秒后关闭对话框
        setTimeout(() => {
          setMessage(null)
          onOpenChange(false)
        }, 2000)
      } else {
        const errorData = await response.json()
        setMessage({ 
          type: 'error', 
          text: errorData.error?.message || '密码修改失败' 
        })
      }
    } catch (error) {
      console.error('修改密码失败:', error)
      setMessage({ type: 'error', text: '密码修改失败' })
    } finally {
      setIsSaving(false)
    }
  }

  // 重置表单
  const handleCancel = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    setMessage(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1f1f] border-[#2d2d2d] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            修改密码
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            请输入当前密码和新密码
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-6">
          {/* 当前密码 */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-white">当前密码</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="请输入当前密码"
                value={formData.currentPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          {/* 新密码 */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-white">新密码</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                placeholder="请输入新密码（至少6位）"
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          {/* 确认新密码 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-white">确认新密码</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="请再次输入新密码"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          {/* 密码要求提示 */}
          <div className="text-sm text-gray-400 bg-[#2d2d2d] p-3 rounded-lg">
            <p className="font-medium mb-1">密码要求：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>至少6个字符</li>
              <li>建议包含字母、数字和特殊字符</li>
              <li>不要使用过于简单的密码</li>
            </ul>
          </div>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`flex items-center p-3 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-500/20 border border-green-500/30 text-green-400' 
              : 'bg-red-500/20 border border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <AlertCircle className="w-4 h-4 mr-2" />
            )}
            {message.text}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-2 pt-4 border-t border-[#2d2d2d]">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
            disabled={isSaving}
          >
            取消
          </Button>
          <Button
            onClick={handleChangePassword}
            disabled={isSaving}
            className="bg-[#6a5acd] hover:bg-[#5a4abd] text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                修改中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                确认修改
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
