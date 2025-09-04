'use client'

import { useState } from 'react'

export default function DebugHistoryPage() {
  const [config, setConfig] = useState({
    difyUrl: 'http://192.144.232.60/v1',
    difyKey: '',
    userId: 'test-user'
  })
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testHistoryAPI = async () => {
    if (!config.difyKey.trim()) {
      setError('请输入 API Key')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const apiUrl = `${config.difyUrl}/conversations?user=${config.userId}&limit=20`
      console.log('测试 API URL:', apiUrl)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.difyKey}`,
          'Content-Type': 'application/json'
        }
      })

      console.log('响应状态:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log('响应数据:', data)
        setResult(data)
      } else {
        const errorText = await response.text()
        console.error('API 错误:', errorText)
        setError(`API 错误: ${response.status} ${response.statusText}\n${errorText}`)
      }
    } catch (err) {
      console.error('请求异常:', err)
      setError(`请求异常: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dify 历史对话 API 调试</h1>
        
        <div className="bg-white rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">配置</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Dify API URL</label>
              <input
                type="text"
                value={config.difyUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, difyUrl: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <input
                type="password"
                value={config.difyKey}
                onChange={(e) => setConfig(prev => ({ ...prev, difyKey: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md"
                placeholder="app-xxxxxxxxxxxxxxxx"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">用户ID</label>
              <input
                type="text"
                value={config.userId}
                onChange={(e) => setConfig(prev => ({ ...prev, userId: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <button
              onClick={testHistoryAPI}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '测试中...' : '测试历史对话 API'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 font-semibold mb-2">错误</h3>
            <pre className="text-red-700 text-sm whitespace-pre-wrap">{error}</pre>
          </div>
        )}
        
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-green-800 font-semibold mb-2">成功响应</h3>
            <pre className="text-green-700 text-sm bg-white p-3 rounded border overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
