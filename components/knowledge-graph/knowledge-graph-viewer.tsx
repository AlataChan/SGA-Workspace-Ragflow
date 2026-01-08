"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Download,
  FileText,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  AlertCircle
} from "lucide-react"
import * as d3 from "d3"
import { getEntityColor } from "@/lib/utils/entity-colors"

interface GraphNode {
  id: string
  name: string
  type: string
  description?: string
  properties?: Record<string, any>
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
  properties?: Record<string, any>
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface NodeFile {
  id: string
  name: string
  type: string
  size: number
  downloadUrl: string
}

interface KnowledgeGraphViewerProps {
  knowledgeGraphId: string
  onBack: () => void
}

export default function KnowledgeGraphViewer({ knowledgeGraphId, onBack }: KnowledgeGraphViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [nodeFiles, setNodeFiles] = useState<NodeFile[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<GraphNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState<any>(null)
  const [simulation, setSimulation] = useState<any>(null)

  useEffect(() => {
    loadGraphData()
  }, [knowledgeGraphId])

  useEffect(() => {
    if (graphData && svgRef.current) {
      initializeGraph()
    }
    return () => {
      if (simulation) {
        simulation.stop()
      }
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
          // API返回格式: {success: true, data: {knowledgeGraph: {...}, nodes: [...], links: [...]}}
          setGraphData({
            nodes: result.data.nodes || [],
            links: result.data.links || []
          })
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

  const initializeGraph = () => {
    if (!graphData || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    // 清除之前的内容
    svg.selectAll("*").remove()

    // 创建主容器
    const g = svg.append("g")

    // 创建缩放行为
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoomBehavior)
    setZoom(zoomBehavior)

    // 创建力导向模拟
    const sim = d3.forceSimulation<GraphNode>(graphData.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(graphData.links)
        .id(d => d.id)
        .distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30))

    setSimulation(sim)

    // 创建连线
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(graphData.links)
      .enter().append("line")
      .attr("stroke", "hsl(var(--muted-foreground))")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)

    // 创建节点
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(graphData.nodes)
      .enter().append("g")
      .attr("class", "node")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on("drag", (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on("end", (event, d) => {
          if (!event.active) sim.alphaTarget(0)
          d.fx = null
          d.fy = null
        }))

    // 添加节点圆圈
    node.append("circle")
      .attr("r", 20)
      .attr("fill", d => getEntityColor(d.type, false))
      .attr("stroke", "hsl(var(--background))")
      .attr("stroke-width", 2)

    // 添加节点标签
    node.append("text")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "hsl(var(--foreground))")
      .text(d => d.name.length > 8 ? d.name.substring(0, 8) + "..." : d.name)

    // 节点点击事件
    node.on("click", (event, d) => {
      handleNodeClick(d)
    })

    // 更新位置
    sim.on("tick", () => {
      link
        .attr("x1", d => (d.source as GraphNode).x!)
        .attr("y1", d => (d.source as GraphNode).y!)
        .attr("x2", d => (d.target as GraphNode).x!)
        .attr("y2", d => (d.target as GraphNode).y!)

      node
        .attr("transform", d => `translate(${d.x},${d.y})`)
    })
  }


  const handleNodeClick = async (node: GraphNode) => {
    setSelectedNode(node)
    setIsLoadingFiles(true)
    try {
      const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/nodes/${node.id}/files`)
      if (response.ok) {
        const data = await response.json()
        setNodeFiles(data.data || [])
      } else {
        setNodeFiles([])
      }
    } catch (error) {
      console.error('加载节点文件失败:', error)
      setNodeFiles([])
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(
        `/api/knowledge-graphs/${knowledgeGraphId}/search?q=${encodeURIComponent(searchQuery)}`
      )
      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.data || [])
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('搜索失败:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleDownloadFile = async (file: NodeFile) => {
    try {
      const response = await fetch(
        `/api/knowledge-graphs/${knowledgeGraphId}/nodes/${selectedNode?.id}/download?fileId=${file.id}`
      )
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('下载文件失败:', error)
    }
  }

  const resetZoom = () => {
    if (zoom && svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().duration(750).call(
        zoom.transform,
        d3.zoomIdentity
      )
    }
  }

  const zoomIn = () => {
    if (zoom && svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().duration(300).call(
        zoom.scaleBy,
        1.5
      )
    }
  }

  const zoomOut = () => {
    if (zoom && svgRef.current) {
      const svg = d3.select(svgRef.current)
      svg.transition().duration(300).call(
        zoom.scaleBy,
        1 / 1.5
      )
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">加载知识图谱中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button onClick={loadGraphData} variant="outline">
            重试
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex">
      {/* 左侧搜索面板 */}
      <div className="w-80 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center space-x-2 mb-4">
            <Button variant="ghost" onClick={onBack} size="sm">
              ← 返回
            </Button>
          </div>
          
          <div className="flex space-x-2">
            <Input
              placeholder="搜索节点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching} size="sm">
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-foreground">
                  搜索结果 ({searchResults.length})
                </h4>
                {searchResults.map((node) => (
                  <Card
                    key={node.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleNodeClick(node)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getEntityColor(node.type, false) }}
                        />
                        <span className="text-sm font-medium">{node.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{node.type}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 中间图谱可视化区域 */}
      <div className="flex-1 relative">
        {/* 工具栏 */}
        <div className="absolute top-4 right-4 z-10 flex space-x-2">
          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={resetZoom}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* SVG 画布 */}
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: 'hsl(var(--background))' }}
        />

        {/* 图例 */}
        <div className="absolute bottom-4 left-4 bg-card rounded-lg shadow-lg p-3 border border-border">
          <h4 className="font-medium text-sm mb-2">节点类型</h4>
          <div className="space-y-1">
            {['entity', 'concept', 'relation', 'document'].map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getEntityColor(type, false) }}
                />
                <span className="text-xs capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 节点详情对话框 */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getEntityColor(selectedNode?.type || '', false) }}
              />
              <span>{selectedNode?.name}</span>
            </DialogTitle>
            <DialogDescription>
              类型: {selectedNode?.type}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedNode?.description && (
              <div>
                <h4 className="font-medium mb-2">描述</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedNode.description}
                </p>
              </div>
            )}

            <div>
              <h4 className="font-medium mb-2">关联文件</h4>
              {isLoadingFiles ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">加载中...</span>
                </div>
              ) : nodeFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无关联文件</p>
              ) : (
                <div className="space-y-2">
                  {nodeFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 border border-border rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {file.type} • {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadFile(file)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
