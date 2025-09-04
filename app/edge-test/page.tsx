"use client"

import { useState } from 'react'

export default function EdgeTestPage() {
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [errorLog, setErrorLog] = useState<string[]>([])

  const logError = (test: string, error: string) => {
    setErrorLog(prev => [...prev, `[${test}] ${error}`])
  }

  const showResult = (testId: string, success: boolean, message: string) => {
    setTestResults(prev => ({ ...prev, [testId]: { success, message } }))
  }

  // 测试 Fetch API
  const testFetch = async () => {
    try {
      if (typeof fetch === 'undefined') {
        showResult('fetch-test', false, 'Fetch API 不支持')
        logError('Fetch', 'Fetch API 不支持')
        return
      }
      
      const response = await fetch('data:text/plain,test')
      const data = await response.text()
      showResult('fetch-test', true, 'Fetch API 工作正常')
    } catch (error: any) {
      showResult('fetch-test', false, 'Fetch API 错误: ' + error.message)
      logError('Fetch', error.message)
    }
  }

  // 测试 Agent API
  const testAgentAPI = async () => {
    try {
      const response = await fetch('/api/admin/agents')
      if (response.ok) {
        const data = await response.json()
        showResult('agent-api-test', true, 'Agent API 连接成功，返回 ' + (data.data ? data.data.length : 0) + ' 个Agent')
      } else {
        showResult('agent-api-test', false, 'Agent API 响应错误: ' + response.status)
        logError('Agent API', 'Agent API 响应错误: ' + response.status)
      }
    } catch (error: any) {
      showResult('agent-api-test', false, 'Agent API 异常: ' + error.message)
      logError('Agent API', error.message)
    }
  }

  // 测试创建Agent
  const testCreateAgent = async () => {
    try {
      const testData = {
        departmentId: 'dept_management',
        chineseName: 'Edge测试Agent',
        englishName: 'Edge Test Agent',
        position: 'Edge测试专员',
        description: '用于测试Edge兼容性',
        platform: 'DIFY',
        platformConfig: {
          baseUrl: 'https://api.dify.ai/v1',
          apiKey: 'app-edgetest123456'
        },
        sortOrder: 999
      }

      console.log('发送创建请求:', testData)
      
      const response = await fetch('/api/admin/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      })

      console.log('响应状态:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('创建成功:', data)
        showResult('create-test', true, '创建Agent成功: ' + data.message)
      } else {
        const error = await response.json()
        console.log('创建失败:', error)
        showResult('create-test', false, '创建Agent失败: ' + (error.error && error.error.message ? error.error.message : error.message || '未知错误'))
        logError('Create Agent', error.error && error.error.message ? error.error.message : error.message || '未知错误')
      }
    } catch (error: any) {
      console.log('创建异常:', error)
      showResult('create-test', false, '创建Agent异常: ' + error.message)
      logError('Create Agent', error.message)
    }
  }

  const TestItem = ({ testId, title, onTest }: { testId: string; title: string; onTest: () => void }) => {
    const result = testResults[testId]
    return (
      <div className={`border-2 border-dashed rounded-xl p-6 transition-all duration-300 ${
        result ? (result.success ? 'border-green-400 bg-green-500/5' : 'border-red-400 bg-red-500/5') : 'border-gray-600 bg-gray-100'
      }`}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <button
          onClick={onTest}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          测试 {title}
        </button>
        {result && (
          <div className="mt-4">
            <p className={`font-medium ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              <strong>{result.success ? '✅ 通过' : '❌ 失败'}</strong>: {result.message}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Edge浏览器兼容性测试</h1>
      <p className="text-gray-600 mb-8">请在Edge浏览器中打开此页面，点击下面的测试按钮来检查兼容性问题。</p>
      
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">浏览器信息</h3>
        <p className="text-sm text-gray-600 mb-2">User Agent: {typeof window !== 'undefined' ? navigator.userAgent : '服务端渲染'}</p>
        <p className="text-sm text-gray-600">
          Edge 版本: {typeof window !== 'undefined' ? 
            (navigator.userAgent.indexOf('Edge') !== -1 || navigator.userAgent.indexOf('Edg') !== -1 ? 
              (navigator.userAgent.match(/Edge\/(\d+)/) || navigator.userAgent.match(/Edg\/(\d+)/))?.[1] || '未知' : 
              '当前不是Edge浏览器') : 
            '服务端渲染'}
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-800">API兼容性测试</h2>
        
        <TestItem testId="fetch-test" title="Fetch API" onTest={testFetch} />
        <TestItem testId="agent-api-test" title="Agent API" onTest={testAgentAPI} />
        <TestItem testId="create-test" title="创建Agent" onTest={testCreateAgent} />
      </div>

      {errorLog.length > 0 && (
        <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-800 mb-2">错误日志</h3>
          <pre className="text-sm text-red-700 whitespace-pre-wrap font-mono">
            {errorLog.join('\n')}
          </pre>
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-2">测试说明</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 此页面通过Next.js服务器提供，避免CORS问题</li>
          <li>• 请在Edge浏览器中测试所有功能</li>
          <li>• 查看浏览器Console获取详细日志</li>
          <li>• 如果测试失败，请检查错误日志</li>
        </ul>
      </div>
    </div>
  )
}
