/**
 * 实体颜色管理模块
 *
 * 功能：
 * - 为知识图谱实体类型提供动态颜色分配
 * - 支持50种高区分度颜色（纯颜色区分）
 * - 支持扩展到200种（颜色+边框样式）
 * - 统一大小写处理，确保一致性
 */

// ============================================
// 第一层：20种精选高区分度颜色
// ============================================
const CURATED_COLORS = [
  '#3B82F6', // 蓝色
  '#10B981', // 绿色
  '#F59E0B', // 橙色
  '#8B5CF6', // 紫色
  '#EC4899', // 粉色
  '#EF4444', // 红色
  '#06B6D4', // 青色
  '#84CC16', // 黄绿色
  '#F97316', // 深橙色
  '#6366F1', // 靛蓝色
  '#14B8A6', // 蓝绿色
  '#A855F7', // 亮紫色
  '#0EA5E9', // 天蓝色
  '#22C55E', // 亮绿色
  '#E11D48', // 玫红色
  '#7C3AED', // 深紫色
  '#0891B2', // 深青色
  '#CA8A04', // 深黄色
  '#DB2777', // 深粉色
  '#059669', // 深绿色
]

// ============================================
// 第二层：30种程序化生成的补充颜色
// 使用HSL色相均匀分布，确保区分度
// ============================================
function generateAdditionalColors(count: number): string[] {
  const colors: string[] = []
  const saturation = 70 // 饱和度
  const lightness = 50  // 亮度

  for (let i = 0; i < count; i++) {
    // 使用黄金比例分布色相，避免相邻颜色过于接近
    const hue = (i * 137.508) % 360
    colors.push(`hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`)
  }

  return colors
}

// 生成30种补充颜色
const GENERATED_COLORS = generateAdditionalColors(30)

// 合并为50种基础颜色
const ALL_COLORS = [...CURATED_COLORS, ...GENERATED_COLORS]

// ============================================
// 第三层：边框样式（用于超过50种类型时）
// ============================================
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'

const BORDER_STYLES: BorderStyle[] = ['solid', 'dashed', 'dotted', 'double']

// ============================================
// 预定义的常见实体类型及其颜色
// 统一使用小写，调用时自动转换
// ============================================
const PREDEFINED_ENTITY_COLORS: Record<string, string> = {
  // 人物相关
  'person': '#3B82F6',      // 蓝色
  'people': '#3B82F6',
  'human': '#3B82F6',
  'user': '#3B82F6',

  // 组织相关
  'organization': '#10B981', // 绿色
  'org': '#10B981',
  'company': '#10B981',
  'department': '#059669',   // 深绿色
  'team': '#14B8A6',         // 蓝绿色

  // 地理相关
  'geo': '#F59E0B',          // 橙色
  'location': '#F59E0B',
  'place': '#F59E0B',
  'address': '#F97316',      // 深橙色
  'country': '#CA8A04',      // 深黄色
  'city': '#F59E0B',

  // 事件相关
  'event': '#8B5CF6',        // 紫色
  'activity': '#A855F7',     // 亮紫色
  'meeting': '#7C3AED',      // 深紫色

  // 分类相关
  'category': '#EC4899',     // 粉色
  'tag': '#DB2777',          // 深粉色
  'label': '#EC4899',
  'type': '#EC4899',

  // 概念相关
  'concept': '#6366F1',      // 靛蓝色
  'idea': '#6366F1',
  'topic': '#6366F1',

  // 文档相关
  'document': '#0EA5E9',     // 天蓝色
  'file': '#0EA5E9',
  'doc': '#0EA5E9',
  'article': '#0891B2',      // 深青色

  // 项目相关
  'project': '#06B6D4',      // 青色
  'task': '#06B6D4',
  'work': '#06B6D4',

  // 技术相关
  'technology': '#84CC16',   // 黄绿色
  'tech': '#84CC16',
  'tool': '#22C55E',         // 亮绿色
  'skill': '#84CC16',

  // 产品相关
  'product': '#EF4444',      // 红色
  'service': '#E11D48',      // 玫红色
  'item': '#EF4444',
}

// ============================================
// 临时节点的颜色变体
// ============================================
const TEMPORARY_COLOR_SHIFT = {
  saturation: 1.2,  // 增加饱和度
  lightness: 1.1,   // 稍微变亮
}

// ============================================
// 动态颜色分配器
// 用于跟踪已分配的颜色，确保未知类型获得唯一颜色
// ============================================
class EntityColorManager {
  private typeColorMap: Map<string, number> = new Map()
  private nextColorIndex: number = 0

  /**
   * 规范化实体类型名称
   * 统一转为小写，去除空格
   */
  private normalizeType(type: string): string {
    return type.toLowerCase().trim()
  }

