"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Upload, Building, CheckCircle, AlertCircle } from "lucide-react"
import NewAdminLayout from "@/components/admin/new-admin-layout"

interface CompanyInfo {
  id: string
  name: string
  logoUrl?: string
}

export default function CompanySettingsPage() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    logoFile: null as File | null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // 获取公司信息
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await fetch('/api/admin/company')
        if (response.ok) {
          const data = await response.json()
          setCompanyInfo(data.data)
          setFormData(prev => ({
            ...prev,
            name: data.data.name || ""
          }))
          setLogoPreview(data.data.logoUrl)
        } else {
          setMessage({ type: 'error', text: '获取公司信息失败' })
        }
      } catch (error) {
        console.error('获取公司信息失败:', error)
        setMessage({ type: 'error', text: '获取公司信息失败' })
      } finally {
        setIsLoading(false)
      }
    }

    fetchCompanyInfo()
  }, [])

  // 处理Logo文件选择
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: '请选择图片文件' })
        return
      }

      // 验证文件大小 (2MB)
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: '图片文件大小不能超过2MB' })
        return
      }

      setFormData(prev => ({ ...prev, logoFile: file }))
      
      // 生成预览
      const reader = new FileReader()
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      
      setMessage(null)
    }
  }

  // 上传Logo
  const uploadLogo = async (): Promise<string | null> => {
    if (!formData.logoFile) return null

    setIsUploading(true)
    try {
      const uploadFormData = new FormData()
      uploadFormData.append('logo', formData.logoFile)

      const response = await fetch('/api/admin/company/logo', {
        method: 'POST',
        body: uploadFormData,
      })

      if (response.ok) {
        const data = await response.json()
        return data.data.logoUrl
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '上传失败')
      }
    } catch (error) {
      console.error('Logo上传失败:', error)
      throw error
    } finally {
      setIsUploading(false)
    }
  }

  // 保存公司信息
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: '公司名称不能为空' })
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      let logoUrl = companyInfo?.logoUrl

      // 如果有新的Logo文件，先上传
      if (formData.logoFile) {
        logoUrl = await uploadLogo()
      }

      // 更新公司信息
      const response = await fetch('/api/admin/company', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          logoUrl,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCompanyInfo(data.data)
        setFormData(prev => ({ ...prev, logoFile: null }))
        setLogoPreview(null) // 清除预览
        setMessage({ type: 'success', text: '公司信息保存成功' })

        // 强制刷新页面以更新所有Logo显示
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        const error = await response.json()
        throw new Error(error.error?.message || '保存失败')
      }
    } catch (error) {
      console.error('保存失败:', error)
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : '保存失败，请稍后重试' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <NewAdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#6a5acd]" />
        </div>
      </NewAdminLayout>
    )
  }

  return (
    <NewAdminLayout>
      <div className="max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">公司设置</h1>
          <p className="text-gray-400">管理公司基本信息和品牌设置</p>
        </div>

        {/* 消息提示 */}
        {message && (
          <Alert className={`mb-6 ${
            message.type === 'success' 
              ? 'border-green-500/20 bg-green-500/10' 
              : 'border-red-500/20 bg-red-500/10'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <AlertDescription className={message.type === 'success' ? 'text-green-100' : 'text-red-100'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-[#1f1f1f] border-[#2d2d2d]">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Building className="w-5 h-5 mr-2" />
              公司信息
            </CardTitle>
            <CardDescription className="text-gray-400">
              设置公司名称和Logo，这些信息将显示在登录页面和主页面
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 公司名称 */}
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-white">公司名称</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="请输入公司名称"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="bg-[#2a2a2a] border-[#3c4043] text-white placeholder:text-gray-500"
              />
            </div>

            {/* Logo上传 */}
            <div className="space-y-4">
              <Label className="text-white">公司Logo</Label>
              
              {/* Logo预览 */}
              {logoPreview && (
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-[#2a2a2a] border border-[#3c4043] rounded-lg flex items-center justify-center overflow-hidden">
                    <img 
                      src={logoPreview} 
                      alt="Logo预览" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-sm text-gray-400">
                    当前Logo预览
                  </div>
                </div>
              )}

              {/* 文件上传 */}
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  id="logoUpload"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('logoUpload')?.click()}
                  className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  选择Logo文件
                </Button>
                <span className="text-sm text-gray-400">
                  支持 JPG、PNG 格式，文件大小不超过 2MB
                </span>
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || isUploading}
                className="bg-[#6a5acd] hover:bg-[#5a4abd] text-white"
              >
                {isSaving || isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isUploading ? '上传中...' : '保存中...'}
                  </>
                ) : (
                  '保存设置'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </NewAdminLayout>
  )
}
