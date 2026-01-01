import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth/middleware'
import { z } from 'zod'

// 验证schema
const generateAvatarSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
  style: z.enum(['initials', 'robohash', 'identicon', 'bottts', 'avataaars']).default('initials'),
  size: z.number().min(50).max(1000).default(200),
  background: z.string().optional(),
  color: z.string().optional()
})

// 头像风格配置
const avatarStyles = {
  initials: {
    baseUrl: 'https://ui-avatars.com/api/',
    params: (name: string, size: number, bg?: string, color?: string) => ({
      name: encodeURIComponent(name),
      size: size.toString(),
      background: bg || '6a5acd',
      color: color || 'ffffff',
      format: 'png',
      rounded: 'true',
      bold: 'true'
    })
  },
  robohash: {
    baseUrl: 'https://robohash.org/',
    params: (name: string, size: number) => ({
      set: 'set1', // 机器人风格
      size: `${size}x${size}`
    }),
    buildUrl: (name: string, size: number) => 
      `https://robohash.org/${encodeURIComponent(name)}.png?set=set1&size=${size}x${size}`
  },
  identicon: {
    baseUrl: 'https://robohash.org/',
    buildUrl: (name: string, size: number) => 
      `https://robohash.org/${encodeURIComponent(name)}.png?set=set4&size=${size}x${size}`
  },
  bottts: {
    baseUrl: 'https://robohash.org/',
    buildUrl: (name: string, size: number) => 
      `https://robohash.org/${encodeURIComponent(name)}.png?set=set3&size=${size}x${size}`
  },
  avataaars: {
    baseUrl: 'https://avataaars.io/',
    buildUrl: (name: string, size: number) => {
      // 基于名称生成一致的参数
      const hash = name.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
      }, 0)
      
      const topTypes = ['NoHair', 'Eyepatch', 'Hat', 'Hijab', 'Turban', 'WinterHat1', 'WinterHat2', 'WinterHat3', 'WinterHat4', 'LongHairBigHair', 'LongHairBob', 'LongHairBun', 'LongHairCurly', 'LongHairCurvy', 'LongHairDreads', 'LongHairFrida', 'LongHairFro', 'LongHairFroBand', 'LongHairNotTooLong', 'LongHairShavedSides', 'LongHairMiaWallace', 'LongHairStraight', 'LongHairStraight2', 'LongHairStraightStrand', 'ShortHairDreads01', 'ShortHairDreads02', 'ShortHairFrizzle', 'ShortHairShaggyMullet', 'ShortHairShortCurly', 'ShortHairShortFlat', 'ShortHairShortRound', 'ShortHairShortWaved', 'ShortHairSides', 'ShortHairTheCaesar', 'ShortHairTheCaesarSidePart']
      const accessoriesTypes = ['Blank', 'Kurt', 'Prescription01', 'Prescription02', 'Round', 'Sunglasses', 'Wayfarers']
      const facialHairTypes = ['Blank', 'BeardMedium', 'BeardLight', 'BeardMagestic', 'MoustacheFancy', 'MoustacheMagnum']
      const clotheTypes = ['BlazerShirt', 'BlazerSweater', 'CollarSweater', 'GraphicShirt', 'Hoodie', 'Overall', 'ShirtCrewNeck', 'ShirtScoopNeck', 'ShirtVNeck']
      const eyeTypes = ['Close', 'Cry', 'Default', 'Dizzy', 'EyeRoll', 'Happy', 'Hearts', 'Side', 'Squint', 'Surprised', 'Wink', 'WinkWacky']
      const eyebrowTypes = ['Angry', 'AngryNatural', 'Default', 'DefaultNatural', 'FlatNatural', 'RaisedExcited', 'RaisedExcitedNatural', 'SadConcerned', 'SadConcernedNatural', 'UnibrowNatural', 'UpDown', 'UpDownNatural']
      const mouthTypes = ['Concerned', 'Default', 'Disbelief', 'Eating', 'Grimace', 'Sad', 'ScreamOpen', 'Serious', 'Smile', 'Tongue', 'Twinkle', 'Vomit']
      const skinColors = ['Tanned', 'Yellow', 'Pale', 'Light', 'Brown', 'DarkBrown', 'Black']
      
      const topType = topTypes[Math.abs(hash) % topTypes.length]
      const accessoriesType = accessoriesTypes[Math.abs(hash >> 4) % accessoriesTypes.length]
      const facialHairType = facialHairTypes[Math.abs(hash >> 8) % facialHairTypes.length]
      const clotheType = clotheTypes[Math.abs(hash >> 12) % clotheTypes.length]
      const eyeType = eyeTypes[Math.abs(hash >> 16) % eyeTypes.length]
      const eyebrowType = eyebrowTypes[Math.abs(hash >> 20) % eyebrowTypes.length]
      const mouthType = mouthTypes[Math.abs(hash >> 24) % mouthTypes.length]
      const skinColor = skinColors[Math.abs(hash >> 28) % skinColors.length]
      
      return `https://avataaars.io/?avatarStyle=Circle&topType=${topType}&accessoriesType=${accessoriesType}&facialHairType=${facialHairType}&clotheType=${clotheType}&eyeType=${eyeType}&eyebrowType=${eyebrowType}&mouthType=${mouthType}&skinColor=${skinColor}`
    }
  }
}

function generateAvatarUrl(name: string, style: string, size: number, background?: string, color?: string): string {
  const styleConfig = avatarStyles[style as keyof typeof avatarStyles] as any

  if (!styleConfig) {
    throw new Error(`不支持的头像风格: ${style}`)
  }

  if (styleConfig.buildUrl) {
    return styleConfig.buildUrl(name, size)
  }

  if (style === 'initials' && styleConfig.params) {
    const params = styleConfig.params(name, size, background, color)
    const searchParams = new URLSearchParams(params)
    return `${styleConfig.baseUrl}?${searchParams.toString()}`
  }

  throw new Error(`头像风格 ${style} 配置错误`)
}

async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = generateAvatarSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: '参数验证失败', details: validation.error.errors } },
        { status: 400 }
      )
    }

    const { name, style, size, background, color } = validation.data

    // 生成头像URL
    const avatarUrl = generateAvatarUrl(name, style, size, background, color)
    
    // 生成多种风格的预览
    const previews = Object.keys(avatarStyles).map(styleKey => ({
      style: styleKey,
      url: generateAvatarUrl(name, styleKey, 100),
      name: {
        initials: '字母头像',
        robohash: '机器人风格',
        identicon: '几何图案',
        bottts: '机器人头像',
        avataaars: '卡通头像'
      }[styleKey] || styleKey
    }))

    return NextResponse.json({
      success: true,
      avatarUrl,
      style,
      previews,
      metadata: {
        name,
        size,
        background,
        color,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('生成头像失败:', error)
    return NextResponse.json(
      { error: { code: 'GENERATION_ERROR', message: '生成头像失败' } },
      { status: 500 }
    )
  }
}

export { POST }
export const dynamic = 'force-dynamic'
