'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import D3ForceGraph from './D3ForceGraph';
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

// D3.js节点和连线数据类型
interface D3Node {
  id: string;
  name: string;
  type: string;
  isTemporary?: boolean;
  value: number;
  color: string;
}

interface D3Link {
  source: string;
  target: string;
  type?: string;
  isTemporary?: boolean;
}

// 数据转换函数：API格式 -> D3.js格式
const convertToD3Data = (nodes: any[], edges: any[]) => {
  const d3Nodes: D3Node[] = nodes.map(node => ({
    id: node.id,
    name: node.name || node.label || node.id,
    type: node.type || 'Entity',
    isTemporary: node.isTemporary || false,
    value: Math.max(15, (node.count || 1) * 2), // 更大的节点，基于关联数量
    color: getNodeColor(node.type || 'Entity', node.isTemporary || false)
  }));

  const d3Links: D3Link[] = edges.map(edge => ({
    source: edge.source,
    target: edge.target,
    type: edge.type || edge.label || 'RELATED_TO',
    isTemporary: edge.isTemporary || false
  }));

  return { nodes: d3Nodes, links: d3Links };
};

// 获取节点颜色（现在使用渐变，这里保留作为备用）
const getNodeColor = (type: string, isTemporary?: boolean) => {
  if (isTemporary) return '#facc15'; // 亮黄色

  switch (type) {
    // HR 场景
    case 'department': return '#34d399'; // 绿色 - 部门
    case 'employee': return '#60a5fa'; // 蓝色 - 员工
    case 'document': return '#a78bfa'; // 紫色 - 文档/公告
    case 'project': return '#f87171'; // 红色 - 项目

    // 通用类型
    case 'person': return '#60a5fa';
    case 'organization': return '#34d399';
    case 'concept': return '#a78bfa';
    
    default: return '#9ca3af'; // 灰色 - 其他
  }
};

