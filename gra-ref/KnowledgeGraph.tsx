'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
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
  ExternalLink
} from 'lucide-react';

// 获取节点样式 - 根据类型和是否临时返回不同颜色
const getNodeStyle = (type: string, isTemporary?: boolean) => {
  if (isTemporary) {
    switch (type) {
      case 'person': return {
        border: 'border-dashed border-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-700 dark:text-orange-300'
      };
      case 'organization': return {
        border: 'border-dashed border-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-300'
      };
      case 'concept': return {
        border: 'border-dashed border-pink-400',
        bg: 'bg-pink-50 dark:bg-pink-900/20',
        text: 'text-pink-700 dark:text-pink-300'
      };
      case 'document': return {
        border: 'border-dashed border-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        text: 'text-purple-700 dark:text-purple-300'
      };
      case 'department': return {
        border: 'border-dashed border-orange-500',
        bg: 'bg-orange-100 dark:bg-orange-800/20',
        text: 'text-orange-800 dark:text-orange-200'
      };
      default: return {
        border: 'border-dashed border-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        text: 'text-yellow-700 dark:text-yellow-300'
      };
    }
  }
  
  // 永久节点
  switch (type) {
    case 'person': return {
      border: 'border-solid border-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300'
    };
    case 'organization': return {
      border: 'border-solid border-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300'
    };
    case 'concept': return {
      border: 'border-solid border-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-700 dark:text-purple-300'
    };
    case 'document': return {
      border: 'border-solid border-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-700 dark:text-indigo-300'
    };
    case 'department': return {
      border: 'border-solid border-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300'
    };
    default: return {
      border: 'border-solid border-gray-400',
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      text: 'text-gray-700 dark:text-gray-300'
    };
  }
};

// Custom Node Component
const CustomNode = ({ data, selected }: any) => {
  const { label, type, isTemporary, count } = data;
  const nodeStyle = getNodeStyle(type, isTemporary);
  
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
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {type}
        </div>
      )}
      {count && (
        <div className="text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5 mt-1 inline-block">
          {count}
        </div>
      )}
    </motion.div>
  );
};

// Custom Edge Component
const CustomEdge = ({ data }: any) => {
  return (
    <motion.div
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1 }}
    />
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

