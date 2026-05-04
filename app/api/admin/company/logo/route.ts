/**
 * 公司Logo上传 API
 * POST /api/admin/company/logo - 上传公司Logo
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/middleware'
import { uploadFile, generateFileKey, isStorageConfigured, resolveImageDisplayUrl } from '@/lib/storage/s3-client'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// POST /api/admin/company/logo - 上传公司Logo
export const POST = withAdminAuth(async (request) => {
  try {
    const user = request.user!
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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // S3 已配置：上传到对象存储，DB 存 key；返回预签名 URL 用于预览
    if (isStorageConfigured()) {
      const logoKey = generateFileKey(file.name, `companies/${user.companyId}/logos`)
      await uploadFile(logoKey, buffer, file.type || 'application/octet-stream')
      const logoUrl = await resolveImageDisplayUrl(logoKey)

      return NextResponse.json({
        data: {
          logoKey,
          logoUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        },
        message: 'Logo上传成功'
      })
    }

    // 未配置对象存储：回退到本地 /uploads/logos（旧逻辑）
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop() || 'png'
    const fileName = `company-logo-${timestamp}.${fileExtension}`
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos')
    await mkdir(uploadDir, { recursive: true })
    const filePath = join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    const logoUrl = `/uploads/logos/${fileName}`
    return NextResponse.json({
      data: {
        logoKey: logoUrl,
        logoUrl,
        fileName: file.name,
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
