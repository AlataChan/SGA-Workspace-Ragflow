'use client';

import React, { useState } from 'react';
import { 
  Network,
  Filter,
  Layout,
  Search,
  Settings,
  Eye,
  EyeOff,
  Download,
  Maximize2,
  RotateCcw,
  Zap,
  Database,
  Clock,
  Sparkles,
  TrendingUp,
  BarChart3
} from 'lucide-react';

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  coreNodes: number;
  temporaryNodes: number;
  clusters: number;
  density: number;
}

interface FilterOptions {
  showCore: boolean;
  showTemporary: boolean;
  nodeTypes: string[];
  confidenceThreshold: number;
  timeRange: string;
}

interface GraphControlPanelProps {
  stats: GraphStats;
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onLayoutChange: (layout: string) => void;
  onExport: () => void;
  onReset: () => void;
  selectedNode?: any;
  className?: string;
}

const GraphControlPanel: React.FC<GraphControlPanelProps> = ({
  stats,
  filters,
  onFiltersChange,
  onLayoutChange,
  onExport,
  onReset,
  selectedNode,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'filters' | 'layout' | 'details'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const nodeTypes = [
    { id: 'entity', label: '实体', icon: Database, color: 'blue' },
    { id: 'document', label: '文档', icon: Database, color: 'green' },
    { id: 'concept', label: '概念', icon: Sparkles, color: 'orange' },
    { id: 'person', label: '人员', icon: Database, color: 'pink' },
    { id: 'organization', label: '组织', icon: Database, color: 'indigo' },
    { id: 'event', label: '事件', icon: Zap, color: 'yellow' }
  ];

  const layoutOptions = [
    { id: 'force', label: '力导向布局', description: '自动排列，突出关系' },
    { id: 'hierarchical', label: '层次布局', description: '树状结构，清晰层级' },
    { id: 'circular', label: '环形布局', description: '环形排列，美观对称' },
    { id: 'grid', label: '网格布局', description: '规整排列，便于浏览' }
  ];

  const timeRanges = [
    { id: 'all', label: '全部时间' },
    { id: '1h', label: '最近1小时' },
    { id: '24h', label: '最近24小时' },
    { id: '7d', label: '最近7天' },
    { id: '30d', label: '最近30天' }
  ];

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const toggleNodeType = (nodeType: string) => {
    const newTypes = filters.nodeTypes.includes(nodeType)
      ? filters.nodeTypes.filter(t => t !== nodeType)
      : [...filters.nodeTypes, nodeType];
    
    handleFilterChange('nodeTypes', newTypes);
  };

  const tabs = [
    { id: 'overview', label: '概览', icon: BarChart3 },
    { id: 'filters', label: '过滤', icon: Filter },
    { id: 'layout', label: '布局', icon: Layout },
    { id: 'details', label: '详情', icon: Settings }
  ];

  return (
    <div className={`w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${className}`}>
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-500" />
            图谱控制
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="导出图谱"
            >
              <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              onClick={onReset}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="重置视图"
            >
              <RotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索节点..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                      bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white
                      focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* 统计信息 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">图谱统计</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs text-blue-600 dark:text-blue-400">节点</span>
                  </div>
                  <div className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                    {stats.totalNodes}
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-xs text-green-600 dark:text-green-400">关系</span>
                  </div>
                  <div className="text-lg font-semibold text-green-700 dark:text-green-300">
                    {stats.totalEdges}
                  </div>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs text-purple-600 dark:text-purple-400">临时</span>
                  </div>
                  <div className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                    {stats.temporaryNodes}
                  </div>
                </div>
                
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-xs text-orange-600 dark:text-orange-400">集群</span>
                  </div>
                  <div className="text-lg font-semibold text-orange-700 dark:text-orange-300">
                    {stats.clusters}
                  </div>
                </div>
              </div>
            </div>

            {/* 密度指标 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">图谱密度</h3>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">连接密度</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {(stats.density * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${stats.density * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="space-y-6">
            {/* 显示控制 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">显示控制</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showCore}
                    onChange={(e) => handleFilterChange('showCore', e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <Database className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">显示核心节点</span>
                </label>
                
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.showTemporary}
                    onChange={(e) => handleFilterChange('showTemporary', e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">显示临时节点</span>
                </label>
              </div>
            </div>

            {/* 节点类型过滤 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">节点类型</h3>
              <div className="space-y-2">
                {nodeTypes.map((type) => {
                  const Icon = type.icon;
                  const isSelected = filters.nodeTypes.includes(type.id);
                  
                  return (
                    <button
                      key={type.id}
                      onClick={() => toggleNodeType(type.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors
                        ${isSelected
                          ? `bg-${type.color}-50 dark:bg-${type.color}-900/20 text-${type.color}-700 dark:text-${type.color}-300`
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{type.label}</span>
                      {isSelected && <Eye className="w-4 h-4 ml-auto" />}
                      {!isSelected && <EyeOff className="w-4 h-4 ml-auto" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 置信度阈值 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">置信度阈值</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">最小置信度</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {Math.round(filters.confidenceThreshold * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={filters.confidenceThreshold}
                  onChange={(e) => handleFilterChange('confidenceThreshold', parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* 时间范围 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">时间范围</h3>
              <select
                value={filters.timeRange}
                onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {timeRanges.map((range) => (
                  <option key={range.id} value={range.id}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">布局算法</h3>
            {layoutOptions.map((layout) => (
              <button
                key={layout.id}
                onClick={() => onLayoutChange(layout.id)}
                className="w-full p-3 text-left bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white mb-1">
                  {layout.label}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {layout.description}
                </div>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'details' && selectedNode && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">节点详情</h3>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">名称</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedNode.data.label}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">类型</span>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{selectedNode.data.type}</p>
                </div>
                {selectedNode.data.description && (
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">描述</span>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{selectedNode.data.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphControlPanel;