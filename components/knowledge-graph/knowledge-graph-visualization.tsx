'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import D3ForceGraph from './d3-force-graph';
import { getEntityColor } from '@/lib/utils/entity-colors';
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
  Link as LinkIcon
} from 'lucide-react';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  isTemporary?: boolean;
  count?: number;
  files?: Array<{
    id: string;
    name: string;
    path: string;
    type: string;
    size?: number;
  }>;
  sourceFilesCount?: number;
  hasSourceFiles?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  type?: string;
  isTemporary?: boolean;
}

interface KnowledgeGraphVisualizationProps {
  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  } | null;
  knowledgeGraphId: string;
  onNodeClick?: (node: GraphNode) => void;
  className?: string;
}

// 中文翻译函数
const translateDescription = (description: string): string => {
  if (!description) return '';

  // 如果已经是中文，直接返回
  if (/[\u4e00-\u9fff]/.test(description)) {
    return description;
  }

  const translations: Record<string, string> = {
    // 财务相关
    'Platform finance departments manage various financial operations including bank accounts and settlements': '平台财务部门管理各种财务操作，包括银行账户和结算',
    'Platform finance departments are responsible for managing bank accounts, financial transactions, and coordinating banking operations according to group requirements': '平台财务部门负责管理银行账户、财务交易，并根据集团要求协调银行业务',
    'Platform finance departments are responsible for managing bank accounts, handling settlements and reconciliations, arranging financing, and coordinating with banks': '平台财务部门负责管理银行账户、处理结算和对账、安排融资以及与银行协调',
    'Platform finance departments are responsible for bank account management, financing arrangements, foreign exchange operations, and financial policy compliance': '平台财务部门负责银行账户管理、融资安排、外汇业务和财务政策合规',
    'Platform finance departments are responsible for overall financial management and supervision of remote platforms, including fund allocation and usage': '平台财务部门负责远程平台的整体财务管理和监督，包括资金分配和使用',
    'Platform finance departments are the financial departments of remote platforms, responsible for unified fund management, including fundraising, allocation, and usage': '平台财务部门是远程平台的财务部门，负责统一资金管理，包括筹资、分配和使用',

    // 日期和事件相关
    'The date when the General Office completed the final review and approval': '总办完成最终审查和批准的日期',
    'The date when the President\'s Office completed the review of the documents': '总裁办公室完成文件审查的日期',
    'The date when the final review by the总裁办公室 was completed': '总裁办公室完成最终审查的日期',
    'The date when the regulation was distributed': '规定分发的日期',
    'The issuance date of the safety production management document': '安全生产管理文件的发布日期',
    
    // 通用术语
    'financial operations': '财务操作',
    'bank accounts': '银行账户',
    'settlements': '结算',
    'financial transactions': '财务交易',
    'banking operations': '银行业务',
    'group requirements': '集团要求',
    'reconciliations': '对账',
    'financing': '融资',
    'foreign exchange': '外汇',
    'policy compliance': '政策合规',
    'fund allocation': '资金分配',
    'fund management': '资金管理',
    'fundraising': '筹资',
    
    // 其他常见术语
    'department': '部门',
    'management': '管理',
    'operations': '操作',
    'responsible for': '负责',
    'including': '包括',
    'coordination': '协调',
    'supervision': '监督',
    'allocation': '分配',
    'usage': '使用'
  };

  let translated = description;
  
  // 先尝试完整匹配
  if (translations[description]) {
    return translations[description];
  }
  
  // 处理<SEP>分隔符，将多个句子分开翻译
  if (translated.includes('<SEP>')) {
    const sentences = translated.split('<SEP>');
    const translatedSentences = sentences.map(sentence => {
      let sentenceTranslated = sentence.trim();

      // 对每个句子尝试完整匹配
      if (translations[sentenceTranslated]) {
        return translations[sentenceTranslated];
      }

      // 对每个句子尝试部分替换
      Object.entries(translations).forEach(([english, chinese]) => {
        if (sentenceTranslated.includes(english)) {
          sentenceTranslated = sentenceTranslated.replace(new RegExp(english, 'gi'), chinese);
        }
      });

      return sentenceTranslated;
    });

    return translatedSentences.join('；');
  }

  // 然后尝试部分替换
  Object.entries(translations).forEach(([english, chinese]) => {
    if (translated.includes(english)) {
      translated = translated.replace(new RegExp(english, 'gi'), chinese);
    }
  });

  return translated;
};

