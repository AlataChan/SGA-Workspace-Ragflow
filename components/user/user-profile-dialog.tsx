"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { Separator } from "@/components/ui/separator"
// import { Badge } from "@/components/ui/badge"
import {
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Camera,
  Lock,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff
} from "lucide-react"

interface UserProfile {
  id: string
  username: string
  userId: string
  chineseName: string
  englishName?: string
  email?: string
  phone?: string
  position?: string
  avatarUrl?: string
  role: string
  department?: {
    id: string
    name: string
  }
  company?: {
    id: string
    name: string
  }
  createdAt: string
  updatedAt: string
}

interface UserProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // 表单数据
  const [formData, setFormData] = useState({
    chineseName: '',
    englishName: '',
    email: '',
    phone: '',
    position: '',
    avatarUrl: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // 获取用户信息
  const fetchUserProfile = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUserProfile(data.data)
        setFormData({
          chineseName: data.data.chineseName || '',
          englishName: data.data.englishName || '',
          email: data.data.email || '',
          phone: data.data.phone || '',
          position: data.data.position || '',
          avatarUrl: data.data.avatarUrl || '',
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        setMessage({ type: 'error', text: '获取用户信息失败' })
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      setMessage({ type: 'error', text: '获取用户信息失败' })
    } finally {
      setIsLoading(false)
    }
  }

  // 更新个人信息
  const handleUpdateProfile = async () => {
    try {
      setIsSaving(true)
      setMessage(null)

      // 验证必填字段
      if (!formData.chineseName.trim()) {
        setMessage({ type: 'error', text: '中文姓名不能为空' })
        return
      }

      // 如果要修改密码，验证密码
      if (formData.newPassword) {
        if (!formData.currentPassword) {
          setMessage({ type: 'error', text: '请输入当前密码' })
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
      }

      const updateData: any = {
        chineseName: formData.chineseName.trim(),
        englishName: formData.englishName.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        position: formData.position.trim() || undefined,
        avatarUrl: formData.avatarUrl.trim() || undefined,
      }

      // 如果要修改密码，添加密码字段
      if (formData.newPassword) {
        updateData.currentPassword = formData.currentPassword
        updateData.newPassword = formData.newPassword
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
        const data = await response.json()
        setUserProfile(data.data)
        setMessage({ type: 'success', text: '个人信息更新成功' })

        // 清空密码字段
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))

        // 3秒后关闭消息
        setTimeout(() => setMessage(null), 3000)
      } else {
        const errorData = await response.json()
        setMessage({
          type: 'error',
          text: errorData.error?.message || '更新失败'
        })
      }
    } catch (error) {
      console.error('更新个人信息失败:', error)
      setMessage({ type: 'error', text: '更新失败' })
    } finally {
      setIsSaving(false)
    }
  }

  // 当对话框打开时获取用户信息
  useEffect(() => {
    if (open) {
      fetchUserProfile()
    }
  }, [open])

  // 清除消息
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1f1f1f] border-[#2d2d2d] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">个人设置</DialogTitle>
          <DialogDescription className="text-gray-400">
            查看和修改您的个人信息
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>加载中...</span>
          </div>
        ) : userProfile ? (
          <div className="space-y-6 mt-6">
            {/* 头像和基本信息 */}
            <div className="flex flex-col items-center space-y-4 p-4 border border-[#2d2d2d] rounded-lg">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={formData.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xl">
                    {formData.chineseName ? formData.chineseName[0] : <User className="w-8 h-8" />}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0 bg-[#2d2d2d] border-[#3c4043] hover:bg-[#3c4043]"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold">{userProfile.chineseName}</h3>
                <p className="text-gray-400">@{userProfile.username}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="px-2 py-1 bg-[#6a5acd]/20 text-[#6a5acd] text-xs rounded-full border border-[#6a5acd]/30">
                    {userProfile.role === 'ADMIN' ? '管理员' : '用户'}
                  </span>
                  {userProfile.department && (
                    <span className="px-2 py-1 bg-gray-500/20 text-gray-300 text-xs rounded-full border border-gray-500/30">
                      {userProfile.department.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 头像URL */}
            <div className="space-y-2">
              <Label htmlFor="avatarUrl" className="text-white">头像链接</Label>
              <Input
                id="avatarUrl"
                placeholder="请输入头像图片链接"
                value={formData.avatarUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))}
                className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
              />
            </div>

            {/* 基本信息表单 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chineseName" className="text-white">中文姓名 *</Label>
                <Input
                  id="chineseName"
                  placeholder="请输入中文姓名"
                  value={formData.chineseName}
                  onChange={(e) => setFormData(prev => ({ ...prev, chineseName: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="englishName" className="text-white">英文姓名</Label>
                <Input
                  id="englishName"
                  placeholder="请输入英文姓名"
                  value={formData.englishName}
                  onChange={(e) => setFormData(prev => ({ ...prev, englishName: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">电话</Label>
                <Input
                  id="phone"
                  placeholder="请输入电话号码"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="position" className="text-white">职位</Label>
              <Input
                id="position"
                placeholder="请输入职位"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
              />
            </div>

            {/* 只读信息 */}
            <div className="border-t border-[#2d2d2d] pt-4"></div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <Label className="text-gray-400">用户名 (登录账号)</Label>
                <p className="text-white">{userProfile.username}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-400">用户ID (系统标识)</Label>
                <p className="text-white">{userProfile.userId}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-400">所属公司</Label>
                <p className="text-white">{userProfile.company?.name || '未设置'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-gray-400">创建时间</Label>
                <p className="text-white">{new Date(userProfile.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* 修改密码部分 */}
            <div className="border-t border-[#2d2d2d] pt-6 space-y-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Lock className="w-5 h-5 mr-2" />
                修改密码（可选）
              </h3>

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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white">确认新密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="请再次输入新密码"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
                />
              </div>

              <div className="text-sm text-gray-400 bg-[#2d2d2d] p-3 rounded-lg">
                <p className="font-medium mb-1">密码要求：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>至少6个字符</li>
                  <li>建议包含字母、数字和特殊字符</li>
                  <li>不要使用过于简单的密码</li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {/* 消息提示 */}
        {message && (
          <div className={`flex items-center p-3 rounded-lg ${message.type === 'success'
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
            onClick={() => onOpenChange(false)}
            className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
          >
            取消
          </Button>
          <Button
            onClick={handleUpdateProfile}
            disabled={isSaving}
            className="bg-[#6a5acd] hover:bg-[#5a4abd] text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存更改
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
