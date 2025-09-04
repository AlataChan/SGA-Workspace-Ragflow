/**
 * 公司Logo上传 API
 * POST /api/admin/company/logo - 上传公司Logo
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { withAdminAuth } from '@/lib/auth/middleware'

// POST /api/admin/company/logo - 上传公司Logo
export const POST = withAdminAuth(async (request) => {
  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File

    if (!file) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_FILE',
            message: '请选择要上传的文件'
          }
        },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FILE_TYPE',
            message: '只支持图片文件'
          }
        },
        { status: 400 }
      )
    }

    // 验证文件大小 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: {
            code: 'FILE_TOO_LARGE',
            message: '文件大小不能超过2MB'
          }
        },
        { status: 400 }
      )
    }

    // 生成文件名
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop() || 'png'
    const fileName = `company-logo-${timestamp}.${fileExtension}`

    // 确保上传目录存在
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // 目录可能已存在，忽略错误
    }

    // 保存文件
    const filePath = join(uploadDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    await writeFile(filePath, buffer)

    // 生成访问URL
    const logoUrl = `/uploads/logos/${fileName}`

    return NextResponse.json({
      data: {
        logoUrl,
        fileName,
        fileSize: file.size,
        fileType: file.type,
      },
      message: 'Logo上传成功'
    })

  } catch (error) {
    console.error('Logo上传失败:', error)
    return NextResponse.json(
      {
        error: {
          code: 'UPLOAD_ERROR',
          message: '文件上传失败，请稍后重试'
        }
      },
      { status: 500 }
    )
  }
})