// 数据转换函数：API格式 -> D3.js格式
const convertToD3Data = (nodes: GraphNode[], edges: GraphEdge[]) => {
  if (!nodes || !edges) {
    return { nodes: [], links: [] };
  }

  const d3Nodes = nodes.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    isTemporary: node.isTemporary || false,
    value: Math.max(15, (node.count || 1) * 2),
    color: getEntityColor(node.type, node.isTemporary || false),
    description: node.description,
    files: node.files || []
  }));

  const d3Links = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
    type: edge.type || 'RELATED_TO',
    isTemporary: edge.isTemporary || false
  }));

  return { nodes: d3Nodes, links: d3Links };
};


const KnowledgeGraphVisualization: React.FC<KnowledgeGraphVisualizationProps> = ({
  graphData,
  knowledgeGraphId,
  onNodeClick,
  className = ''
}) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeType, setSelectedNodeType] = useState('all');
  const [showTemporary, setShowTemporary] = useState(true);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [nodeFiles, setNodeFiles] = useState<{[nodeId: string]: any[]}>({});



  // 下载文档
  const downloadDocument = async (documentId: string, filename: string) => {
    try {
      const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/documents/${documentId}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('下载失败:', response.statusText);
      }
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 如果没有数据，显示加载状态
  if (!graphData) {
    return (
      <div className={`flex items-center justify-center h-full bg-[#0d1117] ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-400">加载知识图谱中...</p>
        </div>
      </div>
    );
  }

  const { nodes, edges } = graphData;

  // 搜索和过滤功能 - 使用useMemo避免不必要的重新计算
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      const matchesSearch = searchTerm === '' ||
        (node.name && node.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (node.description && node.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = selectedNodeType === 'all' || node.type === selectedNodeType;
      const matchesTemporary = showTemporary || !node.isTemporary;

      return matchesSearch && matchesType && matchesTemporary;
    });
  }, [nodes, searchTerm, selectedNodeType, showTemporary]);

  // 获取节点文件信息
  const fetchNodeFiles = async (nodeId: string) => {
    // 检查缓存，但只有当缓存不为空时才使用
    if (nodeFiles[nodeId] && nodeFiles[nodeId].length > 0) {
      return nodeFiles[nodeId]; // 如果已经获取过且有文件，直接返回缓存
    }

    setLoadingFiles(true);
    try {
      // 使用RAGFlow API获取节点关联文件
      const response = await fetch(`/api/knowledge-graphs/${knowledgeGraphId}/nodes/${encodeURIComponent(nodeId)}/files`);
      if (response.ok) {
        const data = await response.json();
        const files = data.data || [];
        setNodeFiles(prev => ({ ...prev, [nodeId]: files }));
        return files;
      } else {
        console.warn('Failed to fetch node files:', response.status);
        // 如果API失败，检查节点是否有sourceFilesCount信息
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.sourceFilesCount && node.sourceFilesCount > 0) {
          // 创建模拟文件信息
          const mockFiles = Array.from({length: node.sourceFilesCount}, (_, i) => ({
            id: `file_${i + 1}`,
            name: `文档${i + 1}`,
            type: 'document',
            size: 0
          }));
          setNodeFiles(prev => ({ ...prev, [nodeId]: mockFiles }));
          return mockFiles;
        }
        return [];
      }
    } catch (error) {
      console.error('Error fetching node files:', error);
      // 如果网络错误，也尝试使用节点的sourceFilesCount信息
      const node = nodes.find(n => n.id === nodeId);
      if (node && node.sourceFilesCount && node.sourceFilesCount > 0) {
        const mockFiles = Array.from({length: node.sourceFilesCount}, (_, i) => ({
          id: `file_${i + 1}`,
          name: `文档${i + 1}`,
          type: 'document',
          size: 0
        }));
        setNodeFiles(prev => ({ ...prev, [nodeId]: mockFiles }));
        return mockFiles;
      }
      return [];
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleNodeClick = useCallback(async (node: any) => {
    // 转换回GraphNode格式
    const graphNode = nodes.find(n => n.id === node.id);
    if (graphNode) {
      setSelectedNode(graphNode);
      setFocusNodeId(node.id);

      // 获取节点文件信息
      await fetchNodeFiles(node.id);

      onNodeClick?.(graphNode);
    }
  }, [nodes, onNodeClick, fetchNodeFiles]);

  const handleExport = () => {
    const graphDataToExport = {
      nodes: filteredNodes,
      edges: edges,
      timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(graphDataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-graph-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  // 转换数据为D3格式 - 使用useMemo避免不必要的重新计算
  const d3Data = useMemo(() => {
    return convertToD3Data(filteredNodes, edges || []);
  }, [filteredNodes, edges]);

  return (
    <div className={`flex h-full bg-[#0d1117] ${className}`}>
      {/* 控制面板 */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-80 bg-[#161b22] border-r border-gray-700/50 p-6 overflow-y-auto"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center mb-2">
              <Network className="w-6 h-6 mr-2 text-blue-400" />
              知识图谱
            </h2>
            <p className="text-sm text-gray-400">
              探索知识实体关系
            </p>
          </div>

          {/* Search */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">搜索节点</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜索节点..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#21262d] border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>

          {/* Filter */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">节点类型</h3>
            <select
              value={selectedNodeType}
              onChange={(e) => setSelectedNodeType(e.target.value)}
              className="w-full px-3 py-2 bg-[#21262d] border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-white"
            >
              <option value="all">全部类型</option>
              <option value="PERSON">人员</option>
              <option value="ORGANIZATION">组织</option>
              <option value="CATEGORY">类别</option>
              <option value="EVENT">事件</option>
            </select>
          </div>

          {/* Statistics */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">图谱统计</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">节点数量</span>
                <span className="font-medium text-gray-200">{filteredNodes.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">关系数量</span>
                <span className="font-medium text-gray-200">{edges.length}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              <span>导出图谱</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* 主图谱画布 */}
      <div className="flex-1 relative bg-[#0d1117]">
        {/* D3.js 知识图谱 */}
        <div className="relative w-full h-full">
          <D3ForceGraph
            nodes={d3Data.nodes}
            links={d3Data.links}
            width={800}
            height={600}
            focusNodeId={focusNodeId}
            onNodeClick={handleNodeClick}
          />

          {/* 图谱信息面板 */}
          <div className="absolute top-4 right-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#161b22] rounded-lg shadow-lg p-4 min-w-[200px] border border-gray-700/50"
            >
              <div className="flex items-center space-x-2 mb-3">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="font-medium text-white">实时状态</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">节点</span>
                  <span className="font-medium text-gray-200">{filteredNodes.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">关系</span>
                  <span className="font-medium text-gray-200">{edges.length}</span>
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
              className="absolute top-0 right-0 w-80 h-full bg-[#161b22] border-l border-gray-700/50 shadow-xl flex flex-col z-10"
            >
              <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-700/50">
                <h3 className="text-lg font-semibold text-white">节点详情</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 text-gray-400 hover:text-white transition-colors text-xl"
                >
                  ×
                </button>
              </div>

              <div className="overflow-y-auto p-4 space-y-4" style={{height: '500px'}}>
                {/* 基本信息 */}
                <div className="bg-[#21262d] rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-center space-x-2 mb-2">
                    {selectedNode.type === 'PERSON' && <Users className="w-5 h-5 text-blue-400" />}
                    {selectedNode.type === 'ORGANIZATION' && <Building className="w-5 h-5 text-green-400" />}
                    {selectedNode.type === 'CATEGORY' && <Lightbulb className="w-5 h-5 text-purple-400" />}
                    {selectedNode.type === 'EVENT' && <Clock className="w-5 h-5 text-red-400" />}
                    <h4 className="font-semibold text-white">基本信息</h4>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="text-sm font-medium text-gray-400">名称</label>
                      <p className="text-white mt-1 font-medium">{selectedNode.name}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-400">类型</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        selectedNode.type === 'PERSON' ? 'bg-blue-500/20 text-blue-300' :
                        selectedNode.type === 'ORGANIZATION' ? 'bg-green-500/20 text-green-300' :
                        selectedNode.type === 'CATEGORY' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {selectedNode.type === 'PERSON' ? '人员' :
                        selectedNode.type === 'ORGANIZATION' ? '组织' :
                        selectedNode.type === 'CATEGORY' ? '类别' :
                        selectedNode.type === 'EVENT' ? '事件' : selectedNode.type}
                      </span>
                    </div>

                    {selectedNode.description && (
                      <div>
                        <label className="text-sm font-medium text-gray-400">描述</label>
                        <p className="text-gray-300 mt-1">{translateDescription(selectedNode.description)}</p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-gray-400">状态</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        selectedNode.isTemporary ? 'bg-orange-500/20 text-orange-300' : 'bg-green-500/20 text-green-300'
                      }`}>
                        {selectedNode.isTemporary ? '临时节点' : '核心节点'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 关联信息 */}
                <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <LinkIcon className="w-5 h-5 text-blue-400" />
                    <h4 className="font-semibold text-white">关联信息</h4>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">直接关联</span>
                      <span className="font-medium text-blue-400">
                        {edges.filter(edge =>
                          edge.source === selectedNode.id || edge.target === selectedNode.id
                        ).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">重要性评分</span>
                      <span className="font-medium text-gray-200">{selectedNode.count || 0}</span>
                    </div>
                  </div>
                </div>

                {/* 文件信息 */}
                {(nodeFiles[selectedNode.id] && nodeFiles[selectedNode.id].length > 0) && (
                  <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/30">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="w-5 h-5 text-green-400" />
                      <h4 className="font-semibold text-white">相关文件</h4>
                      <span className="bg-green-500/20 text-green-300 text-xs font-medium px-2 py-0.5 rounded-full">
                        {nodeFiles[selectedNode.id].length}
                      </span>
                      {loadingFiles && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-400"></div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {nodeFiles[selectedNode.id].map((file: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-[#21262d] rounded border border-gray-700/50 hover:border-green-500/50 transition-colors">
                          <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-200">{file.name || file.id}</p>
                              <p className="text-xs text-gray-500">{file.type || 'document'}</p>
                              {file.size && (
                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => downloadDocument(file.id, file.name || `document_${file.id}`)}
                              className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 transition-colors"
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

                {/* 如果正在加载文件但还没有数据 */}
                {loadingFiles && !nodeFiles[selectedNode.id] && (
                  <div className="bg-[#21262d] rounded-lg p-3 border border-gray-700/50">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                      <span className="text-sm text-gray-400">正在加载文件信息...</span>
                    </div>
                  </div>
                )}

                {/* 如果没有文件且不在加载中 */}
                {!loadingFiles && selectedNode.id && (!nodeFiles[selectedNode.id] || nodeFiles[selectedNode.id].length === 0) && (
                  <div className="bg-[#21262d] rounded-lg p-3 border border-gray-700/50">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <span className="text-sm text-gray-400">暂无关联文件</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default KnowledgeGraphVisualization;
