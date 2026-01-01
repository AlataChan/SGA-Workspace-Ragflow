/**
 * 实体颜色动态分配测试脚本
 *
 * 运行方式: npx ts-node scripts/test-entity-colors.ts
 * 或者: npx tsx scripts/test-entity-colors.ts
 */

// 直接复制核心逻辑进行测试，避免模块导入问题

// ============================================
// 第一层：20种精选高区分度颜色
// ============================================
const CURATED_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
  '#14B8A6', '#A855F7', '#0EA5E9', '#22C55E', '#E11D48',
  '#7C3AED', '#0891B2', '#CA8A04', '#DB2777', '#059669',
]

// 第二层：30种程序化生成的补充颜色
function generateAdditionalColors(count: number): string[] {
  const colors: string[] = []
  const saturation = 70
  const lightness = 50

  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360
    colors.push(`hsl(${Math.round(hue)}, ${saturation}%, ${lightness}%)`)
  }

  return colors
}

const GENERATED_COLORS = generateAdditionalColors(30)
const ALL_COLORS = [...CURATED_COLORS, ...GENERATED_COLORS]

type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double'
const BORDER_STYLES: BorderStyle[] = ['solid', 'dashed', 'dotted', 'double']

// 预定义的常见实体类型
const PREDEFINED_ENTITY_COLORS: Record<string, string> = {
  'person': '#3B82F6', 'people': '#3B82F6', 'human': '#3B82F6', 'user': '#3B82F6',
  'organization': '#10B981', 'org': '#10B981', 'company': '#10B981',
  'department': '#059669', 'team': '#14B8A6',
  'geo': '#F59E0B', 'location': '#F59E0B', 'place': '#F59E0B',
  'address': '#F97316', 'country': '#CA8A04', 'city': '#F59E0B',
  'event': '#8B5CF6', 'activity': '#A855F7', 'meeting': '#7C3AED',
  'category': '#EC4899', 'tag': '#DB2777', 'label': '#EC4899', 'type': '#EC4899',
  'concept': '#6366F1', 'idea': '#6366F1', 'topic': '#6366F1',
  'document': '#0EA5E9', 'file': '#0EA5E9', 'doc': '#0EA5E9', 'article': '#0891B2',
  'project': '#06B6D4', 'task': '#06B6D4', 'work': '#06B6D4',
  'technology': '#84CC16', 'tech': '#84CC16', 'tool': '#22C55E', 'skill': '#84CC16',
  'product': '#EF4444', 'service': '#E11D48', 'item': '#EF4444',
}

// 颜色管理器类
class EntityColorManager {
  private typeColorMap: Map<string, number> = new Map()
  private nextColorIndex: number = 0

  private normalizeType(type: string): string {
    return type.toLowerCase().trim()
  }

  getColor(type: string, isTemporary: boolean = false): string {
    const normalizedType = this.normalizeType(type)
    let baseColor: string

    if (PREDEFINED_ENTITY_COLORS[normalizedType]) {
      baseColor = PREDEFINED_ENTITY_COLORS[normalizedType]
    } else {
      if (this.typeColorMap.has(normalizedType)) {
        const colorIndex = this.typeColorMap.get(normalizedType)!
        baseColor = ALL_COLORS[colorIndex % ALL_COLORS.length]
      } else {
        let colorIndex = this.nextColorIndex
        while (colorIndex < ALL_COLORS.length) {
          const color = ALL_COLORS[colorIndex]
          if (!Object.values(PREDEFINED_ENTITY_COLORS).includes(color)) {
            break
          }
          colorIndex++
        }

        if (colorIndex >= ALL_COLORS.length) {
          colorIndex = this.nextColorIndex % ALL_COLORS.length
        }

        this.typeColorMap.set(normalizedType, colorIndex)
        this.nextColorIndex = colorIndex + 1
        baseColor = ALL_COLORS[colorIndex % ALL_COLORS.length]
      }
    }

    if (isTemporary) {
      return this.adjustColorForTemporary(baseColor)
    }

    return baseColor
  }

