import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('url')
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Missing image URL' }, { status: 400 })
    }

    console.log('[ImageProxy] 代理图片请求:', imageUrl)

    // 获取图片，尝试添加认证头
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Authorization': 'Bearer app-ZxqRT3IdtQV0tRGp3O0nsLf2', // 使用Dify API Key
        'Accept': 'image/*,*/*'
      }
    })

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
