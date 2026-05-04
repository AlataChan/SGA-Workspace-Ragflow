import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'
import { withAdminAuth } from '@/lib/auth/middleware'
import { isStorageConfigured, uploadFile, resolveImageDisplayUrl } from '@/lib/storage/s3-client'

export const POST = withAdminAuth(async (request: NextRequest) => {
  try {
    const user = request.user!
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: { code: 'NO_FILE', message: '没有上传文件' } },
        { status: 400 }
      )
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: { code: 'INVALID_TYPE', message: '只能上传图片文件' } },
        { status: 400 }
      )
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: { code: 'FILE_TOO_LARGE', message: '文件大小不能超过10MB' } },
        { status: 400 }
      )
    }

    // 创建上传目录
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'agents')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // 生成文件名
    const timestamp = Date.now()
    const originalName = `${timestamp}_original.jpg`
    const avatarName = `${timestamp}_avatar.jpg`
    
    const originalPath = join(uploadDir, originalName)
    const avatarPath = join(uploadDir, avatarName)

    // 获取文件buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    try {
      // 获取原始图片信息
      const imageInfo = await sharp(buffer).metadata()
      console.log('原始图片信息:', { width: imageInfo.width, height: imageInfo.height, format: imageInfo.format })

      // S3 已配置：输出到 Buffer 并上传到对象存储；否则沿用本地 /uploads 方案
      if (isStorageConfigured()) {
        // 处理展示照片 - 高质量，保持比例
        const photoBuffer = await sharp(buffer)
          .resize(1200, 1200, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .sharpen()
          .jpeg({
            quality: 92,
            progressive: true,
            mozjpeg: true,
          })
          .toBuffer()

        // 智能头像生成 - 高分辨率，智能裁剪
        let avatarPipeline = sharp(buffer)

        // 如果是人像照片，尝试智能裁剪到面部区域（这里使用中心/顶部策略）
        if (imageInfo.width && imageInfo.height) {
          const isPortrait = imageInfo.height > imageInfo.width
          const isLandscape = imageInfo.width > imageInfo.height

          if (isPortrait) {
            avatarPipeline = avatarPipeline.resize(400, 400, {
              fit: 'cover',
              position: 'top',
            })
          } else if (isLandscape) {
            avatarPipeline = avatarPipeline.resize(400, 400, {
              fit: 'cover',
              position: 'center',
            })
          } else {
            avatarPipeline = avatarPipeline.resize(400, 400, {
              fit: 'cover',
              position: 'center',
            })
          }
        } else {
          avatarPipeline = avatarPipeline.resize(400, 400, {
            fit: 'cover',
            position: 'center',
          })
        }

        const avatarBuffer = await avatarPipeline
          .sharpen()
          .jpeg({
            quality: 95,
            progressive: true,
            mozjpeg: true,
          })
          .toBuffer()

        const rand = Math.random().toString(36).slice(2, 10)
        const photoKey = `agents/${user.companyId}/photos/${timestamp}-${rand}.jpg`
        const avatarKey = `agents/${user.companyId}/avatars/${timestamp}-${rand}.jpg`

        await Promise.all([
          uploadFile(photoKey, photoBuffer, 'image/jpeg'),
          uploadFile(avatarKey, avatarBuffer, 'image/jpeg'),
        ])

        const [photoUrl, avatarUrl] = await Promise.all([
          resolveImageDisplayUrl(photoKey),
          resolveImageDisplayUrl(avatarKey),
        ])

        return NextResponse.json({
          success: true,
          photoKey,
          avatarKey,
          photoUrl,
          avatarUrl,
          originalSize: file.size,
          originalType: file.type,
          timestamp,
        })
      }

      // ===== fallback: 本地存储（未配置对象存储）=====
      // 处理展示照片 - 高质量，保持比例
      await sharp(buffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .sharpen() // 增加锐化
        .jpeg({
          quality: 92,
          progressive: true,
          mozjpeg: true // 使用更好的压缩算法
        })
        .toFile(originalPath)

      // 智能头像生成 - 高分辨率，智能裁剪
      let avatarPipeline = sharp(buffer)
      if (imageInfo.width && imageInfo.height) {
        const isPortrait = imageInfo.height > imageInfo.width
        const isLandscape = imageInfo.width > imageInfo.height

        if (isPortrait) {
          avatarPipeline = avatarPipeline.resize(400, 400, {
            fit: 'cover',
            position: 'top' // 从顶部开始裁剪
          })
        } else if (isLandscape) {
          avatarPipeline = avatarPipeline.resize(400, 400, {
            fit: 'cover',
            position: 'center'
          })
        } else {
          avatarPipeline = avatarPipeline.resize(400, 400, {
            fit: 'cover',
            position: 'center'
          })
        }
      } else {
        avatarPipeline = avatarPipeline.resize(400, 400, {
          fit: 'cover',
          position: 'center'
        })
      }

      await avatarPipeline
        .sharpen()
        .jpeg({
          quality: 95,
          progressive: true,
          mozjpeg: true
        })
        .toFile(avatarPath)

      const photoUrl = `/uploads/agents/${originalName}`
      const avatarUrl = `/uploads/agents/${avatarName}`

      return NextResponse.json({
        success: true,
        photoKey: photoUrl,
        avatarKey: avatarUrl,
        photoUrl,
        avatarUrl,
        originalSize: file.size,
        originalType: file.type,
        timestamp
      })

    } catch (imageError) {
      console.error('图片处理失败:', imageError)
      return NextResponse.json(
        { error: { code: 'PROCESSING_ERROR', message: '图片处理失败，请确保上传的是有效的图片文件' } },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('图片上传失败:', error)
    return NextResponse.json(
      { error: { code: 'UPLOAD_ERROR', message: '图片上传失败' } },
      { status: 500 }
    )
  }
})

export const dynamic = 'force-dynamic'