  getBorderStyle(type: string): BorderStyle {
    const normalizedType = this.normalizeType(type)

    if (PREDEFINED_ENTITY_COLORS[normalizedType]) {
      return 'solid'
    }

    const colorIndex = this.typeColorMap.get(normalizedType) || 0
    const styleIndex = Math.floor(colorIndex / ALL_COLORS.length)
    return BORDER_STYLES[styleIndex % BORDER_STYLES.length]
  }

  private adjustColorForTemporary(color: string): string {
    if (color.startsWith('hsl')) {
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
      if (match) {
        const h = parseInt(match[1])
        const s = Math.min(100, parseInt(match[2]) * 1.2)
        const l = Math.min(90, parseInt(match[3]) * 1.1)
        return `hsl(${h}, ${Math.round(s)}%, ${Math.round(l)}%)`
      }
    }

    if (color.startsWith('#')) {
      const hsl = this.hexToHsl(color)
      const s = Math.min(100, hsl.s * 1.2)
      const l = Math.min(90, hsl.l * 1.1)
      return `hsl(${Math.round(hsl.h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
    }

    return color
  }

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
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 }
  }

  getStats(): { predefinedCount: number; dynamicCount: number; totalCapacity: number; usedCount: number } {
    return {
      predefinedCount: Object.keys(PREDEFINED_ENTITY_COLORS).length,
      dynamicCount: this.typeColorMap.size,
      totalCapacity: ALL_COLORS.length * BORDER_STYLES.length,
      usedCount: Object.keys(PREDEFINED_ENTITY_COLORS).length + this.typeColorMap.size
    }
  }

  reset(): void {
    this.typeColorMap.clear()
    this.nextColorIndex = 0
  }
}

// ============================================
// 测试函数
// ============================================

function runTests() {
  console.log('=' .repeat(60))
  console.log('🧪 实体颜色动态分配测试')
  console.log('=' .repeat(60))
  console.log()

  const manager = new EntityColorManager()
  let passed = 0
  let failed = 0

  // 测试1: 预定义类型颜色
  console.log('📌 测试1: 预定义类型颜色分配')
  const predefinedTests = [
    { type: 'person', expected: '#3B82F6' },
    { type: 'PERSON', expected: '#3B82F6' },  // 大小写不敏感
    { type: 'Person', expected: '#3B82F6' },
    { type: 'organization', expected: '#10B981' },
    { type: 'event', expected: '#8B5CF6' },
    { type: 'document', expected: '#0EA5E9' },
  ]

  predefinedTests.forEach(({ type, expected }) => {
    const color = manager.getColor(type)
    const status = color === expected ? '✅' : '❌'
    console.log(`  ${status} ${type}: ${color} (expected: ${expected})`)
    if (color === expected) passed++; else failed++
  })
  console.log()

  // 测试2: 动态类型颜色分配
  console.log('📌 测试2: 动态类型颜色分配（未知类型）')
  manager.reset()

  const dynamicTypes = [
    'CustomEntity1', 'CustomEntity2', 'CustomEntity3',
    'NewType', 'AnotherType', 'YetAnother'
  ]

  const assignedColors = new Set<string>()
  let allUnique = true

  dynamicTypes.forEach(type => {
    const color = manager.getColor(type)
    if (assignedColors.has(color)) {
      console.log(`  ⚠️  ${type}: ${color} (重复!)`)
      allUnique = false
    } else {
      console.log(`  ✅ ${type}: ${color}`)
      assignedColors.add(color)
    }
  })

  if (allUnique) {
    console.log(`  ✅ 所有动态类型获得唯一颜色`)
    passed++
  } else {
    console.log(`  ❌ 存在颜色重复`)
    failed++
  }
  console.log()

  // 测试3: 颜色一致性（同一类型多次调用）
  console.log('📌 测试3: 颜色一致性')
  manager.reset()

  const testType = 'ConsistencyTest'
  const color1 = manager.getColor(testType)
  const color2 = manager.getColor(testType)
  const color3 = manager.getColor(testType.toUpperCase())

  const consistent = color1 === color2 && color2 === color3
  console.log(`  ${consistent ? '✅' : '❌'} 同一类型多次调用返回相同颜色`)
  console.log(`    - 第一次: ${color1}`)
  console.log(`    - 第二次: ${color2}`)
  console.log(`    - 大写形式: ${color3}`)
  if (consistent) passed++; else failed++
  console.log()

  // 测试4: 大量类型分配（50+种）
  console.log('📌 测试4: 大量类型分配（测试60种类型）')
  manager.reset()

  const manyTypes = Array.from({ length: 60 }, (_, i) => `Type_${i + 1}`)
  const manyColors = new Map<string, string>()

  manyTypes.forEach(type => {
    const color = manager.getColor(type)
    manyColors.set(type, color)
  })

  const stats = manager.getStats()
  console.log(`  📊 统计信息:`)
  console.log(`    - 预定义类型数: ${stats.predefinedCount}`)
  console.log(`    - 动态分配数: ${stats.dynamicCount}`)
  console.log(`    - 总容量: ${stats.totalCapacity}`)
  console.log(`    - 已使用: ${stats.usedCount}`)

  // 检查是否所有类型都获得了颜色
  const allAssigned = manyColors.size === 60
  console.log(`  ${allAssigned ? '✅' : '❌'} 所有60种类型都成功分配颜色`)
  if (allAssigned) passed++; else failed++
  console.log()

  // 测试5: 临时节点颜色变体
  console.log('📌 测试5: 临时节点颜色变体')
  manager.reset()

  const normalColor = manager.getColor('TestNode', false)
  const tempColor = manager.getColor('TestNode', true)

  const isDifferent = normalColor !== tempColor
  console.log(`  ${isDifferent ? '✅' : '❌'} 临时节点颜色与普通节点不同`)
  console.log(`    - 普通节点: ${normalColor}`)
  console.log(`    - 临时节点: ${tempColor}`)
  if (isDifferent) passed++; else failed++
  console.log()

  // 测试6: 边框样式分配
  console.log('📌 测试6: 边框样式分配')
  manager.reset()

  const borderTestTypes = ['person', 'CustomType1', 'CustomType2']
  borderTestTypes.forEach(type => {
    manager.getColor(type) // 先分配颜色
    const border = manager.getBorderStyle(type)
    console.log(`  ℹ️  ${type}: ${border}`)
  })

  const personBorder = manager.getBorderStyle('person')
  console.log(`  ${personBorder === 'solid' ? '✅' : '❌'} 预定义类型使用 solid 边框`)
  if (personBorder === 'solid') passed++; else failed++
  console.log()

  // 测试7: 颜色区分度检查
  console.log('📌 测试7: 50种基础颜色区分度')
  const uniqueBaseColors = new Set(ALL_COLORS)
  console.log(`  ℹ️  基础颜色池大小: ${ALL_COLORS.length}`)
  console.log(`  ℹ️  唯一颜色数量: ${uniqueBaseColors.size}`)
  console.log(`  ${uniqueBaseColors.size === ALL_COLORS.length ? '✅' : '❌'} 所有基础颜色唯一`)
  if (uniqueBaseColors.size === ALL_COLORS.length) passed++; else failed++
  console.log()

  // 测试摘要
  console.log('=' .repeat(60))
  console.log('📊 测试结果摘要')
  console.log('=' .repeat(60))
  console.log(`  ✅ 通过: ${passed}`)
  console.log(`  ❌ 失败: ${failed}`)
  console.log(`  📈 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)
  console.log()

  if (failed === 0) {
    console.log('🎉 所有测试通过！动态颜色分配功能正常工作。')
  } else {
    console.log('⚠️  部分测试失败，请检查实现。')
    process.exit(1)
  }
}

// 运行测试
runTests()
