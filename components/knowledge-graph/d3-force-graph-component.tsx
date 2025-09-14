'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface Node {
  id: string
  name: string
  type: string
  isTemporary?: boolean
  value: number
  color: string
  description?: string
  files?: Array<{
    name: string
    path: string
    type: string
  }>
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface Link {
  source: string | Node
  target: string | Node
  type?: string
  isTemporary?: boolean
}

interface D3ForceGraphComponentProps {
  nodes: Node[]
  links: Link[]
  onNodeClick?: (node: Node) => void
  focusNodeId?: string | null
  searchTerm?: string
  filteredNodeIds?: string[]
}

const NODE_RADIUS = 8

// 获取节点颜色 - 优化颜色方案
const getNodeColor = (type: string, isTemporary?: boolean) => {
  if (isTemporary) {
    // 临时节点使用更醒目的颜色
    switch (type.toLowerCase()) {
      case 'person': return '#f59e0b' // 橙色 - 临时人员
      case 'organization': return '#ef4444' // 红色 - 临时组织
      case 'concept': return '#ec4899' // 粉色 - 临时概念
      case 'document': return '#8b5cf6' // 紫色 - 临时文档
      case 'department': return '#f97316' // 深橙色 - 临时部门
      case 'project': return '#06b6d4' // 青色 - 临时项目
      default: return '#fbbf24' // 默认黄色
    }
  }

  // 永久节点使用相对柔和的颜色
  switch (type.toLowerCase()) {
    case 'person': return '#3b82f6' // 蓝色 - 人员
    case 'organization': return '#10b981' // 绿色 - 组织
    case 'concept': return '#8b5cf6' // 紫色 - 概念
    case 'document': return '#6366f1' // 靛蓝色 - 文档
    case 'department': return '#059669' // 深绿色 - 部门
    case 'project': return '#0891b2' // 深青色 - 项目
    case 'technology': return '#7c3aed' // 深紫色 - 技术
    case 'event': return '#dc2626' // 深红色 - 事件
    default: return '#6b7280' // 默认灰色
  }
}

// 分析节点关联关系
const analyzeNodeRelations = (selectedNodeId: string, links: Link[]) => {
  const directNodes = new Set<string>()

  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id
    const targetId = typeof link.target === 'string' ? link.target : link.target.id

    if (sourceId === selectedNodeId) {
      directNodes.add(targetId)
    } else if (targetId === selectedNodeId) {
      directNodes.add(sourceId)
    }
  })

  return directNodes
}

