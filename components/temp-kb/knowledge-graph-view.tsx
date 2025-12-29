'use client'

/**
 * 知识图谱可视化组件
 * 使用 D3.js 力导向图展示知识图谱的节点和关系
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
}

/**
 * 实体类型对应的颜色
 */
const ENTITY_COLORS: Record<string, string> = {
  person: '#3B82F6',       // 蓝色 - 人物
  organization: '#10B981', // 绿色 - 组织
  geo: '#F59E0B',          // 橙色 - 地理
  event: '#8B5CF6',        // 紫色 - 事件
  category: '#EC4899',     // 粉色 - 分类
  default: '#6B7280'       // 灰色 - 默认
}

/**
 * 根据实体类型获取颜色
 */
function getEntityColor(type: string): string {
  return ENTITY_COLORS[type.toLowerCase()] || ENTITY_COLORS.default
}

/**
 * 根据 pagerank 计算节点大小
 */
function getNodeRadius(pagerank?: number): number {
  if (!pagerank) return 25
  // pagerank 范围通常是 0-1，映射到 20-50
  return Math.max(20, Math.min(50, 20 + pagerank * 30))
}

export default function KnowledgeGraphView({ className }: KnowledgeGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [tooltip, setTooltip] = useState<{
    visible: boolean
    x: number
    y: number
    content: string
  }>({ visible: false, x: 0, y: 0, content: '' })

  // 获取图谱数据
  const fetchGraphData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const token = localStorage.getItem('auth-token')
      if (!token) {
        setError('未登录')
        return
      }

      const response = await fetch('/api/temp-kb/graph', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const result = await response.json()

      if (result.success && result.data?.graph) {
        setGraphData({
          nodes: result.data.graph.nodes || [],
          edges: result.data.graph.edges || []
        })
      } else {
        setError(result.error || '获取图谱数据失败')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取图谱数据异常')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGraphData()
  }, [fetchGraphData])

  // D3 力导向图渲染
  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return
    if (graphData.nodes.length === 0) return

    const container = containerRef.current
    const svg = d3.select(svgRef.current)
    const width = container.clientWidth
    const height = container.clientHeight || 400

    // 清空之前的内容
    svg.selectAll('*').remove()

    // 设置 SVG 尺寸
    svg.attr('width', width).attr('height', height)

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // 创建主容器
    const g = svg.append('g')

    // 创建力模拟
    const simulation = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphEdge>(graphData.edges)
        .id(d => d.id)
        .distance(150))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeRadius((d as GraphNode).pagerank) + 10))

    // 绘制边
    const links = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.edges)
      .enter()
      .append('line')
      .attr('stroke', '#4B5563')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.max(1, (d.weight || 1) * 2))
      .on('mouseenter', function(event, d) {
        const desc = d.description || '关联'
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content: desc
        })
        d3.select(this).attr('stroke', '#60A5FA').attr('stroke-opacity', 1)
      })
      .on('mouseleave', function() {
        setTooltip(prev => ({ ...prev, visible: false }))
        d3.select(this).attr('stroke', '#4B5563').attr('stroke-opacity', 0.6)
      })

    // 绘制节点
    const nodes = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
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

    // 节点圆形
    nodes.append('circle')
      .attr('r', d => getNodeRadius(d.pagerank))
      .attr('fill', d => getEntityColor(d.entity_type))
      .attr('stroke', '#1F2937')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        const content = `${d.entity_name}\n类型: ${d.entity_type}${d.description ? `\n${d.description}` : ''}`
        setTooltip({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          content
        })
        d3.select(this).attr('stroke', '#60A5FA').attr('stroke-width', 3)
      })
      .on('mouseleave', function() {
        setTooltip(prev => ({ ...prev, visible: false }))
        d3.select(this).attr('stroke', '#1F2937').attr('stroke-width', 2)
      })

    // 节点标签
    nodes.append('text')
      .text(d => d.entity_name.length > 8 ? d.entity_name.slice(0, 8) + '...' : d.entity_name)
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('fill', '#fff')
      .attr('font-size', 12)
      .attr('pointer-events', 'none')

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
  }, [graphData])

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
      const width = containerRef.current.clientWidth
      const height = containerRef.current.clientHeight || 400
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(1).translate(-width / 2, -height / 2)
      )
    }
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-[300px] bg-slate-800 rounded-lg ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-slate-300">加载图谱数据...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-[300px] bg-slate-800 rounded-lg ${className}`}>
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-[300px] bg-slate-800 rounded-lg ${className}`}>
        <p className="text-slate-400 mb-2">暂无图谱数据</p>
        <p className="text-slate-500 text-sm">请先构建知识图谱</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* 控制按钮 */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button size="sm" variant="secondary" onClick={() => handleZoom(1.3)} title="放大">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={() => handleZoom(0.7)} title="缩小">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="secondary" onClick={handleReset} title="重置">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* 图谱容器 */}
      <div 
        ref={containerRef} 
        className="w-full h-[300px] bg-slate-900 rounded-lg overflow-hidden border border-slate-700"
      >
        <svg ref={svgRef} className="w-full h-full" />
      </div>

      {/* 图例 */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {Object.entries(ENTITY_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
          <div key={type} className="flex items-center gap-1 text-xs text-slate-400">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span>{type}</span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-lg text-sm text-white whitespace-pre-line max-w-xs"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}

