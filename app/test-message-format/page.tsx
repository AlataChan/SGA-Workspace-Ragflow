'use client'

import React from 'react'
import { marked } from 'marked'

export default function TestMessageFormatPage() {
  // 测试消息内容 - 包含表格和分类样式
  const testMessage = `根据2025年9月8日（星期一）的最新网络行情汇总，今日A股市场呈现以下特点：

## **指数表现**
上证指数早盘小幅波动，开盘跌0.02%，报3811.67点，后续有小幅震荡（数据源自每经网、界面新闻），
创业板指数一度上涨0.21%，开盘报2964.43点，但随中午所回调，根据实时的试讯跟踪超2%，
沪深300指数早盘上涨约2.18%，近期报4460点附近，显示蓝筹板块性较强（东方财富网、新浪财经）
深证成指也有小幅上涨，但走势整体偏弱。

## **板块与热点**
机器人、农业、医疗保健、海运板块走强，反映实业和创新板块资金青睐。
半导体、CPO、光芯片、新经济概念中调整较大，是抑象创业板的主要因素。
市场赚钱效应总体较好，涨跌比为3269:1955，赚钱效应62.5%（数据来源：每经快讯）。

## **市场逻辑与关注点**
近期市场刮列震荡，"创新成长"风格表现居前，但波动加大，蓝筹价值板块较为坚挺。
政策面（如财回购、流动性投放）对资金面有支撑，技术面上部分指数处于高位震荡区间。
行业和主题轮动明显，板块分化凸显投资者结构的迁代。

## **主要指数表现**

| 指数名称 | 开盘价 | 涨跌幅 | 成交量 |
|---------|--------|--------|--------|
| 上证指数 | 3811.67 | -0.02% | 1250亿 |
| 深证成指 | 12456.78 | +0.15% | 980亿 |
| 创业板指 | 2964.43 | +0.21% | 650亿 |
| 沪深300 | 4460.12 | +2.18% | 1800亿 |

## **适用于林理决策的重点**
若关注中长期机会，建议重点跟踪蓝筹/ETF标的与高成长板块的轮动节奏。
技术面与政策面的共振值得警惕短线波动。

## **行情数据详见**

1. https://www.sogou.com/link?url=hedJjaC291NSDtlWbRxWKDeQh9RPnUSuwtblb-9F2pKu0bUY1FCjS_CSVxGEhB8cbQKsBa-Wizw
2. https://quote.eastmoney.com/zs000300.html
3. https://finance.sina.com.cn/realstock/company/sh000300/nc.shtml
4. https://i.ifeng.com/c/7ZanVOeMIYN
5. http://mp.weixin.qq.com/s?src=11&timestamp=1757303864&ver=6223

> **提示**: 如需详细技术面数据分析，可进一步指定板块/标的，我可帮助深度数据整理趋势研判。`

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">消息格式测试页面</h1>
          <p className="text-gray-600 mb-8">
            这个页面用于测试和展示我们优化后的聊天消息格式效果，对比Dify的显示样式。
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">优化后的消息显示效果</h2>
          
          {/* 模拟聊天消息容器 */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="flex items-start space-x-4">
              {/* Agent头像 */}
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                AI
              </div>
              
              {/* 消息气泡 */}
              <div className="flex-1 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200">
                <div
                  className="message-content"
                  style={{
                    maxWidth: '100%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(testMessage, {
                      breaks: true,
                      gfm: true
                    }) as string
                  }}

                />
              </div>
            </div>
          </div>

          {/* 样式说明 */}
          <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">优化特点</h3>
            <ul className="space-y-2 text-blue-700">
              <li>• <strong>清晰的列表格式</strong>：有序列表使用数字编号，无序列表使用项目符号</li>
              <li>• <strong>优化的链接样式</strong>：链接有编号和蓝色高亮，悬停效果</li>
              <li>• <strong>合适的段落间距</strong>：段落之间有足够的空白，提升可读性</li>
              <li>• <strong>层次分明的标题</strong>：不同级别的标题有不同的样式和间距</li>
              <li>• <strong>专业的代码显示</strong>：内联代码和代码块有专门的样式</li>
            </ul>
          </div>
        </div>

        {/* 样式定义 */}
        <style jsx global>{`
          /* 消息内容样式 - 优化格式化显示 */
          .message-content {
            font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 14px !important;
            line-height: 1.7 !important;
            color: #1f2937 !important;
            letter-spacing: 0.25px !important;
          }

          .message-content p {
            margin: 0 0 18px 0 !important;
            line-height: 1.7 !important;
          }

          .message-content p:last-child {
            margin-bottom: 0 !important;
          }

          /* 段落间距优化 - 仿Dify */
          .message-content > *:not(:last-child) {
            margin-bottom: 16px !important;
          }

          /* 特殊段落样式 */
          .message-content p:first-child {
            margin-top: 0 !important;
          }

          .message-content h1,
          .message-content h2,
          .message-content h3,
          .message-content h4,
          .message-content h5,
          .message-content h6 {
            color: #111827 !important;
            font-weight: 600 !important;
            margin: 20px 0 12px 0 !important;
            line-height: 1.4 !important;
          }

          .message-content h1 {
            font-size: 20px !important;
            border-bottom: 2px solid #e5e7eb !important;
            padding-bottom: 8px !important;
          }

          .message-content h2 {
            font-size: 18px !important;
            border-bottom: 1px solid #f3f4f6 !important;
            padding-bottom: 6px !important;
          }

          .message-content h3 {
            font-size: 16px !important;
          }

          .message-content strong {
            color: #111827 !important;
            font-weight: 600 !important;
          }

          /* 列表样式优化 - 仿Dify样式，保持原生编号 */
          .message-content ul,
          .message-content ol {
            margin: 16px 0 20px 0 !important;
            padding-left: 28px !important;
            list-style-position: outside !important;
          }

          .message-content ol {
            list-style-type: decimal !important;
          }

          .message-content ul {
            list-style-type: disc !important;
          }

          .message-content li {
            margin: 8px 0 !important;
            line-height: 1.7 !important;
            padding-left: 8px !important;
          }

          /* 列表标记样式 */
          .message-content ol li::marker {
            font-weight: 600 !important;
            color: #1f2937 !important;
          }

          .message-content ul li::marker {
            color: #1f2937 !important;
          }

          /* 嵌套列表 */
          .message-content ul ul,
          .message-content ol ol,
          .message-content ul ol,
          .message-content ol ul {
            margin: 8px 0 !important;
            padding-left: 24px !important;
          }

          .message-content code {
            background: #f3f4f6 !important;
            color: #374151 !important;
            padding: 3px 6px !important;
            border-radius: 4px !important;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
            font-size: 13px !important;
          }

          .message-content pre {
            background: #f8f9fa !important;
            color: #374151 !important;
            padding: 16px !important;
            border-radius: 8px !important;
            overflow-x: auto !important;
            margin: 12px 0 !important;
            border: 1px solid #e5e7eb !important;
          }

          .message-content pre code {
            background: transparent !important;
            padding: 0 !important;
            color: #212529 !important;
            font-size: 13px !important;
          }

          .message-content blockquote {
            border-left: 3px solid #4285f4 !important;
            margin: 12px 0 !important;
            padding: 8px 0 8px 16px !important;
            background: rgba(66, 133, 244, 0.1) !important;
            border-radius: 0 4px 4px 0 !important;
          }

          /* 链接样式优化 - 仿Dify样式 */
          .message-content a {
            color: #1a73e8 !important;
            text-decoration: none !important;
            font-weight: 500 !important;
            transition: all 0.2s ease !important;
            padding: 2px 4px !important;
            border-radius: 4px !important;
            border-bottom: 1px solid transparent !important;
            position: relative !important;
          }

          .message-content a:hover {
            color: #1557b0 !important;
            background-color: rgba(26, 115, 232, 0.08) !important;
            border-bottom: 1px solid #1a73e8 !important;
          }

          /* 移除链接的自动编号，因为列表已经有编号了 */

          /* 表格样式 - 仿Dify */
          .message-content table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 16px 0 !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            overflow: hidden !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
          }

          .message-content th,
          .message-content td {
            padding: 12px 16px !important;
            text-align: left !important;
            border-bottom: 1px solid #e5e7eb !important;
            vertical-align: top !important;
          }

          .message-content th {
            background-color: #f9fafb !important;
            font-weight: 600 !important;
            color: #374151 !important;
            border-bottom: 2px solid #e5e7eb !important;
          }

          .message-content tr:last-child td {
            border-bottom: none !important;
          }

          .message-content tr:hover {
            background-color: #f9fafb !important;
          }

          /* 文字分类样式 - 仿Dify */
          .message-content strong {
            font-weight: 600 !important;
            color: #1f2937 !important;
          }

          /* 分类标题样式 */
          .message-content p:has(strong) {
            margin: 16px 0 8px 0 !important;
          }

          /* 引用块样式 */
          .message-content blockquote {
            border-left: 4px solid #3b82f6 !important;
            padding-left: 16px !important;
            margin: 16px 0 !important;
            color: #6b7280 !important;
            font-style: italic !important;
            background-color: #f8fafc !important;
            padding: 12px 16px !important;
            border-radius: 0 8px 8px 0 !important;
          }
        `}</style>
      </div>
    </div>
  )
}