const D3ForceGraphComponent: React.FC<D3ForceGraphComponentProps> = ({
  nodes,
  links,
  onNodeClick,
  focusNodeId,
  searchTerm = '',
  filteredNodeIds = []
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNodeIdRef = useRef<string | null>(null)

  // 当focusNodeId变化时，更新选中状态
  useEffect(() => {
    if (focusNodeId && focusNodeId !== selectedNodeId) {
      setSelectedNodeId(focusNodeId)
      selectedNodeIdRef.current = focusNodeId

      // 找到对应的节点并触发点击事件
      const targetNode = nodes.find(n => n.id === focusNodeId)
      if (targetNode && onNodeClick) {
        onNodeClick(targetNode)
      }
    }
  }, [focusNodeId, selectedNodeId, nodes, onNodeClick])

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return

    console.log('D3ForceGraph rendering with:', { nodes: nodes.length, links: links.length })

    // 检查选中的节点是否还存在于当前节点列表中
    const selectedNodeExists = selectedNodeIdRef.current &&
      nodes.some(n => n.id === selectedNodeIdRef.current)

    // 如果选中的节点不存在了，清除选中状态
    if (selectedNodeIdRef.current && !selectedNodeExists) {
      console.log('选中节点不存在，清除选中状态', selectedNodeIdRef.current)
      selectedNodeIdRef.current = null
      setSelectedNodeId(null)
    }

    // 清除之前的内容
    d3.select(svgRef.current).selectAll("*").remove()

    // 获取容器尺寸
    const rect = svgRef.current.getBoundingClientRect()
    const width = rect.width || 800
    const height = rect.height || 600

    // 验证节点ID集合
    const nodeIds = new Set(nodes.map(n => n.id))

    // 过滤有效的链接，确保source和target都存在
    const validLinks = links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source
      const targetId = typeof link.target === 'object' ? link.target.id : link.target
      const isValid = nodeIds.has(sourceId) && nodeIds.has(targetId)
      if (!isValid) {
        console.warn('链接引用了不存在的节点', { sourceId, targetId, availableNodes: Array.from(nodeIds) })
      }
      return isValid
    })

    // 为节点设置更好的初始位置 - 使用网格布局
    const nodesCopy = nodes.map((node, index) => {
      // 计算网格布局
      const cols = Math.ceil(Math.sqrt(nodes.length))
      const rows = Math.ceil(nodes.length / cols)
      const col = index % cols
      const row = Math.floor(index / cols)

      // 计算网格间距
      const gridWidth = width * 0.8
      const gridHeight = height * 0.8
      const cellWidth = gridWidth / cols
      const cellHeight = gridHeight / rows

      // 添加随机偏移避免完全规则
      const randomOffset = 30
      const offsetX = (Math.random() - 0.5) * randomOffset
      const offsetY = (Math.random() - 0.5) * randomOffset

      return {
        ...node,
        x: (width - gridWidth) / 2 + col * cellWidth + cellWidth / 2 + offsetX,
        y: (height - gridHeight) / 2 + row * cellHeight + cellHeight / 2 + offsetY,
        vx: 0,
        vy: 0,
        fx: null, // 不固定位置，让力导向算法工作
        fy: null
      }
    })

    const svg = d3.select(svgRef.current)
    const g = svg.append("g")

    // 设置缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    // 初始化力导向图模拟 - 优化参数减少跳动
    const simulation = d3.forceSimulation(nodesCopy)
      .force("link", d3.forceLink(validLinks).id((d: any) => d.id).distance(80).strength(0.3))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2).strength(0.1))
      .force("collision", d3.forceCollide().radius(NODE_RADIUS + 5).strength(0.5))
      .alphaDecay(0.05) // 适中的衰减
      .velocityDecay(0.8) // 适中的速度衰减

    // 添加箭头标记
    const defs = g.append("defs")
    
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", NODE_RADIUS + 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5")

    // 创建连线
    const link = g.append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(validLinks)
      .join("line")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)")

    // 创建节点组
    const nodeGroup = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node-group")
      .style("cursor", "pointer")

    // 添加节点圆圈 - 优化大小和样式
    const nodeCircle = nodeGroup
      .append("circle")
      .attr("r", (d: any) => {
        // 根据节点重要性调整大小，但保持合理范围
        const baseRadius = NODE_RADIUS
        const importance = d.value || 1
        return Math.min(baseRadius + importance * 2, baseRadius * 2)
      })
      .attr("fill", (d: any) => d.color || getNodeColor(d.type, d.isTemporary))
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))")

    // 添加节点标签 - 优化显示
    const nodeLabel = nodeGroup
      .append("text")
      .text((d: any) => {
        // 限制标签长度，避免重叠
        const name = d.name || ''
        return name.length > 8 ? name.substring(0, 8) + '...' : name
      })
      .attr("x", 0)
      .attr("y", NODE_RADIUS + 18)
      .attr("text-anchor", "middle")
      .attr("font-family", "Microsoft YaHei, SimHei, Arial, sans-serif")
      .attr("font-size", "10px")
      .attr("fill", "#333")
      .attr("font-weight", "500")
      .attr("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px rgba(255,255,255,0.8)")

    // 节点交互
    nodeGroup
      .on("click", (event, d) => {
        event.stopPropagation()
        console.log('节点被点击:', d)
        setSelectedNodeId(d.id)
        selectedNodeIdRef.current = d.id
        if (onNodeClick) {
          onNodeClick(d)
        }
      })
      .on("mouseover", function(event, d) {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("r", (d.value || NODE_RADIUS) * 1.2)
          .attr("stroke-width", 3)
      })
      .on("mouseout", function(event, d) {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("r", d.value || NODE_RADIUS)
          .attr("stroke-width", 2)
      })

    // 拖拽行为
    const drag = d3.drag<SVGGElement, Node>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on("drag", (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    nodeGroup.call(drag)

    // 更新位置 - 确保所有位置都是有效数字
    let tickCount = 0
    simulation.on("tick", () => {
      tickCount++

      // 确保所有节点都有有效位置
      nodesCopy.forEach(node => {
        if (isNaN(node.x) || node.x === undefined) node.x = width / 2
        if (isNaN(node.y) || node.y === undefined) node.y = height / 2
      })

      link
        .attr("x1", (d: any) => {
          const x = d.source.x
          return isNaN(x) || x === undefined ? width / 2 : x
        })
        .attr("y1", (d: any) => {
          const y = d.source.y
          return isNaN(y) || y === undefined ? height / 2 : y
        })
        .attr("x2", (d: any) => {
          const x = d.target.x
          return isNaN(x) || x === undefined ? width / 2 : x
        })
        .attr("y2", (d: any) => {
          const y = d.target.y
          return isNaN(y) || y === undefined ? height / 2 : y
        })

      nodeGroup
        .attr("transform", (d: any) => {
          const x = isNaN(d.x) || d.x === undefined ? width / 2 : d.x
          const y = isNaN(d.y) || d.y === undefined ? height / 2 : d.y
          return `translate(${x},${y})`
        })

      // 在300次tick后开始逐渐稳定，减少跳动
      if (tickCount > 300) {
        nodesCopy.forEach(node => {
          if (node.fx === null && node.fy === null) {
            // 轻微固定位置，但仍允许小幅移动
            node.vx *= 0.95
            node.vy *= 0.95
          }
        })
      }
    })

    // 应用搜索高亮
    if (searchTerm && filteredNodeIds.length > 0) {
      nodeGroup
        .style("opacity", (d: any) => 
          filteredNodeIds.includes(d.id) ? 1 : 0.3
        )
      
      link
        .style("opacity", (d: any) => {
          const sourceId = typeof d.source === 'object' ? d.source.id : d.source
          const targetId = typeof d.target === 'object' ? d.target.id : d.target
          return (filteredNodeIds.includes(sourceId) || filteredNodeIds.includes(targetId)) ? 1 : 0.1
        })
    } else {
      nodeGroup.style("opacity", 1)
      link.style("opacity", 1)
    }

    // 高亮选中节点及其关联
    if (selectedNodeIdRef.current) {
      const relatedNodes = analyzeNodeRelations(selectedNodeIdRef.current, validLinks)
      
      nodeGroup
        .style("opacity", (d: any) => 
          d.id === selectedNodeIdRef.current || relatedNodes.has(d.id) ? 1 : 0.3
        )
      
      nodeCircle
        .attr("stroke", (d: any) => 
          d.id === selectedNodeIdRef.current ? "#ff6b6b" : "#fff"
        )
        .attr("stroke-width", (d: any) => 
          d.id === selectedNodeIdRef.current ? 4 : 2
        )
    }

    // 清理函数
    return () => {
      simulation.stop()
    }

  }, [nodes, links, onNodeClick, searchTerm, filteredNodeIds])

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{
          border: '1px solid #e0e0e0',
          backgroundColor: '#fff',
          borderRadius: '0.5rem'
        }}
      />
    </div>
  )
}

export default D3ForceGraphComponent
