"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

interface GraphNode {
  id: string
  name: string
  type: string
  description?: string
  value?: number
  color?: string
}

interface GraphLink {
  source: string
  target: string
  description?: string
  weight?: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface SimpleGraphViewerProps {
  knowledgeGraphId: string
  onBack: () => void
}

export default function SimpleGraphViewer({ knowledgeGraphId, onBack }: SimpleGraphViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadGraphData()
  }, [knowledgeGraphId])

  useEffect(() => {
    if (graphData && containerRef.current) {
      initializeGraph()
    }
  }, [graphData])

  const loadGraphData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/graph`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          // 处理数据格式，确保节点有必要的属性
          const processedData = {
            nodes: (result.data.nodes || []).map((node: any, index: number) => ({
              id: node.id || node.name,
              name: node.name || node.id,
              type: node.type || 'UNKNOWN',
              description: node.description || '',
              value: Math.max(5, Math.min(20, (node.pagerank || 0.1) * 100)), // 节点大小
              color: getNodeColor(node.type || 'UNKNOWN')
            })),
            links: (result.data.links || []).map((link: any) => ({
              source: link.source,
              target: link.target,
              description: link.description || '',
              weight: link.weight || 1
            }))
          }
          setGraphData(processedData)
        } else {
          throw new Error(result.error || '加载图谱数据失败')
        }
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || errorData.details || '加载图谱数据失败')
      }
    } catch (error) {
      console.error('加载图谱数据失败:', error)
      setError(error instanceof Error ? error.message : '加载图谱数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  const getNodeColor = (type: string) => {
    const colors: Record<string, string> = {
      'PERSON': '#ff6b6b',
      'ORGANIZATION': '#4ecdc4',
      'LOCATION': '#45b7d1',
      'EVENT': '#96ceb4',
      'CONCEPT': '#ffeaa7',
      'DOCUMENT': '#dda0dd',
      'UNKNOWN': '#95a5a6'
    }
    return colors[type] || colors['UNKNOWN']
  }

  const initializeGraph = () => {
    if (!graphData || !containerRef.current) return

    // 清空容器
    const container = containerRef.current
    container.innerHTML = ''

    // 创建SVG
    const width = container.clientWidth
    const height = container.clientHeight

    const svg = container.appendChild(document.createElement('div'))
    svg.innerHTML = `
      <svg width="100%" height="100%" style="border: 1px solid #e0e0e0; background-color: #fff;">
        <defs>
          <marker id="arrow" viewBox="0 -5 10 10" refX="25" refY="0" markerWidth="6" markerHeight="6" orient="auto">
            <path fill="#999" d="M0,-5L10,0L0,5"></path>
          </marker>
        </defs>
      </svg>
    `

    // 使用原生D3.js代码（基于找到的工作版本）
    const script = document.createElement('script')
    script.src = 'https://d3js.org/d3.v6.min.js'
    script.onload = () => {
      renderGraph(container, graphData, width, height)
    }
    document.head.appendChild(script)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">加载知识图谱中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadGraphData} variant="outline">
            重试
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">知识图谱</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {graphData?.nodes.length || 0} 个节点 • {graphData?.links.length || 0} 条边
        </div>
      </div>
      
      <div 
        ref={containerRef} 
        className="flex-1 p-4"
        style={{ minHeight: '500px' }}
      />
    </div>
  )
}

// 渲染图谱的函数（将在D3.js加载后调用）
function renderGraph(container: HTMLElement, graphData: GraphData, width: number, height: number) {
  console.log('D3.js loaded, rendering graph...', { graphData, width, height })

  // 确保D3已加载
  if (typeof window === 'undefined' || !(window as any).d3) {
    console.error('D3.js not loaded')
    return
  }

  const d3 = (window as any).d3

  // 选择SVG元素
  const svg = d3.select(container).select('svg')
  const g = svg.append('g')

  // 添加缩放功能
  svg.call(d3.zoom().on('zoom', function(event: any) {
    g.attr('transform', event.transform)
  }))

  // 初始化力导向图
  const simulation = d3.forceSimulation(graphData.nodes)
    .force('link', d3.forceLink(graphData.links).id((d: any) => d.id))
    .force('charge', d3.forceManyBody().strength(-1000))
    .force('center', d3.forceCenter(width / 2, height / 2))

  // 创建连线
  const link = g.append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(graphData.links)
    .join('line')
    .attr('stroke-width', 2)
    .attr('marker-end', 'url(#arrow)')

  // 创建节点
  const node = g.append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(graphData.nodes)
    .join('circle')
    .attr('r', (d: any) => d.value || 10)
    .attr('fill', (d: any) => d.color || '#999')
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))

  // 创建标签
  const labels = g.append('g')
    .attr('class', 'labels')
    .selectAll('text')
    .data(graphData.nodes)
    .join('text')
    .text((d: any) => d.name)
    .attr('font-size', '12px')
    .attr('fill', '#333')

  // 更新位置
  simulation.on('tick', () => {
    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y)

    node
      .attr('cx', (d: any) => d.x)
      .attr('cy', (d: any) => d.y)

    labels
      .attr('x', (d: any) => d.x + 5)
      .attr('y', (d: any) => d.y + 5)
  })

  // 拖拽函数
  function dragstarted(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event: any, d: any) {
    d.fx = event.x
    d.fy = event.y
  }

  function dragended(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }
}
