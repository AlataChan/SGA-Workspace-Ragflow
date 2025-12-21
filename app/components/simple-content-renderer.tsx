'use client'

import React, { useEffect, useRef, useState } from 'react'
import { marked, Tokens } from 'marked'

interface SimpleContentRendererProps {
  content: string
  isStreaming?: boolean
  onComplete?: () => void
}

export default function SimpleContentRenderer({
  content,
  isStreaming: _isStreaming = false,
  onComplete
}: SimpleContentRendererProps) {
  const [displayedContent, setDisplayedContent] = useState('')
  const typewriterTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 配置 marked - 只在组件挂载时执行一次
  useEffect(() => {
    // marked v16+ 使用 use() 方法配置
    marked.use({
      async: false, // 强制同步模式
      gfm: true,
      breaks: true,
      renderer: {
        // 自定义表格渲染 - 深色主题
        table(token: Tokens.Table): string {
          const header = this.parser.parse(token.header);
          const body = this.parser.parse(token.rows.flat());
          return `<div class="table-container" style="margin: 15px 0; overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); border: 1px solid #374151;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: rgba(31, 41, 55, 0.8); min-width: 400px;">
              <thead><tr>${header}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>`;
        },

        // 自定义表格单元格渲染
        tablecell(token: Tokens.TableCell): string {
          const content = this.parser.parseInline(token.tokens);
          const type = token.header ? 'th' : 'td';
          const style = token.header
            ? 'border: 1px solid #4b5563; padding: 12px 8px; background-color: rgba(55, 65, 81, 0.9); text-align: left; font-weight: 600; color: #f3f4f6;'
            : 'border: 1px solid #4b5563; padding: 10px 8px; color: #d1d5db; background-color: rgba(31, 41, 55, 0.6);';
          return `<${type} style="${style}">${content}</${type}>`;
        },

        // 自定义图片渲染
        image(token: Tokens.Image): string {
          const href = token.href || '';
          const text = token.text || '';
          const title = token.title || '';
          return `<div class="image-container" style="margin: 15px 0; text-align: center;">
            <img src="${href}" alt="${text}" title="${title}"
                 style="max-width: 400px; max-height: 300px; width: auto; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); cursor: pointer;"
                 onload="this.style.opacity='1'"
                 onclick="window.open('${href}', '_blank')"
                 onerror="this.parentElement.innerHTML='<div style=\\'padding: 20px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #fca5a5;\\'>图片加载失败</div>'"
                 style="opacity: 0; transition: opacity 0.3s;">
          </div>`;
        },

        // 自定义代码块渲染
        code(token: Tokens.Code): string {
          const code = token.text || '';
          const lang = token.lang || 'text';
          return `<div class="code-container" style="margin: 15px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <div style="background: rgba(55, 65, 81, 0.8); padding: 8px 16px; font-size: 12px; color: #9ca3af; border-bottom: 1px solid #4b5563;">
              <span style="color: #60a5fa;">📄</span> ${lang}
            </div>
            <pre style="margin: 0; padding: 16px; background: rgba(17, 24, 39, 0.9); color: #e5e7eb; overflow-x: auto;"><code class="language-${lang}" style="color: #e5e7eb; font-family: 'Fira Code', 'Consolas', monospace;">${code}</code></pre>
          </div>`;
        },

        // 自定义段落渲染 - 使用 token.tokens 解析内联内容
        paragraph(token: Tokens.Paragraph): string {
          const text = this.parser.parseInline(token.tokens);
          return `<p style="margin: 12px 0; line-height: 1.7;">${text}</p>`;
        },

        // 自定义列表渲染
        list(token: Tokens.List): string {
          const tag = token.ordered ? 'ol' : 'ul';
          const body = token.items.map(item => this.listitem(item)).join('');
          return `<${tag} style="margin: 12px 0; padding-left: 24px; color: #e5e7eb;">${body}</${tag}>`;
        },

        // 自定义列表项渲染
        listitem(token: Tokens.ListItem): string {
          const text = this.parser.parse(token.tokens);
          return `<li style="margin: 6px 0; line-height: 1.6;">${text}</li>`;
        },

        // 自定义标题渲染
        heading(token: Tokens.Heading): string {
          const text = this.parser.parseInline(token.tokens);
          const level = token.depth;
          const sizes = ['', '24px', '20px', '18px', '16px', '14px', '12px'];
          const margins = ['', '20px 0 16px 0', '18px 0 14px 0', '16px 0 12px 0', '14px 0 10px 0', '12px 0 8px 0', '10px 0 6px 0'];
          return `<h${level} style="font-size: ${sizes[level]}; margin: ${margins[level]}; font-weight: 600; color: #f3f4f6;">${text}</h${level}>`;
        },
      }
    });
  }, [])

  // 强化打字机效果 - 在内容变化时重新开始且避免闭包导致的无限循环
  useEffect(() => {
    // 重置并启动
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current)
    }
    setDisplayedContent('')
    // 立即开始打字
    startTypewriterEffect()

    return () => {
      if (typewriterTimerRef.current) {
        clearTimeout(typewriterTimerRef.current)
      }
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

  const indexRef = useRef(0)

  const startTypewriterEffect = () => {
    if (typewriterTimerRef.current) {
      clearTimeout(typewriterTimerRef.current)
    }

    const tick = () => {
      setDisplayedContent(prev => {
        // 结束条件：索引达到内容长度
        if (indexRef.current >= content.length) {
          onComplete?.()
          return prev
        }

        const nextChar = content.charAt(indexRef.current)
        indexRef.current += 1

        // 计划下一次渲染
        const delay = nextChar === ' ' ? 5 : nextChar === '\n' ? 15 : 20
        typewriterTimerRef.current = setTimeout(tick, delay)

        return prev + nextChar
      })
    }

    // 每次启动都重置索引并从头开始
    indexRef.current = displayedContent.length
    tick()
  }

  // 渲染内容
  const renderContent = () => {
    console.log('[SimpleContentRenderer] 渲染内容:', {
      displayedContent,
      contentType: typeof displayedContent,
      contentLength: displayedContent?.length || 0
    })

    try {
      // marked v16+ 的 parse 方法可能返回 Promise
      // 使用 marked.use({ async: false }) 确保同步行为
      const htmlContent = marked.parse(displayedContent)

      console.log('[SimpleContentRenderer] HTML内容:', {
        type: typeof htmlContent,
        isPromise: htmlContent instanceof Promise,
        value: typeof htmlContent === 'string' ? htmlContent.substring(0, 100) : htmlContent
      })

      // 如果是Promise,这是一个错误,降级处理
      if (htmlContent instanceof Promise) {
        console.error('[SimpleContentRenderer] marked.parse 返回了Promise,降级处理')
        return displayedContent.replace(/\n/g, '<br>')
      }

      // 确保返回字符串
      if (typeof htmlContent === 'string') {
        return htmlContent
      }

      // 降级:若仍非字符串,按纯文本处理
      console.warn('[SimpleContentRenderer] HTML内容不是字符串,降级处理:', htmlContent)
      return displayedContent.replace(/\n/g, '<br>')
    } catch (error) {
      console.error('[SimpleContentRenderer] Markdown渲染失败:', error)
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
