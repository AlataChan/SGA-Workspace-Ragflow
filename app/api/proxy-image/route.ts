import { NextRequest, NextResponse } from 'next/server'
import { resolveAllowedDifyImageUrl, shouldProxyDifyImageUrl } from '@/lib/utils/dify-file-url'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing image URL' }, { status: 400 })
    }

    console.log('[ImageProxy] 代理图片请求:', imageUrl)

    const configuredDifyBaseUrl = process.env.DEFAULT_DIFY_BASE_URL || ''
    const finalUrl = resolveAllowedDifyImageUrl(imageUrl, configuredDifyBaseUrl)

    if (!finalUrl) {
      if (shouldProxyDifyImageUrl(imageUrl) && !configuredDifyBaseUrl) {
        return NextResponse.json(
          { error: 'Dify base URL is not configured' },
          { status: 503 }
        )
      }

      return NextResponse.json(
        { error: 'Only configured Dify file URLs can be proxied' },
        { status: 403 }
      )
    }

    console.log('[ImageProxy] 解析后的 Dify 图片URL:', finalUrl)

    // 获取图片，严格限制为配置中的 Dify 文件地址
    let response: Response

    try {
      response = await fetch(finalUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*'
        }
      })

      console.log('[ImageProxy] 图片请求状态:', response.status, response.statusText)
    } catch (error) {
      console.error('[ImageProxy] 图片请求异常:', error)
      throw error
    }

    if (!response.ok) {
      console.error('[ImageProxy] 图片获取失败:', response.status, response.statusText)
      return NextResponse.json({ 
        error: 'Failed to fetch image',
        status: response.status,
        statusText: response.statusText 
      }, { status: response.status })
    }

    const imageBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'

    console.log('[ImageProxy] 图片代理成功:', {
      url: imageUrl,
      contentType,
      size: imageBuffer.byteLength
    })

    // 返回图片
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // 缓存1小时
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (error) {
    console.error('[ImageProxy] 代理图片时发生错误:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
