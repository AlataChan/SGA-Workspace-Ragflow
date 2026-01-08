'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
  NodeTypes,
  EdgeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Network,
  Database,
  Clock,
  Filter,
  Layout,
  Maximize2,
  Download,
  Settings,
  Eye,
  EyeOff,
  Zap,
  GitBranch,
  FileText,
  ExternalLink,
  ArrowLeft,
  Search,
  Users,
  Building,
  Folder,
  Briefcase
} from 'lucide-react'

// 翻译函数 - 将英文描述翻译成中文
const translateDescription = (description: string): string => {
  if (!description) return '暂无描述'

  // 简单的关键词翻译映射
  const translations: { [key: string]: string } = {
    'Platform finance departments manage various financial operations including bank accounts and settlements': '平台财务部门管理各种财务操作，包括银行账户和结算',
    'The finance department of the platform is responsible for managing bank accounts, financial transactions, and coordinating banking operations according to the group\'s requirements': '平台财务部门负责管理银行账户、财务交易，并根据集团要求协调银行业务',
    'The platform\'s financial department is responsible for managing bank accounts, handling settlements and reconciliation, arranging financing, and coordinating with banks': '平台财务部门负责管理银行账户、处理结算和对账、安排融资以及与银行协调',
    'is responsible for bank account management, financing arrangements, foreign exchange operations, and compliance with financial policies': '负责银行账户管理、融资安排、外汇业务和财务政策合规',
    'is responsible for the overall financial management and supervision of the remote platforms, including fund allocation and usage': '负责远程平台的整体财务管理和监督，包括资金分配和使用',
    'is the financial department of remote platforms responsible for unified fund management, including fundraising, allocation, and usage': '是远程平台的财务部门，负责统一资金管理，包括筹资、分配和使用',
    'refers to the reimbursement process mentioned in the text for approved expenses': '指文本中提到的已批准费用的报销流程',
    // 通用关键词翻译
    'Platform finance departments': '平台财务部门',
    'finance department': '财务部门',
    'financial operations': '财务操作',
    'bank accounts': '银行账户',
    'settlements': '结算',
    'financial transactions': '财务交易',
    'banking operations': '银行业务',
    'financing arrangements': '融资安排',
    'foreign exchange operations': '外汇业务',
    'financial policies': '财务政策',
    'fund allocation': '资金分配',
    'fund management': '资金管理',
    'reimbursement process': '报销流程',
    'approved expenses': '已批准费用',
    'ORGANIZATION': '组织',
    'PERSON': '人员',
    'CATEGORY': '类别',
    'GEO': '地理位置',
    'EVENT': '事件',
    'person': '人员',
    'organization': '组织',
    'concept': '概念'
  }

  // 分割描述（通过<SEP>分隔符）
  const parts = description.split('<SEP>')

  // 翻译每个部分
  const translatedParts = parts.map(part => {
    const trimmed = part.trim()

    // 直接匹配翻译
    if (translations[trimmed]) {
      return translations[trimmed]
    }

    // 关键词替换
    let translated = trimmed
    Object.entries(translations).forEach(([en, zh]) => {
      translated = translated.replace(new RegExp(en, 'gi'), zh)
    })

    return translated
  })

  // 去重并合并
  const uniqueParts = [...new Set(translatedParts.filter(part => part && part !== '暂无描述'))]

  return uniqueParts.length > 0 ? uniqueParts.join('；') : '暂无描述'
}

// 获取节点样式 - 根据类型返回不同颜色
const getNodeStyle = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'person': return {
      border: 'border-solid border-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300'
    }
    case 'organization': return {
      border: 'border-solid border-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300'
    }
    case 'concept': return {
      border: 'border-solid border-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-700 dark:text-purple-300'
    }
    case 'document': return {
      border: 'border-solid border-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-700 dark:text-indigo-300'
    }
    case 'department': return {
      border: 'border-solid border-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300'
    }
    default: return {
      border: 'border-solid border-gray-400',
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      text: 'text-gray-700 dark:text-gray-300'
    }
  }
}

// Custom Node Component
const CustomNode = ({ data, selected }: any) => {
  const { label, type, count } = data
  const nodeStyle = getNodeStyle(type)
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      className={`
        px-4 py-2 rounded-lg border-2 shadow-lg cursor-pointer
        transition-all duration-200 min-w-[120px] text-center
        ${nodeStyle.border} ${nodeStyle.bg}
        ${selected ? 'ring-2 ring-yellow-400' : ''}
      `}
    >
      <div className={`font-medium text-sm ${nodeStyle.text}`}>
        {label}
      </div>
      {type && (
        <div className="text-xs text-muted-foreground mt-1">
          {type}
        </div>
      )}
      {count && (
        <div className="text-xs bg-muted rounded-full px-2 py-0.5 mt-1 inline-block">
          {count}
        </div>
      )}
    </motion.div>
  )
}

const nodeTypes: NodeTypes = {
  custom: CustomNode,
}

interface ReactFlowGraphViewerProps {
  graphData: {
    nodes: any[]
    links: any[]
  }
  onBack: () => void
  knowledgeGraphId: string
}