  /**
   * 获取实体类型的颜色
   * @param type 实体类型
   * @param isTemporary 是否为临时节点
   * @returns 颜色值（hex或hsl格式）
   */
  getColor(type: string, isTemporary: boolean = false): string {
    const normalizedType = this.normalizeType(type)

    let baseColor: string

    // 1. 首先检查预定义颜色
    if (PREDEFINED_ENTITY_COLORS[normalizedType]) {
      baseColor = PREDEFINED_ENTITY_COLORS[normalizedType]
    } else {
      // 2. 检查是否已分配过颜色
      if (this.typeColorMap.has(normalizedType)) {
        const colorIndex = this.typeColorMap.get(normalizedType)!
        baseColor = ALL_COLORS[colorIndex % ALL_COLORS.length]
      } else {
        // 3. 分配新颜色
        // 跳过已被预定义类型使用的颜色
        let colorIndex = this.nextColorIndex
        while (colorIndex < ALL_COLORS.length) {
          const color = ALL_COLORS[colorIndex]
          if (!Object.values(PREDEFINED_ENTITY_COLORS).includes(color)) {
            break
          }
          colorIndex++
        }

        // 如果所有颜色都用完了，从头开始循环
        if (colorIndex >= ALL_COLORS.length) {
          colorIndex = this.nextColorIndex % ALL_COLORS.length
        }

        this.typeColorMap.set(normalizedType, colorIndex)
        this.nextColorIndex = colorIndex + 1
        baseColor = ALL_COLORS[colorIndex % ALL_COLORS.length]
      }
    }

    // 4. 如果是临时节点，调整颜色
    if (isTemporary) {
      return this.adjustColorForTemporary(baseColor)
    }

    return baseColor
  }

  /**
   * 获取实体类型的边框样式
   * 当颜色不足以区分时使用
   * @param type 实体类型
   */
  getBorderStyle(type: string): BorderStyle {
    const normalizedType = this.normalizeType(type)

    // 预定义类型使用实线
    if (PREDEFINED_ENTITY_COLORS[normalizedType]) {
      return 'solid'
    }

    // 其他类型根据索引分配边框样式
    const colorIndex = this.typeColorMap.get(normalizedType) || 0
    const styleIndex = Math.floor(colorIndex / ALL_COLORS.length)
    return BORDER_STYLES[styleIndex % BORDER_STYLES.length]
  }

  /**
   * 调整颜色用于临时节点
   * 增加饱和度和亮度，使其更醒目
   */
  private adjustColorForTemporary(color: string): string {
    // 如果是HSL格式
    if (color.startsWith('hsl')) {
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
      if (match) {
        const h = parseInt(match[1])
        const s = Math.min(100, parseInt(match[2]) * TEMPORARY_COLOR_SHIFT.saturation)
        const l = Math.min(90, parseInt(match[3]) * TEMPORARY_COLOR_SHIFT.lightness)
        return `hsl(${h}, ${Math.round(s)}%, ${Math.round(l)}%)`
      }
    }

    // 如果是HEX格式，转换为HSL后调整
    if (color.startsWith('#')) {
      const hsl = this.hexToHsl(color)
      const s = Math.min(100, hsl.s * TEMPORARY_COLOR_SHIFT.saturation)
      const l = Math.min(90, hsl.l * TEMPORARY_COLOR_SHIFT.lightness)
      return `hsl(${Math.round(hsl.h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
    }

    return color
  }

  /**
   * HEX颜色转HSL
   */
  private hexToHsl(hex: string): { h: number; s: number; l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) {
      return { h: 0, s: 0, l: 50 }
    }

    let r = parseInt(result[1], 16) / 255
    let g = parseInt(result[2], 16) / 255
    let b = parseInt(result[3], 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6
          break
        case g:
          h = ((b - r) / d + 2) / 6
          break
        case b:
          h = ((r - g) / d + 4) / 6
          break
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  /**
   * 获取所有已使用的颜色类型映射
   * 用于生成图例
   */
  getColorMap(): Map<string, string> {
    const map = new Map<string, string>()

    // 添加预定义颜色
    for (const [type, color] of Object.entries(PREDEFINED_ENTITY_COLORS)) {
      map.set(type, color)
    }

    // 添加动态分配的颜色
    this.typeColorMap.forEach((index, type) => {
      if (!PREDEFINED_ENTITY_COLORS[type]) {
        map.set(type, ALL_COLORS[index % ALL_COLORS.length])
      }
    })

    return map
  }

  /**
   * 重置颜色分配器
   * 在需要重新开始颜色分配时调用
   */
  reset(): void {
    this.typeColorMap.clear()
    this.nextColorIndex = 0
  }

  /**
   * 获取颜色统计信息
   */
  getStats(): {
    predefinedCount: number
    dynamicCount: number
    totalCapacity: number
    usedCount: number
  } {
    return {
      predefinedCount: Object.keys(PREDEFINED_ENTITY_COLORS).length,
      dynamicCount: this.typeColorMap.size,
      totalCapacity: ALL_COLORS.length * BORDER_STYLES.length, // 200种
      usedCount: Object.keys(PREDEFINED_ENTITY_COLORS).length + this.typeColorMap.size
    }
  }
}

// ============================================
// 导出单例实例和工具函数
// ============================================

// 全局单例，确保颜色分配一致性
export const entityColorManager = new EntityColorManager()

/**
 * 获取实体颜色的便捷函数
 * @param type 实体类型
 * @param isTemporary 是否为临时节点
 */
export function getEntityColor(type: string, isTemporary: boolean = false): string {
  return entityColorManager.getColor(type, isTemporary)
}

/**
 * 获取实体边框样式的便捷函数
 * @param type 实体类型
 */
export function getEntityBorderStyle(type: string): BorderStyle {
  return entityColorManager.getBorderStyle(type)
}

/**
 * 重置颜色管理器
 */
export function resetEntityColors(): void {
  entityColorManager.reset()
}

/**
 * 获取预定义的实体类型列表
 */
export function getPredefinedEntityTypes(): string[] {
  return Object.keys(PREDEFINED_ENTITY_COLORS)
}

/**
 * 获取所有50种基础颜色
 */
export function getAllColors(): string[] {
  return [...ALL_COLORS]
}

/**
 * 默认颜色（用于完全未知的情况）
 */
export const DEFAULT_ENTITY_COLOR = '#6B7280' // 灰色
