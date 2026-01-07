'use client'

import React, { useEffect, useMemo } from 'react'
import { marked, Tokens } from 'marked'

interface SimpleContentRendererProps {
  content: string
}

// 配置标记 - 只初始化一次
let markedConfigured = false

/**
 * 简化的内容渲染器 - 只负责将Markdown转为HTML
 * 打字效果由外层 TypewriterEffect 控制
 */
export default function SimpleContentRenderer({ content }: SimpleContentRendererProps) {
  // marked 配置只执行一次
  useEffect(() => {
    if (markedConfigured) return
    markedConfigured = true

    // marked v16+ 使用 use() 方法配置
    marked.use({
      async: false, // 强制同步模式
      gfm: true,
      breaks: true,
      renderer: {
        // 自定义表格渲染 - 跟随主题变量
        table(token: Tokens.Table): string {
          const header = this.parser.parse(token.header as any);
          const body = this.parser.parse(token.rows.flat() as any);
          return `<div class="table-container" style="margin: 15px 0; overflow-x: auto; border-radius: 8px; box-shadow: 0 2px 8px hsl(var(--foreground) / 0.08); border: 1px solid hsl(var(--border));">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: hsl(var(--card)); color: hsl(var(--card-foreground)); min-width: 400px;">
              <thead><tr>${header}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>`;
        },

        // 自定义表格单元格渲染
        tablecell(token: Tokens.TableCell): string {
          const cellContent = this.parser.parseInline(token.tokens);
          const type = token.header ? 'th' : 'td';
          const style = token.header
            ? 'border: 1px solid hsl(var(--border)); padding: 12px 8px; background-color: hsl(var(--muted)); text-align: left; font-weight: 600; color: hsl(var(--foreground));'
            : 'border: 1px solid hsl(var(--border)); padding: 10px 8px; color: hsl(var(--foreground)); background-color: hsl(var(--card));';
          return `<${type} style="${style}">${cellContent}</${type}>`;
        },

        // 自定义图片渲染
        image(token: Tokens.Image): string {
          const href = token.href || '';
          const text = token.text || '';
          const title = token.title || '';
          return `<div class="image-container" style="margin: 15px 0; text-align: center;">
            <img src="${href}" alt="${text}" title="${title}"
                 style="max-width: 400px; max-height: 300px; width: auto; height: auto; border-radius: 8px; box-shadow: 0 4px 12px hsl(var(--foreground) / 0.15); border: 1px solid hsl(var(--border)); cursor: pointer;"
                 onload="this.style.opacity='1'"
                 onclick="window.open('${href}', '_blank')"
                 onerror="this.parentElement.innerHTML='<div style=\\'padding: 20px; background: hsl(var(--destructive) / 0.1); border: 1px solid hsl(var(--destructive) / 0.3); border-radius: 8px; color: hsl(var(--destructive));\\'>图片加载失败</div>'"
                 style="opacity: 0; transition: opacity 0.3s;">
          </div>`;
        },

        // 自定义代码块渲染
        code(token: Tokens.Code): string {
          const code = token.text || '';
          const lang = token.lang || 'text';
          return `<div class="code-container" style="margin: 15px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px hsl(var(--foreground) / 0.12); border: 1px solid hsl(var(--border));">
            <div style="background: hsl(var(--muted)); padding: 8px 16px; font-size: 12px; color: hsl(var(--muted-foreground)); border-bottom: 1px solid hsl(var(--border));">
              <span style="color: hsl(var(--primary));">📄</span> ${lang}
            </div>
            <pre style="margin: 0; padding: 16px; background: hsl(var(--secondary)); color: hsl(var(--foreground)); overflow-x: auto;"><code class="language-${lang}" style="color: hsl(var(--foreground)); font-family: 'Fira Code', 'Consolas', monospace;">${code}</code></pre>
          </div>`;
        },

        // 自定义段落渲染
        paragraph(token: Tokens.Paragraph): string {
          const text = this.parser.parseInline(token.tokens);
          return `<p style="margin: 12px 0; line-height: 1.7;">${text}</p>`;
        },

        // 自定义列表渲染
        list(token: Tokens.List): string {
          const tag = token.ordered ? 'ol' : 'ul';
          const body = token.items.map(item => this.listitem(item)).join('');
          return `<${tag} style="margin: 12px 0; padding-left: 24px; color: inherit;">${body}</${tag}>`;
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
          return `<h${level} style="font-size: ${sizes[level]}; margin: ${margins[level]}; font-weight: 600; color: inherit;">${text}</h${level}>`;
        },
      }
    });
  }, [])

  // 使用 useMemo 缓存渲染结果，避免重复计算
  const htmlContent = useMemo(() => {
    if (!content) return '';

    try {
      const result = marked.parse(content);

      // 安全检查
      if (result instanceof Promise) {
        console.error('[SimpleContentRenderer] marked.parse 返回了Promise');
        return content.replace(/\n/g, '<br>');
      }

      if (typeof result === 'string') {
        return result;
      }

      return content.replace(/\n/g, '<br>');
    } catch (error) {
      console.error('[SimpleContentRenderer] Markdown渲染失败:', error);
      return content.replace(/\n/g, '<br>');
    }
  }, [content])

  return (
    <div
      className="simple-content"
      style={{
        lineHeight: 1.7,
        color: 'inherit',
        fontSize: '15px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        letterSpacing: '0.01em',
        wordSpacing: '0.05em'
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}
