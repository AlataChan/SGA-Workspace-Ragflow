'use client'

import React, { useEffect, useRef, useState } from 'react'
import { marked } from 'marked'

interface SimpleContentRendererProps {
  content: string
  isStreaming?: boolean
  onComplete?: () => void
}

export default function SimpleContentRenderer({ 
  content, 
  isStreaming = false, 
  onComplete 
}: SimpleContentRendererProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const typewriterTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 配置 marked
  useEffect(() => {
    marked.setOptions({
      gfm: true,
      breaks: true,
      sanitize: false,
      smartLists: true,
    })

    // 自定义渲染器 - 参考 bi 的实现
    const renderer = new marked.Renderer()

    // 自定义表格渲染 - 深色主题
    renderer.table = (header: string, body: string) => {
      return `<div class="table-container" style="margin: 15px 0; overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 1px solid #374151;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: rgba(31, 41, 55, 0.8); min-width: 400px;">
          <thead>${header}</thead>
          <tbody>${body}</tbody>
        </table>
      </div>`
    }

    // 自定义表头渲染
    renderer.tablerow = (content: string) => {
      return `<tr>${content}</tr>`
    }

    // 自定义表格单元格渲染 - 深色主题
    renderer.tablecell = (content: string, flags: any) => {
      const type = flags.header ? 'th' : 'td'
      const style = flags.header
        ? 'border: 1px solid #4b5563; padding: 12px 8px; background-color: rgba(55, 65, 81, 0.9); text-align: left; font-weight: 600; color: #f3f4f6;'
        : 'border: 1px solid #4b5563; padding: 10px 8px; color: #d1d5db; background-color: rgba(31, 41, 55, 0.6);'
      return `<${type} style="${style}">${content}</${type}>`
    }

    // 自定义图片渲染 - 深色主题
    renderer.image = (href: string, title: string | null, text: string) => {
      return `<div class="image-container" style="margin: 15px 0; text-align: center;">
        <img src="${href}" alt="${text}" title="${title || ''}"
             style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);"
             onload="this.style.opacity='1'"
             onerror="this.parentElement.innerHTML='<div style=\\'padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #fca5a5;\\'>图片加载失败</div>'"
             style="opacity: 0; transition: opacity 0.3s;">
      </div>`
    }

    // 自定义代码块渲染 - 深色主题
    renderer.code = (code: string, language: string | undefined) => {
      const lang = language || 'text'
      return `<div class="code-container" style="margin: 15px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        <div style="background: rgba(55, 65, 81, 0.8); padding: 8px 16px; font-size: 12px; color: #9ca3af; border-bottom: 1px solid #4b5563;">
          <span style="color: #60a5fa;">📄</span> ${lang}
        </div>
        <pre style="margin: 0; padding: 16px; background: rgba(17, 24, 39, 0.9); color: #e5e7eb; overflow-x: auto;"><code class="language-${lang}" style="color: #e5e7eb; font-family: 'Fira Code', 'Consolas', monospace;">${code}</code></pre>
      </div>`
    }

    // 自定义段落渲染 - 改善间距
    renderer.paragraph = (text: string) => {
      return `<p style="margin: 12px 0; line-height: 1.7;">${text}</p>`
    }

    // 自定义列表渲染 - 改善样式
    renderer.list = (body: string, ordered: boolean) => {
      const tag = ordered ? 'ol' : 'ul'
      const style = ordered
        ? 'margin: 12px 0; padding-left: 24px; color: #e5e7eb;'
        : 'margin: 12px 0; padding-left: 24px; color: #e5e7eb;'
      return `<${tag} style="${style}">${body}</${tag}>`
    }

    // 自定义列表项渲染
    renderer.listitem = (text: string) => {
      return `<li style="margin: 6px 0; line-height: 1.6;">${text}</li>`
    }

    // 自定义标题渲染 - 改善层次
    renderer.heading = (text: string, level: number) => {
      const sizes = ['', '24px', '20px', '18px', '16px', '14px', '12px']
      const margins = ['', '20px 0 16px 0', '18px 0 14px 0', '16px 0 12px 0', '14px 0 10px 0', '12px 0 8px 0', '10px 0 6px 0']
      return `<h${level} style="font-size: ${sizes[level]}; margin: ${margins[level]}; font-weight: 600; color: #f3f4f6;">${text}</h${level}>`
    }

    marked.setOptions({ renderer })
  }, [])

  // 强化打字机效果 - 确保总是有打字效果
  useEffect(() => {
    if (content !== displayedContent) {
      // 无论是否流式，都启动打字机效果
      startTypewriterEffect()
    }
  }, [content])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (typewriterTimerRef.current) {
        clearTimeout(typewriterTimerRef.current)
      }
    }
  }, [])

  const startTypewriterEffect = () => {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current)
    }

    if (displayedContent.length < content.length) {
      const nextChar = content.charAt(displayedContent.length)
      setDisplayedContent(prev => prev + nextChar)

      // 根据字符类型调整速度 - 更快的打字效果
      const delay = nextChar === ' ' ? 5 : nextChar === '\n' ? 15 : 20

      typewriterTimerRef.current = setTimeout(startTypewriterEffect, delay)
    } else {
      onComplete?.()
    }
  }

  // 渲染内容
  const renderContent = () => {
    try {
      const htmlContent = marked.parse(displayedContent)
      return htmlContent
    } catch (error) {
      console.error('Markdown渲染失败:', error)
      return displayedContent.replace(/\n/g, '<br>')
    }
  }

  return (
    <div
      className="simple-content"
      style={{
        lineHeight: 1.7,
        color: '#e5e7eb',
        fontSize: '15px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        letterSpacing: '0.01em',
        wordSpacing: '0.05em'
      }}
      dangerouslySetInnerHTML={{ __html: renderContent() }}
    />
  )
}
