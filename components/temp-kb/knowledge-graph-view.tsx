'use client'

/**
 * 知识图谱可视化组件
 * 使用 D3.js 力导向图展示知识图谱的节点和关系
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { Loader2, ZoomIn, ZoomOut, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getEntityColor } from '@/lib/utils/entity-colors'

/**
 * 图谱节点数据结构
 */
interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  entity_name: string
  entity_type: string
  description?: string
  pagerank?: number
}

/**
 * 图谱边数据结构
 */
interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  description?: string
  weight?: number
}

/**
 * 图谱数据结构
 */
interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface KnowledgeGraphViewProps {
  className?: string
  /** 容器高度（px），默认 300 */
  height?: number
}

type LabelMode = 'auto' | 'all' | 'off'

/**
 * 根据 pagerank 计算节点大小
 */
function getNodeRadius(pagerank?: number): number {
  const pr = typeof pagerank === 'number' && Number.isFinite(pagerank) ? pagerank : 0
  // 更贴近参考图：整体更轻、更密、节点更小
  // pagerank 范围通常是 0-1，映射到 12-24
  return Math.max(12, Math.min(24, 12 + pr * 12))
}

export default function KnowledgeGraphView({ className, height = 300 }: KnowledgeGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const svgUid = useMemo(() => `temp-kb-kg-${Math.random().toString(36).slice(2, 9)}`, [])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [graphBuildStatus, setGraphBuildStatus] = useState<{ status: string; progress?: number } | null>(null)
  const [legendOpen, setLegendOpen] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set())
  const [typeFilterInitialized, setTypeFilterInitialized] = useState(false)
  const [labelMode, setLabelMode] = useState<LabelMode>('auto')
  const [clusterByType, setClusterByType] = useState(false)
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    content: string
  }>({ visible: false, x: 0, y: 0, content: '' })

  const allEntityTypes = useMemo(() => {
    if (!graphData) return []
    return [...new Set(graphData.nodes.map(n => n.entity_type).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
  }, [graphData])

  // 初始化/同步筛选类型（默认全选；数据刷新时保留用户选择）
  useEffect(() => {
    if (allEntityTypes.length === 0) return
    setSelectedTypes(prev => {
      if (prev.size === 0) return new Set(allEntityTypes)
      const next = new Set<string>()
      for (const type of allEntityTypes) {
        if (prev.has(type)) next.add(type)
      }
      return next.size > 0 ? next : new Set(allEntityTypes)
    })
    setTypeFilterInitialized(true)
  }, [allEntityTypes])

  const allEntityTypesSet = useMemo(() => new Set(allEntityTypes), [allEntityTypes])
  const effectiveSelectedTypes = typeFilterInitialized ? selectedTypes : allEntityTypesSet

  const filteredGraph = useMemo<GraphData | null>(() => {
    if (!graphData) return null
    const allowed = effectiveSelectedTypes
    const nodes = graphData.nodes.filter(n => allowed.has(n.entity_type))
    const nodeIds = new Set(nodes.map(n => n.id))
    const edges = graphData.edges.filter(e => {
      const sourceId = typeof e.source === 'string' ? e.source : e.source.id
      const targetId = typeof e.target === 'string' ? e.target : e.target.id
      return nodeIds.has(sourceId) && nodeIds.has(targetId)
    })
    return { nodes, edges }
  }, [graphData, effectiveSelectedTypes])

  const typeCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const n of graphData?.nodes ?? []) {
      counts[n.entity_type] = (counts[n.entity_type] ?? 0) + 1
    }
    return counts
  }, [graphData])

  const autoLabelIds = useMemo(() => {
    if (!filteredGraph) return new Set<string>()
    const degree = new Map<string, number>()
    for (const e of filteredGraph.edges) {
      const sourceId = typeof e.source === 'string' ? e.source : e.source.id
      const targetId = typeof e.target === 'string' ? e.target : e.target.id
      degree.set(sourceId, (degree.get(sourceId) ?? 0) + 1)
      degree.set(targetId, (degree.get(targetId) ?? 0) + 1)
    }

    const maxLabels = Math.max(12, Math.min(32, Math.floor(filteredGraph.nodes.length * 0.18)))
    const scored = filteredGraph.nodes
      .map(n => {
        const pr = typeof n.pagerank === 'number' && Number.isFinite(n.pagerank) ? n.pagerank : 0
        const deg = degree.get(n.id) ?? 0
        const score = pr > 0 ? pr * 1000 + deg : deg
        return { id: n.id, score }
      })
      .sort((a, b) => b.score - a.score)

    return new Set(scored.slice(0, maxLabels).map(s => s.id))
  }, [filteredGraph])

  const fetchGraphStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth-token')
      if (!token) return null

      const response = await fetch('/api/temp-kb/graph/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const result = await response.json().catch(() => ({}))
      if (result?.success && result?.data?.status) {
        return {
          status: String(result.data.status),
          progress: typeof result.data.progress === 'number' ? result.data.progress : undefined
        }
      }
      return null
    } catch {
      return null
    }
  }, [])

  // 获取图谱数据
  const fetchGraphData = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false
    try {
      if (showLoading) setIsLoading(true)

      const token = localStorage.getItem('auth-token')
      if (!token) {
        return { ok: false, error: '未登录', nodeCount: 0, edgeCount: 0 }
      }

      const response = await fetch('/api/temp-kb/graph', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const result = await response.json().catch(() => ({}))

      if (result.success && result.data?.graph) {
        const nodes = result.data.graph.nodes || []
        const edges = result.data.graph.edges || []

        setGraphData({ nodes, edges })
        setError(null)

        return { ok: true, nodeCount: nodes.length, edgeCount: edges.length }
      }

      return {
        ok: false,
        error: result.error || '获取图谱数据失败',
        nodeCount: 0,
        edgeCount: 0
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : '获取图谱数据异常',
        nodeCount: 0,
        edgeCount: 0
      }
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let pollingTimer: number | null = null

    const tick = async (showLoading = false) => {
      const status = await fetchGraphStatus()
      if (cancelled) return
      if (status) setGraphBuildStatus(status)

      const graphResult = await fetchGraphData({ showLoading })
      if (cancelled) return

      const isBuilding = status?.status === 'building'
      const hasGraph = graphResult.ok && (graphResult.nodeCount > 0 || graphResult.edgeCount > 0)

      // 构建中：图谱为空/接口短暂中断时不要报错，继续轮询
      if (!hasGraph && isBuilding) {
        setError(null)
        if (pollingTimer === null) {
          pollingTimer = window.setInterval(() => tick(false), 5000)
        }
        return
      }

      // 非构建中：若接口明确报错则展示
      if (!graphResult.ok && graphResult.error) {
        setError(graphResult.error)
      }

      // 停止轮询
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer)
        pollingTimer = null
      }
    }

    tick(true)
    return () => {
      cancelled = true
      if (pollingTimer !== null) window.clearInterval(pollingTimer)
    }
  }, [fetchGraphData, fetchGraphStatus])

  useEffect(() => {
    const handler = () => {
      fetchGraphStatus().then((status) => {
        if (status) setGraphBuildStatus(status)
      })
      fetchGraphData({ showLoading: false })
    }

    window.addEventListener('temp-kb-graph-built', handler)
    return () => window.removeEventListener('temp-kb-graph-built', handler)
  }, [fetchGraphData, fetchGraphStatus])

  // D3 力导向图渲染
  useEffect(() => {
    if (!filteredGraph || !svgRef.current || !containerRef.current) return
    if (filteredGraph.nodes.length === 0) return

    // clone to avoid mutating React state (d3 will mutate nodes/links)
    const nodesData: GraphNode[] = filteredGraph.nodes.map(n => ({
      ...n,
      entity_name: typeof n.entity_name === 'string' ? n.entity_name : '',
      entity_type: typeof n.entity_type === 'string' && n.entity_type.trim() ? n.entity_type : 'unknown',
    }))
    const linksData: GraphEdge[] = filteredGraph.edges.map(e => ({
      ...e,
      source: typeof e.source === 'string' ? e.source : e.source.id,
      target: typeof e.target === 'string' ? e.target : e.target.id
    }))

    const container = containerRef.current
    const svg = d3.select(svgRef.current)
    const width = container.clientWidth
    const height = container.clientHeight || 400

    // 清空之前的内容
    svg.selectAll('*').remove()

    // 设置 SVG 尺寸
    svg.attr('width', width).attr('height', height)

    // SVG defs: glow filter
    const defs = svg.append('defs')
    const glowId = `${svgUid}-glow`
    const glow = defs
      .append('filter')
      .attr('id', glowId)
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')
    glow.append('feGaussianBlur').attr('stdDeviation', 6).attr('result', 'blur')
    const merge = glow.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // 创建主容器
    const g = svg.append('g')

    const nodeCount = nodesData.length
    const linkDistance = Math.max(60, Math.min(120, 110 - nodeCount * 0.12))
    const chargeStrength = -Math.max(120, Math.min(320, 260 - nodeCount * 0.25))

    const getLabelOpacity = (d: GraphNode) => {
      if (labelMode === 'all') return 0.65
      if (labelMode === 'off') return 0
      return autoLabelIds.has(d.id) ? 0.55 : 0
    }

    // 创建力模拟
    const simulation = d3.forceSimulation<GraphNode>(nodesData)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(linksData)
        .id(d => d.id)
        .distance(linkDistance)
        .strength(0.6))
      .force('charge', d3.forceManyBody().strength(chargeStrength).distanceMax(520))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeRadius((d as GraphNode).pagerank) + 6))

    if (clusterByType) {
      const types = [...new Set(nodesData.map(n => n.entity_type))]
      const radius = Math.max(90, Math.min(width, height) * 0.22)
      const centers = new Map<string, { x: number; y: number }>()
      for (let i = 0; i < types.length; i++) {
        const t = types[i]
        const angle = (2 * Math.PI * i) / Math.max(1, types.length)
        centers.set(t, {
          x: width / 2 + radius * Math.cos(angle),
          y: height / 2 + radius * Math.sin(angle),
        })
      }

      simulation
        .force('clusterX', d3.forceX<GraphNode>(d => centers.get(d.entity_type)?.x ?? width / 2).strength(0.10))
        .force('clusterY', d3.forceY<GraphNode>(d => centers.get(d.entity_type)?.y ?? height / 2).strength(0.10))
    }

    // 绘制边
    const links = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linksData)
      .enter()
      .append('line')
      .attr('stroke', 'rgba(148, 163, 184, 0.35)')
      .attr('stroke-opacity', 0.35)
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', d => Math.max(0.6, Math.min(2.4, 0.6 + (d.weight || 1) * 0.25)))
      .on('mouseenter', function(event, d) {
        const desc = d.description || '关联'
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: desc
        })
        d3.select(this)
          .attr('stroke', 'rgba(129, 140, 248, 0.9)')
          .attr('stroke-opacity', 0.9)
          .attr('stroke-width', 2.2)
      })
      .on('mouseleave', function() {
        setTooltip(prev => ({ ...prev, visible: false }))
        d3.select(this)
          .attr('stroke', 'rgba(148, 163, 184, 0.35)')
          .attr('stroke-opacity', 0.35)
          .attr('stroke-width', (d: any) => Math.max(0.6, Math.min(2.4, 0.6 + (d?.weight || 1) * 0.25)))
      })

    // 绘制节点
    const nodes = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodesData)
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    // 节点光晕（更贴近参考图：暗底+发光）
    nodes.append('circle')
      .attr('class', 'halo')
      .attr('r', d => getNodeRadius(d.pagerank) + 10)
      .attr('fill', d => getEntityColor(d.entity_type || 'unknown', true))
      .attr('fill-opacity', 0.14)
      .style('filter', `url(#${glowId})`)
      .style('pointer-events', 'none')

    // 节点核心
    nodes.append('circle')
      .attr('class', 'core')
      .attr('r', d => getNodeRadius(d.pagerank))
      .attr('fill', d => getEntityColor(d.entity_type || 'unknown', true))
      .attr('stroke', 'rgba(255, 255, 255, 0.75)')
      .attr('stroke-width', 1.2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        const name = d.entity_name?.trim() ? d.entity_name : d.id
        const type = d.entity_type?.trim() ? d.entity_type : 'unknown'
        const content = `${name}\n类型: ${type}${d.description ? `\n${d.description}` : ''}`
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content
        })
        const g = d3.select(this.parentNode as SVGGElement)
        g.select('circle.core')
          .attr('stroke', 'rgba(129, 140, 248, 0.95)')
          .attr('stroke-width', 2.4)
        g.select('circle.halo').attr('fill-opacity', 0.28)
        g.select('text').attr('opacity', 1)
      })
      .on('mouseleave', function() {
        setTooltip(prev => ({ ...prev, visible: false }))
        const g = d3.select(this.parentNode as SVGGElement)
        g.select('circle.core')
          .attr('stroke', 'rgba(255, 255, 255, 0.75)')
          .attr('stroke-width', 1.2)
        g.select('circle.halo').attr('fill-opacity', 0.14)
        g.select('text').attr('opacity', (d: any) => getLabelOpacity(d as GraphNode))
      })

    // 节点标签
    nodes.append('text')
      .text(d => {
        const name = d.entity_name?.trim() ? d.entity_name : d.id
        return name.length > 8 ? name.slice(0, 8) + '...' : name
      })
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', 'rgba(226, 232, 240, 0.95)')
      .style('paint-order', 'stroke')
      .style('stroke', 'rgba(2, 6, 23, 0.85)')
      .style('stroke-width', 4)
      .attr('font-size', 11)
      .attr('pointer-events', 'none')
      .attr('opacity', d => getLabelOpacity(d))

    // 更新位置
    simulation.on('tick', () => {
      links
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0)

      nodes.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`)
    })

    // 存储 zoom 实例用于按钮控制
    ;(svg.node() as any).__zoom_instance = zoom

    return () => {
      simulation.stop()
    }
  }, [filteredGraph, svgUid, labelMode, autoLabelIds, clusterByType])

  // 缩放控制
  const handleZoom = (scale: number) => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    const zoom = (svg.node() as any)?.__zoom_instance
    if (zoom) {
      svg.transition().duration(300).call(zoom.scaleBy, scale)
    }
  }

  // 重置视图
  const handleReset = () => {
    if (!svgRef.current || !containerRef.current) return
    const svg = d3.select(svgRef.current)
    const zoom = (svg.node() as any)?.__zoom_instance
    if (zoom) {
      svg.transition().duration(450).call(zoom.transform, d3.zoomIdentity)
    }
  }

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950 ${className}`}
        style={{ height }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-slate-300">加载图谱数据...</span>
      </div>
    )
  }

  const buildPercent = graphBuildStatus?.progress !== undefined
    ? Math.max(0, Math.min(100, Math.round(graphBuildStatus.progress * 100)))
    : null
  const isBuilding = graphBuildStatus?.status === 'building'

  if (isBuilding && (!graphData || graphData.nodes.length === 0)) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950 ${className}`}
        style={{ height }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-slate-300">
          图谱构建中{buildPercent !== null ? `（${buildPercent}%）` : '…'}
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950 ${className}`}
        style={{ height }}
      >
        <p className="text-rose-400">{error}</p>
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950 ${className}`}
        style={{ height }}
      >
        <p className="text-slate-300 mb-2">暂无图谱数据</p>
        <p className="text-slate-400 text-sm">请先构建知识图谱，或等待构建完成后自动刷新</p>
      </div>
    )
  }

  if (filteredGraph && filteredGraph.nodes.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-lg border border-slate-800/80 bg-slate-950 ${className}`}
        style={{ height }}
      >
        <p className="text-slate-300 mb-2">当前筛选无结果</p>
        <Button
          size="sm"
          variant="secondary"
          className="bg-slate-900/70 hover:bg-slate-900 text-slate-200 border border-slate-700/70 backdrop-blur"
          onClick={() => {
            setTypeFilterInitialized(true)
            setSelectedTypes(new Set(allEntityTypes))
          }}
        >
          重置筛选
        </Button>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* 图谱容器 */}
      <div 
        ref={containerRef} 
        className="relative w-full rounded-xl overflow-hidden border border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-950 to-zinc-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        style={{ height }}
      >
        {/* 背景纹理（参考图：暗色+微弱噪点/网格感） */}
        <div className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 30%, rgba(99,102,241,0.20), transparent 55%),' +
              'radial-gradient(circle at 75% 40%, rgba(168,85,247,0.18), transparent 55%),' +
              'radial-gradient(circle at 35% 80%, rgba(20,184,166,0.16), transparent 60%),' +
              'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 100% 100%, 100% 100%, 44px 44px, 44px 44px',
            backgroundPosition: 'center, center, center, 0 0, 0 0'
          }}
        />

        <svg ref={svgRef} className="relative w-full h-full" />

        {/* 控制按钮 */}
        <div className="absolute top-3 left-3 z-10 flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0 bg-slate-900/70 hover:bg-slate-900 text-slate-200 border border-slate-700/70 backdrop-blur"
            onClick={() => handleZoom(1.25)}
            title="放大"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0 bg-slate-900/70 hover:bg-slate-900 text-slate-200 border border-slate-700/70 backdrop-blur"
            onClick={() => handleZoom(0.8)}
            title="缩小"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0 bg-slate-900/70 hover:bg-slate-900 text-slate-200 border border-slate-700/70 backdrop-blur"
            onClick={handleReset}
            title="重置"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend / Filters */}
        <div className="absolute top-3 right-3 z-10">
          {legendOpen ? (
            <div className="w-[290px] max-h-[calc(100%-24px)] rounded-xl border border-slate-700/60 bg-slate-950/70 text-slate-100 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/50">
                <div className="text-sm font-medium tracking-wide">Legend</div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-200 hover:text-white hover:bg-slate-800/60"
                  onClick={() => setLegendOpen(false)}
                  title="收起"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-3 py-3 space-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Statistics</div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">节点</span>
                      <span>{filteredGraph?.nodes.length ?? 0}/{graphData.nodes.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">连接</span>
                      <span>{filteredGraph?.edges.length ?? 0}/{graphData.edges.length}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Nodes</div>
                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 text-xs bg-slate-900/70 hover:bg-slate-900 text-slate-200 border border-slate-700/70"
                      onClick={() => {
                        setTypeFilterInitialized(true)
                        setSelectedTypes(new Set(allEntityTypes))
                      }}
                    >
                      全选
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 px-2 text-xs bg-slate-900/70 hover:bg-slate-900 text-slate-200 border border-slate-700/70"
                      onClick={() => {
                        setTypeFilterInitialized(true)
                        setSelectedTypes(new Set())
                      }}
                    >
                      全不选
                    </Button>
                  </div>

                  <ScrollArea className="h-[160px] pr-2">
                    <div className="space-y-2">
                      {allEntityTypes.map(type => (
                        <label key={type} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                          <Checkbox
                            checked={effectiveSelectedTypes.has(type)}
                            onCheckedChange={(checked) => {
                              const isChecked = checked === true
                              setTypeFilterInitialized(true)
                              setSelectedTypes(prev => {
                                const base = typeFilterInitialized ? prev : allEntityTypesSet
                                const next = new Set(base)
                                if (isChecked) next.add(type)
                                else next.delete(type)
                                return next
                              })
                            }}
                            className="h-4 w-4 border-slate-600 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                          />
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getEntityColor(type, true) }} />
                            <span className="max-w-[170px] truncate">{type}</span>
                          </span>
                          <span className="ml-auto text-slate-400">{typeCounts[type] ?? 0}</span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Options</div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-200">
                    <span className="text-slate-300">聚类布局</span>
                    <Switch
                      checked={clusterByType}
                      onCheckedChange={setClusterByType}
                      className="data-[state=unchecked]:bg-slate-800 data-[state=checked]:bg-indigo-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-200 mt-2">
                    <span className="text-slate-300">标签</span>
                    <Select value={labelMode} onValueChange={(v) => setLabelMode(v as LabelMode)}>
                      <SelectTrigger className="h-8 w-[120px] bg-slate-900/70 border-slate-700 text-slate-100 focus:ring-indigo-500/40">
                        <SelectValue placeholder="选择" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border-slate-700 text-slate-100">
                        <SelectItem value="auto">自动</SelectItem>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="off">关闭</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 px-2 bg-slate-900/70 hover:bg-slate-900 text-slate-200 border border-slate-700/70 backdrop-blur"
              onClick={() => setLegendOpen(true)}
              title="展开 Legend"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Legend
            </Button>
          )}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-2 rounded-lg shadow-lg text-sm whitespace-pre-line max-w-xs border border-slate-700/60 bg-slate-950/85 text-slate-100 backdrop-blur"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}
