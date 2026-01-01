'use client'

import React, { useCallback, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import D3ForceGraphComponent from './d3-force-graph-component'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getEntityColor } from '@/lib/utils/entity-colors'
import {
  Search,
  Filter,
  Download,
  Database,
  Clock,
  GitBranch,
  Network,
  Eye,
  EyeOff,
  Zap,
  Layout,
  Settings,
  FileText,
  ExternalLink,
  Users,
  Building,
  Lightbulb,
  Link as LinkIcon,
  ArrowLeft
} from 'lucide-react'

// 翻译函数 - 将英文描述翻译成中文
const translateDescription = (description: string): string => {
  if (!description) return '暂无描述'

  // 简单的关键词翻译映射
  const translations: { [key: string]: string } = {
    'Involved in approving changes to wages and welfare benefits': '参与工资和福利变更的审批',
    'The Finance Department is involved in drafting and reviewing the document': '财务部参与文档的起草和审核',
    'The Finance Department, where Huang Xianghua works, is involved in the approval process': '黄向华所在的财务部参与审批流程',
    'The finance department where 黄向华 works, involved in the approval process': '黄向华工作的财务部，参与审批流程',
    'The财务部 is involved in the document approval process': '财务部参与文档审批流程',
    '财务部 (Finance Department) is involved in the approval process of the document': '财务部参与文档的审批流程',
    '财务部 is the department involved in drafting and reviewing the document': '财务部是参与文档起草和审核的部门',
    'Description not available in text': '文本中无可用描述',
    'The Finance Department is one of the recipients of the document, indicating involvement in financial oversight': '财务部是文档的接收方之一，表明参与财务监督',
    '财务部 is a department mentioned as a recipient of the document': '财务部是文档中提到的接收部门',
    '财务部 is one of the departments copied in the document': '财务部是文档抄送的部门之一',
    // 新增平台财务部门相关翻译
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

// D3.js节点和连线数据类型
interface D3Node {
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
}

interface D3Link {
  source: string
  target: string
  type?: string
  isTemporary?: boolean
}

interface EnhancedGraphViewerProps {
  knowledgeGraphId: string
  onBack: () => void
}

// 数据转换函数：API格式 -> D3.js格式
const convertToD3Data = (nodes: any[], edges: any[]) => {
  const d3Nodes: D3Node[] = nodes.map(node => ({
    id: node.id,
    name: node.name || node.label || node.id,
    type: node.type || 'Entity',
    isTemporary: node.isTemporary || false,
    value: Math.max(15, Math.min(40, (node.pagerank || 0.1) * 200)), // 更大的节点，基于pagerank
    color: getEntityColor(node.type || 'Entity', node.isTemporary || false),
    description: node.description || '',
    files: node.files || []
  }))

  const d3Links: D3Link[] = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
    type: edge.type || edge.label || 'RELATED_TO',
    isTemporary: edge.isTemporary || false
  }))

  return { nodes: d3Nodes, links: d3Links }
}


