import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing image URL' }, { status: 400 })
    }

    console.log('[ImageProxy] 代理图片请求:', imageUrl)

    // 获取图片，处理DIFY格式的URL
    let response: Response
    let finalUrl = imageUrl

    // 如果是相对路径，转换为完整的DIFY URL
    if (imageUrl.startsWith('/files/')) {
      // 从请求头或查询参数中获取DIFY基础URL
      const difyBaseUrl = request.headers.get('x-dify-base-url') || 'http://43.139.167.250:9005'
      finalUrl = `${difyBaseUrl}${imageUrl}`
      console.log('[ImageProxy] 转换相对路径为完整URL:', finalUrl)
    }

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