// 炫酷的自定义节点组件
const EntityNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const { label, type, isTemporary, count, description } = data;

  const getNodeStyle = () => {
    const baseStyle = {
      person: { bg: 'bg-blue-100', border: 'border-blue-500', dot: 'bg-blue-500' },
      organization: { bg: 'bg-green-100', border: 'border-green-500', dot: 'bg-green-500' },
      concept: { bg: 'bg-purple-100', border: 'border-purple-500', dot: 'bg-purple-500' },
      default: { bg: 'bg-gray-100', border: 'border-gray-500', dot: 'bg-gray-500' }
    };

    const style = baseStyle[type as keyof typeof baseStyle] || baseStyle.default;

    if (isTemporary) {
      return {
        ...style,
        bg: style.bg.replace('100', '50'),
        border: `${style.border} border-dashed`,
        opacity: 'opacity-70'
      };
    }

    return style;
  };

  const nodeStyle = getNodeStyle();

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`px-4 py-3 shadow-lg rounded-lg border-2 cursor-pointer transition-all duration-200 ${
        nodeStyle.bg
      } ${nodeStyle.border} ${nodeStyle.opacity || ''} ${
        selected ? 'ring-2 ring-blue-400 shadow-xl' : ''
      } ${isTemporary ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-center space-x-2">
        <motion.div
          className={`w-3 h-3 rounded-full ${nodeStyle.dot}`}
          animate={{ scale: isTemporary ? [1, 1.2, 1] : 1 }}
          transition={{ repeat: isTemporary ? Infinity : 0, duration: 2 }}
        />
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-800">{label}</div>
          {description && (
            <div className="text-xs text-gray-600 mt-1">{description}</div>
          )}
          {count && (
            <div className="text-xs bg-gray-200 rounded-full px-2 py-0.5 mt-1 inline-block">
              {count}
            </div>
          )}
        </div>
        {isTemporary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-orange-600 font-medium"
          >
            临时
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// 自定义边组件
const CustomEdge = ({ data }: any) => {
  return (
    <motion.div
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 1 }}
    />
  );
};

// 移除了ReactFlow的nodeTypes和edgeTypes，现在使用D3.js

// 核心知识图谱数据
// 复杂知识图谱数据 - 更多节点和关联
const coreNodes: Node[] = [
  // 核心公司和组织
  {
    id: '1',
    type: 'entity',
    position: { x: 400, y: 300 },
    data: {
      label: 'SGA公司',
      type: 'organization',
      description: '人工智能公司',
      isTemporary: false,
      count: 25,
      files: [
        { name: '公司简介.md', path: '/docs/company/intro.md', type: 'markdown' },
        { name: '组织架构.pdf', path: '/docs/company/structure.pdf', type: 'pdf' },
        { name: '发展历程.docx', path: '/docs/company/history.docx', type: 'document' }
      ]
    },
  },
  {
    id: '2',
    type: 'entity',
    position: { x: 200, y: 150 },
    data: {
      label: '研发部门',
      type: 'organization',
      description: '技术研发团队',
      isTemporary: false,
      count: 18,
      files: [
        { name: '技术规范.md', path: '/docs/dev/standards.md', type: 'markdown' },
        { name: '开发流程.pdf', path: '/docs/dev/process.pdf', type: 'pdf' }
      ]
    },
  },
  {
    id: '3',
    type: 'entity',
    position: { x: 600, y: 150 },
    data: {
      label: '产品部门',
      type: 'organization',
      description: '产品管理团队',
      isTemporary: false,
      count: 12,
      files: [
        { name: '产品路线图.xlsx', path: '/docs/product/roadmap.xlsx', type: 'excel' },
        { name: '需求文档.md', path: '/docs/product/requirements.md', type: 'markdown' }
      ]
    },
  },

  // 核心人员
  {
    id: '4',
    type: 'entity',
    position: { x: 100, y: 200 },
    data: {
      label: '张工程师',
      type: 'person',
      description: '首席技术官',
      isTemporary: false,
      count: 15,
      files: [
        { name: '技术架构设计.md', path: '/docs/tech/architecture.md', type: 'markdown' },
        { name: '代码规范.pdf', path: '/docs/tech/coding-standards.pdf', type: 'pdf' }
      ]
    },
  },
  {
    id: '5',
    type: 'entity',
    position: { x: 300, y: 100 },
    data: {
      label: '李产品经理',
      type: 'person',
      description: '产品负责人',
      isTemporary: false,
      count: 10,
      files: [
        { name: '产品策略.pptx', path: '/docs/product/strategy.pptx', type: 'presentation' },
        { name: '用户研究报告.pdf', path: '/docs/product/user-research.pdf', type: 'pdf' }
      ]
    },
  },
  {
    id: '6',
    type: 'entity',
    position: { x: 700, y: 200 },
    data: {
      label: '王架构师',
      type: 'person',
      description: '系统架构师',
      isTemporary: false,
      count: 20
    },
  },

  // 技术概念
  {
    id: '7',
    type: 'entity',
    position: { x: 400, y: 500 },
    data: {
      label: '人工智能',
      type: 'concept',
      description: '核心技术领域',
      isTemporary: false,
      count: 30,
      files: [
        { name: 'AI技术白皮书.pdf', path: '/docs/ai/whitepaper.pdf', type: 'pdf' },
        { name: '人工智能发展趋势.md', path: '/docs/ai/trends.md', type: 'markdown' },
        { name: 'AI应用案例.pptx', path: '/docs/ai/cases.pptx', type: 'presentation' }
      ]
    },
  },
  {
    id: '8',
    type: 'entity',
    position: { x: 200, y: 450 },
    data: {
      label: '机器学习',
      type: 'concept',
      description: 'AI子领域',
      isTemporary: false,
      count: 25,
      files: [
        { name: '机器学习算法手册.pdf', path: '/docs/ml/algorithms.pdf', type: 'pdf' },
        { name: '模型训练指南.md', path: '/docs/ml/training.md', type: 'markdown' }
      ]
    },
  },
  {
    id: '9',
    type: 'entity',
    position: { x: 600, y: 450 },
    data: {
      label: '深度学习',
      type: 'concept',
      description: 'ML子领域',
      isTemporary: false,
      count: 22
    },
  },
  {
    id: '10',
    type: 'entity',
    position: { x: 300, y: 350 },
    data: {
      label: '知识图谱',
      type: 'concept',
      description: '数据表示技术',
      isTemporary: false,
      count: 18
    },
  },
  {
    id: '11',
    type: 'entity',
    position: { x: 500, y: 350 },
    data: {
      label: '自然语言处理',
      type: 'concept',
      description: 'NLP技术',
      isTemporary: false,
      count: 16
    },
  },

  // 技术栈
  {
    id: '12',
    type: 'entity',
    position: { x: 150, y: 300 },
    data: {
      label: 'SGA-CIP平台',
      type: 'concept',
      description: '智能平台系统',
      isTemporary: false,
      count: 14,
      files: [
        { name: '平台架构文档.md', path: '/docs/platform/architecture.md', type: 'markdown' },
        { name: 'API接口文档.json', path: '/docs/platform/api.json', type: 'json' },
        { name: '部署指南.pdf', path: '/docs/platform/deployment.pdf', type: 'pdf' },
        { name: '用户手册.docx', path: '/docs/platform/manual.docx', type: 'document' }
      ]
    },
  },
  {
    id: '13',
    type: 'entity',
    position: { x: 500, y: 250 },
    data: {
      label: 'FastAPI',
      type: 'concept',
      description: 'Web框架',
      isTemporary: false,
      count: 8
    },
  },
  {
    id: '14',
    type: 'entity',
    position: { x: 350, y: 200 },
    data: {
      label: 'React',
      type: 'concept',
      description: '前端框架',
      isTemporary: false,
      count: 10
    },
  },
  {
    id: '15',
    type: 'entity',
    position: { x: 250, y: 550 },
    data: {
      label: 'MongoDB',
      type: 'concept',
      description: '文档数据库',
      isTemporary: false,
      count: 6
    },
  },
  {
    id: '16',
    type: 'entity',
    position: { x: 550, y: 550 },
    data: {
      label: 'Neo4j',
      type: 'concept',
      description: '图数据库',
      isTemporary: false,
      count: 12
    },
  },
  {
    id: '17',
    type: 'entity',
    position: { x: 400, y: 600 },
    data: {
      label: 'Python',
      type: 'concept',
      description: '编程语言',
      isTemporary: false,
      count: 15
    },
  },
  {
    id: '18',
    type: 'entity',
    position: { x: 650, y: 350 },
    data: {
      label: 'Docker',
      type: 'concept',
      description: '容器技术',
      isTemporary: false,
      count: 8
    },
  },
];

// 临时知识图谱数据（示例）
const temporaryNodes: Node[] = [
  {
    id: 'temp_1',
    type: 'entity',
    position: { x: 600, y: 150 },
    data: {
      label: '临时项目',
      type: 'concept',
      description: '当前会话项目',
      isTemporary: true,
      count: 2
    },
  },
  {
    id: 'temp_2',
    type: 'entity',
    position: { x: 500, y: 450 },
    data: {
      label: '临时需求',
      type: 'concept',
      description: '临时文件需求',
      isTemporary: true,
      count: 1
    },
  },
];

// 复杂的关联关系 - 创建多层次的连接
const coreEdges: Edge[] = [
  // 公司组织关系
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    label: '包含',
    type: 'smoothstep',
    style: { stroke: '#1890ff', strokeWidth: 2 },
  },
  {
    id: 'e1-3',
    source: '1',
    target: '3',
    label: '包含',
    type: 'smoothstep',
    style: { stroke: '#1890ff', strokeWidth: 2 },
  },

  // 人员归属关系
  {
    id: 'e2-4',
    source: '2',
    target: '4',
    label: '负责人',
    type: 'smoothstep',
    style: { stroke: '#10b981', strokeWidth: 2 },
  },
  {
    id: 'e3-5',
    source: '3',
    target: '5',
    label: '负责人',
    type: 'smoothstep',
    style: { stroke: '#10b981', strokeWidth: 2 },
  },
  {
    id: 'e2-6',
    source: '2',
    target: '6',
    label: '成员',
    type: 'smoothstep',
    style: { stroke: '#10b981', strokeWidth: 2 },
  },

  // 技术领域关系
  {
    id: 'e1-7',
    source: '1',
    target: '7',
    label: '专注于',
    type: 'smoothstep',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
  },
  {
    id: 'e7-8',
    source: '7',
    target: '8',
    label: '包含',
    type: 'smoothstep',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
  },
  {
    id: 'e7-9',
    source: '7',
    target: '9',
    label: '包含',
    type: 'smoothstep',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
  },
  {
    id: 'e8-9',
    source: '8',
    target: '9',
    label: '相关',
    type: 'smoothstep',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
  },
  {
    id: 'e7-10',
    source: '7',
    target: '10',
    label: '应用',
    type: 'smoothstep',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
  },
  {
    id: 'e7-11',
    source: '7',
    target: '11',
    label: '应用',
    type: 'smoothstep',
    style: { stroke: '#8b5cf6', strokeWidth: 2 },
  },

  // 平台技术关系
  {
    id: 'e1-12',
    source: '1',
    target: '12',
    label: '开发',
    type: 'smoothstep',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
  },
  {
    id: 'e12-13',
    source: '12',
    target: '13',
    label: '使用',
    type: 'smoothstep',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
  },
  {
    id: 'e12-14',
    source: '12',
    target: '14',
    label: '使用',
    type: 'smoothstep',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
  },
  {
    id: 'e12-15',
    source: '12',
    target: '15',
    label: '存储于',
    type: 'smoothstep',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
  },
  {
    id: 'e10-16',
    source: '10',
    target: '16',
    label: '存储于',
    type: 'smoothstep',
    style: { stroke: '#f59e0b', strokeWidth: 2 },
  },

  // 技术栈关系
  {
    id: 'e13-17',
    source: '13',
    target: '17',
    label: '基于',
    type: 'smoothstep',
    style: { stroke: '#ef4444', strokeWidth: 2 },
  },
  {
    id: 'e15-17',
    source: '15',
    target: '17',
    label: '驱动',
    type: 'smoothstep',
    style: { stroke: '#ef4444', strokeWidth: 2 },
  },
  {
    id: 'e16-17',
    source: '16',
    target: '17',
    label: '驱动',
    type: 'smoothstep',
    style: { stroke: '#ef4444', strokeWidth: 2 },
  },

  // 人员技术关系
  {
    id: 'e4-7',
    source: '4',
    target: '7',
    label: '专长',
    type: 'smoothstep',
    style: { stroke: '#06b6d4', strokeWidth: 2 },
  },
  {
    id: 'e6-12',
    source: '6',
    target: '12',
    label: '设计',
    type: 'smoothstep',
    style: { stroke: '#06b6d4', strokeWidth: 2 },
  },
  {
    id: 'e5-12',
    source: '5',
    target: '12',
    label: '管理',
    type: 'smoothstep',
    style: { stroke: '#06b6d4', strokeWidth: 2 },
  },

  // 部署相关
  {
    id: 'e12-18',
    source: '12',
    target: '18',
    label: '部署于',
    type: 'smoothstep',
    style: { stroke: '#84cc16', strokeWidth: 2 },
  },
];

const temporaryEdges: Edge[] = [
  {
    id: 'temp_e2',
    source: 'temp_1',
    target: 'temp_2',
    label: '包含',
    type: 'smoothstep',
    style: { stroke: '#ff7875', strokeWidth: 2, strokeDasharray: '5,5' },
    animated: true,
  },
];

// 混合模式下的临时边（包含与核心节点的连接）
const mixedTemporaryEdges: Edge[] = [
  {
    id: 'temp_e1',
    source: '1',
    target: 'temp_1',
    label: '关联',
    type: 'smoothstep',
    style: { stroke: '#ff7875', strokeWidth: 2, strokeDasharray: '5,5' },
    animated: true,
  },
  ...temporaryEdges
];

interface KnowledgeGraphVisualizationProps {
  className?: string;
  sessionId?: string;
}

const KnowledgeGraphVisualization: React.FC<KnowledgeGraphVisualizationProps> = ({
  className = '',
  sessionId
}) => {
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [graphMode, setGraphMode] = useState<'core' | 'temporary' | 'mixed'>('mixed');
  const [showTemporary, setShowTemporary] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeType, setSelectedNodeType] = useState('all');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  
  // 存储原始数据，用于模式切换时过滤
  const [allPermanentNodes, setAllPermanentNodes] = useState<any[]>([]);
  const [allTemporaryNodes, setAllTemporaryNodes] = useState<any[]>([]);
  const [allPermanentEdges, setAllPermanentEdges] = useState<any[]>([]);
  const [allTemporaryEdges, setAllTemporaryEdges] = useState<any[]>([]);

  // 移除了ReactFlow的回调函数，现在使用D3.js

  // 从API获取图谱数据
  useEffect(() => {
    const fetchGraphData = async () => {
      try {
        // 先清空当前数据，确保切换时没有残留
        setNodes([]);
        setEdges([]);

        const endpoint = sessionId
          ? `/api/v1/graphs/combined/${sessionId}`
          : '/api/v1/graphs/permanent';

        const response = await fetch(endpoint);
        const result = await response.json();

        if (response.ok && result.status === 'success') {
          // 获取所有数据
          const apiNodes = result.graph?.nodes || [];
          const apiEdges = result.graph?.edges || [];

          // 转换为D3需要的格式
          const allProcessedNodes = apiNodes.map(node => ({
            id: node.id,
            name: node.label || node.id,
            type: node.type || 'Entity',
            isTemporary: node.id.startsWith('temp_') || node.isTemporary,
            value: 10,
            color: node.style?.color || (node.id.startsWith('temp_') ? '#f59e0b' : '#1890ff'),
            properties: node.properties || {},
            files: node.files || []
          }));

          const allProcessedEdges = apiEdges.map(edge => ({
            source: edge.source,
            target: edge.target,
            type: edge.label || 'RELATED_TO',
            isTemporary: edge.id?.startsWith('temp_') || edge.isTemporary
          }));

          // 保存所有数据
          setAllPermanentNodes(allProcessedNodes.filter(n => !n.isTemporary));
          setAllTemporaryNodes(allProcessedNodes.filter(n => n.isTemporary));
          setAllPermanentEdges(allProcessedEdges.filter(e => !e.isTemporary));
          setAllTemporaryEdges(allProcessedEdges.filter(e => e.isTemporary));

          // 数据加载完成，过滤逻辑由第二个useEffect处理

          console.log('数据加载完成:', {
            模式: graphMode,
            总节点数: allProcessedNodes.length,
            永久节点: allProcessedNodes.filter(n => !n.isTemporary).length,
            临时节点: allProcessedNodes.filter(n => n.isTemporary).length,
            sessionId: sessionId
          });

        } else {
          // 如果API失败，使用示例数据
          console.warn('API获取失败，使用示例数据');
          loadFallbackData();
        }
      } catch (error) {
        console.error('获取图谱数据失败:', error);
        // 使用示例数据
        loadFallbackData();
      }
    };

    const loadFallbackData = () => {
      // 使用示例数据
      setAllPermanentNodes([...coreNodes]); // 使用扩展运算符避免引用问题
      setAllTemporaryNodes([...temporaryNodes]);
      setAllPermanentEdges([...coreEdges]);
      setAllTemporaryEdges([...temporaryEdges]);

      // 示例数据加载完成，过滤逻辑由第二个useEffect处理
    };

    fetchGraphData();
  }, [sessionId]);

  // 根据模式过滤数据的函数
  const filterDataByMode = useCallback(() => {
    // 确保有数据才进行过滤
    if (allPermanentNodes.length === 0 && allTemporaryNodes.length === 0) {
      console.log('没有数据可过滤，跳过');
      return;
    }

    let nodesToShow: any[] = [];
    let edgesToShow: any[] = [];

    switch (graphMode) {
      case 'core':
        nodesToShow = [...allPermanentNodes]; // 使用扩展运算符创建新数组
        edgesToShow = [...allPermanentEdges];
        break;
      case 'temporary':
        nodesToShow = [...allTemporaryNodes];
        edgesToShow = [...allTemporaryEdges];
        break;
      case 'mixed':
      default:
        nodesToShow = [...allPermanentNodes, ...(showTemporary ? allTemporaryNodes : [])];
        edgesToShow = [...allPermanentEdges, ...(showTemporary ? allTemporaryEdges : [])];
        break;
    }

    setNodes(nodesToShow);
    setEdges(edgesToShow);

    console.log('模式切换:', {
      模式: graphMode,
      显示节点数: nodesToShow.length,
      显示边数: edgesToShow.length,
      显示临时节点: showTemporary,
      永久节点总数: allPermanentNodes.length,
      临时节点总数: allTemporaryNodes.length
    });
  }, [graphMode, showTemporary, allPermanentNodes, allTemporaryNodes, allPermanentEdges, allTemporaryEdges]);

  // 当模式或临时节点显示状态改变时，重新过滤数据
  useEffect(() => {
    filterDataByMode();
  }, [filterDataByMode]);

  // 后端已经根据mode参数过滤数据，前端不需要再过滤

  // 搜索和过滤功能
  const filteredNodes = nodes.filter(node => {
    const matchesSearch = searchTerm === '' ||
      (node.name && node.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (node.label && node.label.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (node.properties && node.properties.description && node.properties.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = selectedNodeType === 'all' || node.type === selectedNodeType;

    return matchesSearch && matchesType;
  });

  // 高亮搜索结果
  useEffect(() => {
    setNodes(nodes =>
      nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          opacity: filteredNodes.some(fn => fn.id === node.id) ? 1 : 0.3,
        }
      }))
    );
  }, [searchTerm, selectedNodeType, setNodes]);

  const handleExport = () => {
    // 导出图谱数据
    const graphData = {
      nodes: nodes,
      edges: edges,
      mode: graphMode,
      timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(graphData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `knowledge-graph-${graphMode}.json`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const graphModes = [
    { id: 'core', label: '核心图谱', icon: Database, color: 'blue' },
    { id: 'temporary', label: '临时图谱', icon: Clock, color: 'purple' },
    { id: 'mixed', label: '混合视图', icon: GitBranch, color: 'green' }
  ];

  return (
    <div className={`flex h-full ${className}`}>
      {/* 炫酷控制面板 */}
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto"
      >
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center mb-2">
              <Network className="w-6 h-6 mr-2 text-blue-500" />
              知识图谱
            </h2>
            <p className="text-sm text-gray-500">
              探索和分析知识实体关系
            </p>
          </div>

          {/* Graph Mode Selector */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">图谱模式</h3>
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
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg border transition-all ${
                      isSelected
                        ? `bg-${mode.color}-50 border-${mode.color}-300 text-${mode.color}-700`
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{mode.label}</span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ml-auto w-2 h-2 bg-current rounded-full"
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Temporary Nodes Toggle */}
          {graphMode === 'mixed' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">显示临时节点</span>
                <button
                  onClick={() => setShowTemporary(!showTemporary)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showTemporary ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <motion.span
                    animate={{ x: showTemporary ? 20 : 4 }}
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition"
                  />
                </button>
              </div>
            </motion.div>
          )}

          {/* Search */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">搜索节点</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索节点..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Filter */}
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
            </select>
          </div>

          {/* Statistics */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">图谱统计</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">节点数量</span>
                <span className="font-medium">{nodes.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">关系数量</span>
                <span className="font-medium">{edges.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">临时节点</span>
                <span className="font-medium text-orange-600">
                  {nodes.filter(n => n.isTemporary).length}
                </span>
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
      <div className="flex-1 relative">
        {/* D3.js 知识图谱 */}
        <div className="relative w-full h-full">
          <D3ForceGraph
            nodes={convertToD3Data(nodes, edges).nodes}
            links={convertToD3Data(nodes, edges).links}
            width={800}
            height={600}
            focusNodeId={focusNodeId}
            onNodeClick={(node) => {
              // 转换回ReactFlow格式用于侧边栏显示
              const reactFlowNode = nodes.find(n => n.id === node.id);
              if (reactFlowNode) {
                setSelectedNode(reactFlowNode);
                setFocusNodeId(node.id);
              }
            }}
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
                  <span className="text-gray-600">当前模式</span>
                  <span className="font-medium capitalize">{graphMode}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">节点</span>
                  <span className="font-medium">{nodes.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">关系</span>
                  <span className="font-medium">{edges.length}</span>
                </div>
                {sessionId && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">会话</span>
                    <span className="font-medium text-blue-600 text-xs">
                      {sessionId.slice(0, 8)}...
                    </span>
                  </div>
                )}
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
                  ×
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
                      <p className="text-gray-900 mt-1 font-medium">{selectedNode.label || selectedNode.name || selectedNode.id}</p>
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

                    {(selectedNode.properties?.description || selectedNode.description) && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">描述</label>
                        <p className="text-gray-600 mt-1">{selectedNode.properties?.description || selectedNode.description}</p>
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
                        {edges.filter(edge =>
                          edge.source === selectedNode.id || edge.target === selectedNode.id
                        ).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">总关联数</span>
                      <span className="font-medium text-gray-900">{selectedNode.count || 0}</span>
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
                                console.log('打开文件:', file.path);
                                window.open(`/api/files${file.path}`, '_blank');
                              }}
                              className="flex items-center space-x-1 text-green-600 hover:text-green-700 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span className="text-xs">打开</span>
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  // 下载文件逻辑
                                  const response = await fetch(`/api/v1/files/download${file.path}`);
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
    </div>
  );
};

export default KnowledgeGraphVisualization;