export default function EnhancedGraphViewer({ knowledgeGraphId, onBack }: EnhancedGraphViewerProps) {
  const [graphData, setGraphData] = useState<{ nodes: D3Node[], links: D3Link[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<D3Node | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedNodeType, setSelectedNodeType] = useState('all')
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)

  useEffect(() => {
    loadGraphData()
  }, [knowledgeGraphId])

  const loadGraphData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/graph`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const convertedData = convertToD3Data(result.data.nodes || [], result.data.links || [])
          setGraphData(convertedData)
          console.log('知识图谱数据加载成功:', convertedData)
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

  const handleNodeClick = useCallback(async (node: D3Node) => {
    console.log('节点被点击:', node)
    setSelectedNode(node)
    setFocusNodeId(node.id)

    // 获取节点关联文件
    try {
      const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/nodes/${encodeURIComponent(node.id)}/files`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          // 更新节点的文件信息
          setSelectedNode(prev => prev ? {
            ...prev,
            files: result.data.files || []
          } : null)
        }
      }
    } catch (error) {
      console.error('获取节点文件失败:', error)
    }
  }, [knowledgeGraphId])

  const handleExport = () => {
    if (!graphData) return
    
    const exportData = {
      nodes: graphData.nodes,
      links: graphData.links,
      timestamp: new Date().toISOString()
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)

    const link = document.createElement('a')
    link.href = url
    link.download = `knowledge-graph-${knowledgeGraphId}.json`
    link.click()

    URL.revokeObjectURL(url)
  }

  // 搜索和过滤功能
  const filteredNodes = graphData?.nodes.filter(node => {
    const matchesSearch = searchTerm === '' ||
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.description && node.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = selectedNodeType === 'all' || node.type.toLowerCase() === selectedNodeType.toLowerCase()
    return matchesSearch && matchesType
  }) || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载知识图谱中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadGraphData} variant="outline">
            重试
          </Button>
        </div>
      </div>
    )
  }

  if (!graphData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">暂无图谱数据</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* 左侧控制面板 */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Network className="w-6 h-6 mr-2 text-blue-500" />
                知识图谱
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              探索和分析知识实体关系
            </p>
          </div>

          {/* 搜索 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">搜索节点</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="搜索节点..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* 过滤 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">节点类型</h3>
            <select
              value={selectedNodeType}
              onChange={(e) => setSelectedNodeType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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

          {/* 统计 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">图谱统计</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">节点数量</span>
                <span className="font-medium">{graphData.nodes.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">关系数量</span>
                <span className="font-medium">{graphData.links.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">搜索结果</span>
                <span className="font-medium text-blue-600">{filteredNodes.length}</span>
              </div>
            </div>
          </div>

          {/* 操作 */}
          <div className="space-y-2">
            <Button
              onClick={handleExport}
              className="w-full"
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              导出图谱
            </Button>
          </div>
        </div>
      </motion.div>

      {/* 主图谱画布 */}
      <div className="flex-1 relative">
        <D3ForceGraphComponent
          nodes={graphData.nodes}
          links={graphData.links}
          onNodeClick={handleNodeClick}
          focusNodeId={focusNodeId}
          searchTerm={searchTerm}
          filteredNodeIds={filteredNodes.map(n => n.id)}
        />

        {/* 图谱信息面板 */}
        <div className="absolute top-4 right-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-lg p-4 min-w-[200px]"
          >
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-medium text-gray-900">实时状态</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">节点</span>
                <span className="font-medium">{graphData.nodes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">关系</span>
                <span className="font-medium">{graphData.links.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">图谱ID</span>
                <span className="font-medium text-blue-600 text-xs">
                  {knowledgeGraphId.slice(0, 8)}...
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* 节点详情侧边栏 */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="absolute top-0 right-0 w-80 h-full bg-white border-l border-gray-200 shadow-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">节点详情</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4" style={{height: '500px'}}>
              {/* 基本信息 */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  {selectedNode.type === 'person' && <Users className="w-5 h-5 text-blue-500" />}
                  {selectedNode.type === 'organization' && <Building className="w-5 h-5 text-green-500" />}
                  {selectedNode.type === 'concept' && <Lightbulb className="w-5 h-5 text-purple-500" />}
                  <h4 className="font-semibold text-gray-900">基本信息</h4>
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">名称</label>
                    <p className="text-gray-900 mt-1 font-medium">{selectedNode.name}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">类型</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                      selectedNode.type === 'person' ? 'bg-blue-100 text-blue-800' :
                      selectedNode.type === 'organization' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {selectedNode.type === 'person' ? '人员' :
                      selectedNode.type === 'organization' ? '组织' : selectedNode.type || 'Entity'}
                    </span>
                  </div>

                  {selectedNode.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">描述</label>
                      <p className="text-gray-600 mt-1">{translateDescription(selectedNode.description)}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700">状态</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                      selectedNode.isTemporary ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedNode.isTemporary ? '临时节点' : '核心节点'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 关联信息 */}
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <LinkIcon className="w-5 h-5 text-blue-500" />
                  <h4 className="font-semibold text-gray-900">关联信息</h4>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">直接关联</span>
                    <span className="font-medium text-blue-600">
                      {graphData.links.filter(link =>
                        (typeof link.source === 'string' ? link.source : link.source.id) === selectedNode.id ||
                        (typeof link.target === 'string' ? link.target : link.target.id) === selectedNode.id
                      ).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">重要性评分</span>
                    <span className="font-medium text-gray-900">{selectedNode.value || 0}</span>
                  </div>
                </div>
              </div>

              {/* 文件信息 */}
              {selectedNode.files && selectedNode.files.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-5 h-5 text-green-500" />
                    <h4 className="font-semibold text-gray-900">相关文件</h4>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                      {selectedNode.files.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedNode.files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white rounded border border-green-200 hover:border-green-300 transition-colors">
                        <div className="flex items-center space-x-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{file.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              // 打开文件逻辑
                              console.log('打开文件:', file.path)
                              window.open(`/api/files${file.path}`, '_blank')
                            }}
                            className="flex items-center space-x-1 text-green-600 hover:text-green-700 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span className="text-xs">打开</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                // 下载节点内容
                                const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/nodes/${encodeURIComponent(selectedNode.id)}/download?format=json`)
                                if (response.ok) {
                                  const blob = await response.blob()
                                  const url = window.URL.createObjectURL(blob)
                                  const link = document.createElement('a')
                                  link.href = url
                                  link.download = `${selectedNode.name}_${file.name}.json`
                                  link.click()
                                  window.URL.revokeObjectURL(url)
                                } else {
                                  console.error('下载失败:', response.statusText)
                                }
                              } catch (error) {
                                console.error('下载错误:', error)
                              }
                            }}
                            className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-xs">下载</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