const ReactFlowGraphViewer: React.FC<ReactFlowGraphViewerProps> = ({ 
  graphData, 
  onBack, 
  knowledgeGraphId 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [nodeFiles, setNodeFiles] = useState<{ [nodeId: string]: any[] }>({})

  // 转换数据为ReactFlow格式
  useEffect(() => {
    if (!graphData?.nodes || !graphData?.links) return

    // 转换节点
    const reactFlowNodes: Node[] = graphData.nodes.map((node, index) => ({
      id: node.id,
      type: 'custom',
      position: { 
        x: Math.random() * 800, 
        y: Math.random() * 600 
      },
      data: { 
        label: node.name || node.label || node.id,
        type: node.type || 'unknown',
        description: node.description || '',
        count: node.count || 0,
        files: []
      }
    }))

    // 转换边
    const reactFlowEdges: Edge[] = graphData.links.map((link, index) => ({
      id: `e${link.source}-${link.target}-${index}`,
      source: link.source,
      target: link.target,
      type: 'smoothstep',
      animated: false,
      style: { stroke: 'hsl(var(--primary))' }
    }))

    setNodes(reactFlowNodes)
    setEdges(reactFlowEdges)
  }, [graphData, setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback(async (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
    
    // 获取节点关联文件
    if (!nodeFiles[node.id]) {
      try {
        const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/nodes/${encodeURIComponent(node.id)}/files`)
        if (response.ok) {
          const data = await response.json()
          setNodeFiles(prev => ({
            ...prev,
            [node.id]: data.files || []
          }))
        }
      } catch (error) {
        console.error('获取节点文件失败:', error)
      }
    }
  }, [knowledgeGraphId, nodeFiles])

  // 过滤节点
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = !searchTerm || 
      node.data.label.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = selectedType === 'all' || 
      node.data.type?.toLowerCase() === selectedType.toLowerCase()
    return matchesSearch && matchesType
  })

  return (
    <div className="flex h-full">
      {/* Control Panel */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center mb-2">
                <Network className="w-6 h-6 mr-2 text-blue-500" />
                知识图谱
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                探索和分析知识实体关系
              </p>
            </div>
            <button
              onClick={onBack}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">搜索节点</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索节点..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">节点类型</h3>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">全部类型</option>
              <option value="person">人物</option>
              <option value="organization">组织</option>
              <option value="concept">概念</option>
              <option value="document">文档</option>
              <option value="department">部门</option>
              <option value="project">项目</option>
            </select>
          </div>

          {/* Stats */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">图谱统计</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">节点数量</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">关系数量</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{edges.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">搜索结果</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{filteredNodes.length}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Graph Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background color="hsl(var(--border))" gap={16} />
          <Controls className="bg-card border border-border" />
          <MiniMap
            className="bg-card border border-border"
            nodeColor={(node) => 'hsl(var(--primary))'}
          />

          {/* Stats Panel */}
          <Panel position="top-left">
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground">节点: {nodes.length}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-muted-foreground">关系: {edges.length}</span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Node Details Sidebar */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="absolute right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl overflow-y-auto z-10"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">节点详情</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">基本信息</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">名称</label>
                      <p className="text-gray-600 mt-1">{selectedNode.data.label}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">类型</label>
                      <span className="inline-block mt-1 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                        {selectedNode.data.type}
                      </span>
                    </div>
                    {selectedNode.data.description && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">描述</label>
                        <p className="text-gray-600 mt-1">{translateDescription(selectedNode.data.description)}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-gray-700">状态</label>
                      <span className="inline-block mt-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        核心节点
                      </span>
                    </div>
                  </div>
                </div>

                {/* Related Info */}
                <div>
                  <div className="flex items-center space-x-2 mb-3">
                    <GitBranch className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">关联信息</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">直接关联</div>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {selectedNode.data.count || 0}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">重要性评分</div>
                    </div>
                  </div>
                </div>

                {/* Files */}
                {nodeFiles[selectedNode.id] && nodeFiles[selectedNode.id].length > 0 && (
                  <div>
                    <div className="flex items-center space-x-2 mb-3">
                      <FileText className="w-4 h-4 text-green-500" />
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">相关文件</h4>
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-1.5 py-0.5 rounded-full">
                        {nodeFiles[selectedNode.id].length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {nodeFiles[selectedNode.id].map((file: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{file.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            <button
                              onClick={() => window.open(`/api/files${file.path}`, '_blank')}
                              className="p-1 text-green-600 hover:text-green-700 transition-colors"
                              title="打开文件"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/nodes/${encodeURIComponent(selectedNode.id)}/download`)
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
                                  } else {
                                    alert('下载失败，文件可能不存在')
                                  }
                                } catch (error) {
                                  console.error('下载错误:', error)
                                  alert('下载失败，请稍后重试')
                                }
                              }}
                              className="p-1 text-blue-600 hover:text-blue-700 transition-colors"
                              title="下载文件"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ReactFlowGraphViewer
