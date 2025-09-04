"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2, Wifi } from "lucide-react"

interface ConnectionTestProps {
  platform: string
  config: any
  onTestResult?: (success: boolean, message: string) => void
  className?: string
}

export function ConnectionTest({ 
  platform, 
  config, 
  onTestResult,
  className = ""
}: ConnectionTestProps) {
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    tested: boolean
  }>({ success: false, message: '', tested: false })

  const testConnection = async () => {
    if (!config || Object.keys(config).length === 0) {
      const message = '请先填写平台配置信息'
      setTestResult({ success: false, message, tested: true })
      onTestResult?.(false, message)
      return
    }

    // 基本验证
    if (platform === 'DIFY' && (!config.baseUrl || !config.apiKey)) {
      const message = '请填写Dify的Base URL和API Key'
      setTestResult({ success: false, message, tested: true })
      onTestResult?.(false, message)
      return
    }

    if (platform === 'OPENAI' && !config.apiKey) {
      const message = '请填写OpenAI的API Key'
      setTestResult({ success: false, message, tested: true })
      onTestResult?.(false, message)
      return
    }

    if (platform === 'CLAUDE' && !config.apiKey) {
      const message = '请填写Claude的API Key'
      setTestResult({ success: false, message, tested: true })
      onTestResult?.(false, message)
      return
    }

    setIsTesting(true)
    setTestResult({ success: false, message: '', tested: false })

    try {
      // 模拟连接测试
      const response = await fetch('/api/admin/agents/test-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          platform,
          config
        })
      })

      if (response.ok) {
        const data = await response.json()
        const success = data.success
        const message = data.message || (success ? '连接测试成功' : '连接测试失败')
        
        setTestResult({ success, message, tested: true })
        onTestResult?.(success, message)
      } else {
        const error = await response.json()
        const message = error.error?.message || '连接测试失败'
        setTestResult({ success: false, message, tested: true })
        onTestResult?.(false, message)
      }
    } catch (error) {
      const message = '网络错误，请检查网络连接'
      setTestResult({ success: false, message, tested: true })
      onTestResult?.(false, message)
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusIcon = () => {
    if (isTesting) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
    }
    
    if (!testResult.tested) {
      return <Wifi className="w-4 h-4 text-gray-400" />
    }
    
    return testResult.success ? (
      <CheckCircle className="w-4 h-4 text-green-400" />
    ) : (
      <XCircle className="w-4 h-4 text-red-400" />
    )
  }

  const getStatusText = () => {
    if (isTesting) return '测试中...'
    if (!testResult.tested) return '未测试'
    return testResult.success ? '连接正常' : '连接失败'
  }

  const getStatusColor = () => {
    if (isTesting) return 'text-blue-400'
    if (!testResult.tested) return 'text-gray-400'
    return testResult.success ? 'text-green-400' : 'text-red-400'
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getStatusIcon()}
          <span className={`text-sm ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={testConnection}
          disabled={isTesting}
          className="border-[#3c4043] text-gray-300 hover:bg-[#2d2d2d]"
        >
          {isTesting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              测试中
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 mr-2" />
              测试连接
            </>
          )}
        </Button>
      </div>
      
      {testResult.tested && testResult.message && (
        <div className={`text-xs p-2 rounded border ${
          testResult.success 
            ? 'border-green-500/30 bg-green-500/10 text-green-300'
            : 'border-red-500/30 bg-red-500/10 text-red-300'
        }`}>
          {testResult.message}
        </div>
      )}
    </div>
  )
}