interface KnowledgeGraphProps {
  className?: string;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ className = '' }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [graphMode, setGraphMode] = useState<'core' | 'temporary' | 'mixed'>('mixed');
  const [showTemporary, setShowTemporary] = useState(true);
  const [layoutType, setLayoutType] = useState<'hierarchical' | 'force' | 'circular'>('force');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Initialize sample data
  useEffect(() => {
    const sampleNodes: Node[] = [
      {
        id: '1',
        type: 'custom',
        position: { x: 250, y: 100 },
        data: { label: 'SGA公司', type: '组织', isTemporary: false, count: 5 }
      },
      {
        id: '2',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: { label: 'AI技术', type: '技术', isTemporary: false, count: 12 }
      },
      {
        id: '3',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: { label: '知识图谱', type: '概念', isTemporary: false, count: 8 }
      },
      {
        id: '4',
        type: 'custom',
        position: { x: 250, y: 300 },
        data: { label: '临时项目', type: '项目', isTemporary: true, count: 3 }
      },
      {
        id: '5',
        type: 'custom',
        position: { x: 500, y: 150 },
        data: { label: 'GraphRAG', type: '技术', isTemporary: true, count: 2 }
      }
    ];

    const sampleEdges: Edge[] = [
      {
        id: 'e1-2',
        source: '1',
        target: '2',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#3b82f6' }
      },
      {
        id: 'e1-3',
        source: '1',
        target: '3',
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#3b82f6' }
      },
      {
        id: 'e2-4',
        source: '2',
        target: '4',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#8b5cf6', strokeDasharray: '5,5' }
      },
      {
        id: 'e3-5',
        source: '3',
        target: '5',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#8b5cf6', strokeDasharray: '5,5' }
      }
    ];

    setNodes(sampleNodes);
    setEdges(sampleEdges);
  }, [setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const filterNodes = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => {
        let shouldHide = false;
        
        switch (graphMode) {
          case 'core':
            // 核心模式：只显示永久节点
            shouldHide = node.data.isTemporary;
            break;
          case 'temporary':
            // 临时模式：只显示临时节点
            shouldHide = !node.data.isTemporary;
            break;
          case 'mixed':
          default:
            // 混合模式：根据showTemporary设置决定是否显示临时节点
            shouldHide = !showTemporary && node.data.isTemporary;
            break;
        }
        
        return {
          ...node,
          hidden: shouldHide
        };
      })
    );
    
    setEdges((eds) =>
      eds.map((edge) => {
        let shouldHide = false;
        
        switch (graphMode) {
          case 'core':
            // 核心模式：只显示永久节点之间的连接
            shouldHide = edge.style?.strokeDasharray === '5,5'; // 临时连接用虚线表示
            break;
          case 'temporary':
            // 临时模式：只显示临时节点之间的连接
            shouldHide = edge.style?.strokeDasharray !== '5,5';
            break;
          case 'mixed':
          default:
            // 混合模式：根据showTemporary设置决定显示
            shouldHide = !showTemporary && edge.style?.strokeDasharray === '5,5';
            break;
        }
        
        return {
          ...edge,
          hidden: shouldHide
        };
      })
    );
  }, [graphMode, showTemporary, setNodes, setEdges]);

  useEffect(() => {
    filterNodes();
  }, [filterNodes]);

  const graphModes = [
    { id: 'core', label: '核心图谱', icon: Database, color: 'blue' },
    { id: 'temporary', label: '临时图谱', icon: Clock, color: 'purple' },
    { id: 'mixed', label: '混合视图', icon: GitBranch, color: 'green' }
  ];

  const layoutOptions = [
    { id: 'force', label: '力导向布局' },
    { id: 'hierarchical', label: '层次布局' },
    { id: 'circular', label: '环形布局' }
  ];

  return (
    <div className={`flex h-full ${className}`}>
      {/* Control Panel */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center mb-2">
              <Network className="w-6 h-6 mr-2 text-blue-500" />
              知识图谱
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              探索和分析知识实体关系
            </p>
          </div>

          {/* Graph Mode Selector */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">图谱模式</h3>
            <div className="space-y-2">
              {graphModes.map((mode) => {
                const Icon = mode.icon;
                const isSelected = graphMode === mode.id;
                
                return (
                  <motion.button
                    key={mode.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setGraphMode(mode.id as any)}
                    className={`
                      w-full flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200
                      ${isSelected
                        ? `bg-${mode.color}-50 border-${mode.color}-200 text-${mode.color}-700 dark:bg-${mode.color}-900/20 dark:border-${mode.color}-700 dark:text-${mode.color}-300`
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{mode.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Visibility Controls */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">显示控制</h3>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTemporary}
                  onChange={(e) => setShowTemporary(e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <Clock className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">显示临时节点</span>
              </label>
            </div>
          </div>

          {/* Layout Options */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">布局算法</h3>
            <select
              value={layoutType}
              onChange={(e) => setLayoutType(e.target.value as any)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {layoutOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Node Details */}
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">节点详情</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">名称:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedNode.data.label}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">类型:</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedNode.data.type}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">状态:</span>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    selectedNode.data.isTemporary 
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  }`}>
                    {selectedNode.data.isTemporary ? '临时' : '永久'}
                  </span>
                </div>
                {selectedNode.data.count && (
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">关联数:</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedNode.data.count}</p>
                  </div>
                )}
                
                {/* 文件信息 */}
                {selectedNode.data.files && selectedNode.data.files.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mt-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <FileText className="w-4 h-4 text-green-500" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">相关文件</span>
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-1.5 py-0.5 rounded-full">
                        {selectedNode.data.files.length}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {selectedNode.data.files.map((file: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{file.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            <button
                              onClick={() => window.open(`/api/files${file.path}`, '_blank')}
                              className="text-green-600 hover:text-green-700 transition-colors"
                              title="打开文件"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(`http://localhost:8001/api/v1/files/download${file.path}`);
                                  if (response.ok) {
                                    const blob = await response.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = file.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    window.URL.revokeObjectURL(url);
                                    document.body.removeChild(a);
                                  } else {
                                    alert('下载失败，文件可能不存在');
                                  }
                                } catch (error) {
                                  console.error('下载错误:', error);
                                  alert('下载失败，请稍后重试');
                                }
                              }}
                              className="text-blue-600 hover:text-blue-700 transition-colors"
                              title="下载文件"
                            >
                              <Download className="w-3 h-3" />
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

          {/* Actions */}
          <div className="space-y-2">
            <button className="w-full flex items-center justify-center space-x-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              <span className="text-sm">导出图谱</span>
            </button>
            <button className="w-full flex items-center justify-center space-x-2 p-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Settings className="w-4 h-4" />
              <span className="text-sm">高级设置</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Graph Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          className="bg-gray-50 dark:bg-gray-900"
        >
          <Background color="#aaa" gap={16} />
          <Controls className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" />
          <MiniMap 
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            nodeColor={(node) => node.data.isTemporary ? '#8b5cf6' : '#3b82f6'}
          />
          
          {/* Top Panel */}
          <Panel position="top-right" className="space-x-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </motion.button>
          </Panel>

          {/* Stats Panel */}
          <Panel position="top-left">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600 dark:text-gray-300">核心: {nodes.filter(n => !n.data.isTemporary).length}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-purple-500 rounded-full border-2 border-purple-500" style={{ borderStyle: 'dashed' }}></div>
                  <span className="text-gray-600 dark:text-gray-300">临时: {nodes.filter(n => n.data.isTemporary).length}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Zap className="w-3 h-3 text-yellow-500" />
                  <span className="text-gray-600 dark:text-gray-300">关系: {edges.length}</span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
};

export default KnowledgeGraph;