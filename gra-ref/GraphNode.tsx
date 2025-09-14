'use client';

import React from 'react';
import { Handle, Position } from 'reactflow';
import { 
  Database, 
  Clock, 
  FileText, 
  User, 
  Building, 
  Tag,
  Zap,
  Globe
} from 'lucide-react';

interface NodeData {
  label: string;
  type: 'entity' | 'document' | 'concept' | 'person' | 'organization' | 'event';
  isTemporary?: boolean;
  count?: number;
  description?: string;
  confidence?: number;
  lastUpdated?: string;
}

interface GraphNodeProps {
  data: NodeData;
  selected?: boolean;
}

const GraphNode: React.FC<GraphNodeProps> = ({ data, selected }) => {
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'entity':
        return <Database className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'concept':
        return <Globe className="w-4 h-4" />;
      case 'person':
        return <User className="w-4 h-4" />;
      case 'organization':
        return <Building className="w-4 h-4" />;
      case 'event':
        return <Zap className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const getNodeColor = (type: string, isTemporary: boolean = false) => {
    if (isTemporary) {
      return {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-300 dark:border-purple-600',
        text: 'text-purple-700 dark:text-purple-300',
        icon: 'text-purple-600 dark:text-purple-400'
      };
    }

    const colors = {
      entity: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-300 dark:border-blue-600',
        text: 'text-blue-700 dark:text-blue-300',
        icon: 'text-blue-600 dark:text-blue-400'
      },
      document: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-300 dark:border-green-600',
        text: 'text-green-700 dark:text-green-300',
        icon: 'text-green-600 dark:text-green-400'
      },
      concept: {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        border: 'border-orange-300 dark:border-orange-600',
        text: 'text-orange-700 dark:text-orange-300',
        icon: 'text-orange-600 dark:text-orange-400'
      },
      person: {
        bg: 'bg-pink-50 dark:bg-pink-900/20',
        border: 'border-pink-300 dark:border-pink-600',
        text: 'text-pink-700 dark:text-pink-300',
        icon: 'text-pink-600 dark:text-pink-400'
      },
      organization: {
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        border: 'border-indigo-300 dark:border-indigo-600',
        text: 'text-indigo-700 dark:text-indigo-300',
        icon: 'text-indigo-600 dark:text-indigo-400'
      },
      event: {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-300 dark:border-yellow-600',
        text: 'text-yellow-700 dark:text-yellow-300',
        icon: 'text-yellow-600 dark:text-yellow-400'
      }
    };

    return colors[type as keyof typeof colors] || colors.entity;
  };

  const colors = getNodeColor(data.type, data.isTemporary);

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg border-2 shadow-lg cursor-pointer
        transition-all duration-200 min-w-[140px] max-w-[200px]
        ${colors.bg} ${colors.border}
        ${selected ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900' : ''}
        ${data.isTemporary ? 'border-dashed' : 'border-solid'}
        hover:shadow-xl hover:scale-105
      `}
    >
      {/* 连接点 */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* 节点内容 */}
      <div className="text-center">
        {/* 图标和类型 */}
        <div className="flex items-center justify-center mb-2">
          <div className={`p-1.5 rounded-full bg-white dark:bg-gray-800 shadow-sm ${colors.icon}`}>
            {getNodeIcon(data.type)}
          </div>
          {data.isTemporary && (
            <Clock className="w-3 h-3 text-purple-500 ml-1" />
          )}
        </div>

        {/* 标签 */}
        <div className={`font-medium text-sm ${colors.text} mb-1 leading-tight`}>
          {data.label}
        </div>

        {/* 类型标签 */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {data.type}
        </div>

        {/* 统计信息 */}
        {data.count && (
          <div className="flex items-center justify-center gap-1 mb-2">
            <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {data.count}
            </span>
          </div>
        )}

        {/* 置信度 */}
        {data.confidence && (
          <div className="mb-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              置信度: {Math.round(data.confidence * 100)}%
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${
                  data.confidence > 0.8 ? 'bg-green-500' :
                  data.confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${data.confidence * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 描述 */}
        {data.description && (
          <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {data.description}
          </div>
        )}

        {/* 更新时间 */}
        {data.lastUpdated && (
          <div className="text-xs text-gray-400 mt-2">
            {data.lastUpdated}
          </div>
        )}
      </div>

      {/* 状态指示器 */}
      {data.isTemporary && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white dark:border-gray-900" />
      )}
    </div>
  );
};

export default GraphNode;