'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  name: string;
  type: string;
  isTemporary?: boolean;
  value: number;
  color: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type?: string;
  isTemporary?: boolean;
}

interface D3ForceGraphProps {
  nodes: Node[];
  links: Link[];
  width?: number;
  height?: number;
  onNodeClick?: (node: Node) => void;
  focusNodeId?: string; // 要聚焦的节点ID
}

const NODE_RADIUS = 28;

// 获取节点颜色 - 优化颜色方案
const getNodeColor = (type: string, isTemporary?: boolean) => {
  if (isTemporary) {
    // 临时节点使用更醒目的颜色
    switch (type) {
      case 'person': return '#f59e0b'; // 橙色 - 临时人员
      case 'organization': return '#ef4444'; // 红色 - 临时组织
      case 'concept': return '#ec4899'; // 粉色 - 临时概念
      case 'document': return '#8b5cf6'; // 紫色 - 临时文档
      case 'department': return '#f97316'; // 深橙色 - 临时部门
      case 'project': return '#06b6d4'; // 青色 - 临时项目
      default: return '#fbbf24'; // 默认黄色
    }
  }
  
  // 永久节点使用相对柔和的颜色
  switch (type) {
    case 'person': return '#3b82f6'; // 蓝色 - 人员
    case 'organization': return '#10b981'; // 绿色 - 组织
    case 'concept': return '#8b5cf6'; // 紫色 - 概念
    case 'document': return '#6366f1'; // 靛蓝色 - 文档
    case 'department': return '#059669'; // 深绿色 - 部门
    case 'project': return '#0891b2'; // 深青色 - 项目
    case 'technology': return '#7c3aed'; // 深紫色 - 技术
    case 'event': return '#dc2626'; // 深红色 - 事件
    default: return '#6b7280'; // 默认灰色
  }
};

// 分析节点关联关系
const analyzeNodeRelations = (selectedNodeId: string, links: Link[]) => {
  const directNodes = new Set<string>();
  
  links.forEach(link => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    if (sourceId === selectedNodeId) {
      directNodes.add(targetId);
    } else if (targetId === selectedNodeId) {
      directNodes.add(sourceId);
    }
  });

  return directNodes;
};

const D3ForceGraph: React.FC<D3ForceGraphProps> = ({
  nodes,
  links,
  width = 800,
  height = 600,
  onNodeClick,
  focusNodeId
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  
  // 当focusNodeId变化时，更新选中状态
  useEffect(() => {
    if (focusNodeId && focusNodeId !== selectedNodeId) {
      setSelectedNodeId(focusNodeId);
      selectedNodeIdRef.current = focusNodeId;
      
      // 找到对应的节点并触发点击事件
      const targetNode = nodes.find(n => n.id === focusNodeId);
      if (targetNode && onNodeClick) {
        onNodeClick(targetNode);
      }
    }
  }, [focusNodeId, selectedNodeId, nodes, onNodeClick]);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    console.log('D3ForceGraph rendering with:', { nodes: nodes.length, links: links.length });

    // 检查选中的节点是否还存在于当前节点列表中
    const selectedNodeExists = selectedNodeIdRef.current &&
      nodes.some(n => n.id === selectedNodeIdRef.current);

    // 如果有选中节点且该节点仍然存在，不要重新渲染（保持静态高亮效果）
    // 但如果选中的节点不在当前节点列表中（比如模式切换），则需要重新渲染
    if (selectedNodeIdRef.current && selectedNodeExists) {
      console.log('跳过重新渲染，保持静态高亮效果:', selectedNodeIdRef.current);
      return;
    }

    // 如果选中的节点不存在了，清除选中状态
    if (selectedNodeIdRef.current && !selectedNodeExists) {
      console.log('选中节点不存在，清除选中状态:', selectedNodeIdRef.current);
      selectedNodeIdRef.current = null;
      setSelectedNodeId(null);
    }

    // 清除之前的内容
    d3.select(svgRef.current).selectAll("*").remove();

    // 验证节点ID集合
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // 过滤有效的链接，确保source和target都存在
    const validLinks = links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const isValid = nodeIds.has(sourceId) && nodeIds.has(targetId);
      if (!isValid) {
        console.warn('链接引用了不存在的节点:', { sourceId, targetId, availableNodes: Array.from(nodeIds) });
      }
      return isValid;
    });

    const svg = d3.select(svgRef.current);
    const g = svg.append("g");

    // 设置缩放
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // 创建力导向模拟
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(validLinks)
        .id(d => d.id)
        .distance(100)
        .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(NODE_RADIUS + 10));

    // 创建连线
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(validLinks)
      .join("line")
      .attr("stroke", d => (d as any).isTemporary ? "#fbbf24" : "#999")
      .attr("stroke-opacity", 0.8)
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d: any) => d.isTemporary ? "5,5" : "none");

    // 创建节点
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", d => getNodeColor(d.type, d.isTemporary))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(d3.drag<any, Node>()
        .on("start", (event, d) => {
          // 只有在没有选中节点时才重启动画
          if (!event.active && !selectedNodeIdRef.current) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active && !selectedNodeIdRef.current) simulation.alphaTarget(0);
          // 如果有选中节点，保持固定位置；否则释放
          if (!selectedNodeIdRef.current) {
            d.fx = null;
            d.fy = null;
          }
        })
      )
      .on("click", (event, d) => {
        event.stopPropagation();

        const newSelectedId = selectedNodeIdRef.current === d.id ? null : d.id;
        setSelectedNodeId(newSelectedId);
        selectedNodeIdRef.current = newSelectedId;
        
        // 强制关闭动画 - 立即停止所有移动和动画
        simulation.stop();
        simulation.alpha(0); // 强制设置alpha为0，完全停止

        // 立即固定所有节点的当前位置，防止任何移动
        node.each((d: any) => {
          d.fx = d.x;
          d.fy = d.y;
        });

        // 强制立即更新位置，停止任何过渡动画
        node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

        const connectedNodes = newSelectedId ? analyzeNodeRelations(newSelectedId, validLinks) : new Set();

        // 强化高亮对比 - 选中节点高亮，关联节点低亮，其他节点灰色
        node
          .style("opacity", nodeData => {
            if (!newSelectedId) return 1;
            if (nodeData.id === newSelectedId) return 1; // 选中节点：完全高亮
            if (connectedNodes.has(nodeData.id)) return 0.6; // 关联节点：低亮
            return 0.15; // 其他节点：很暗的灰色
          })
          .attr("stroke-width", nodeData => {
            if (!newSelectedId) return 2;
            if (nodeData.id === newSelectedId) return 5; // 选中节点：更粗的边框
            return 2;
          })
          .attr("stroke", nodeData => {
            if (!newSelectedId) return "#fff";
            if (nodeData.id === newSelectedId) return "#ffd700"; // 选中节点：金色边框
            return "#fff";
          });

        // 强化连线对比 - 相关连线可见，无关连线几乎不可见
        link.style("opacity", linkData => {
          if (!newSelectedId) return 0.6;
          const sourceId = typeof linkData.source === 'string' ? linkData.source : linkData.source.id;
          const targetId = typeof linkData.target === 'string' ? linkData.target : linkData.target.id;
          if (sourceId === newSelectedId || targetId === newSelectedId) return 0.9;
          return 0.05; // 其他连线：几乎不可见
        });

        onNodeClick?.(d);
      });

    // 创建标签
    const labels = g.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text(d => d.name)
      .attr("font-size", "12px")
      .attr("font-family", "Arial, sans-serif")
      .attr("fill", "#333")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("pointer-events", "none");

    // 更新位置
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", d => d.x!)
        .attr("cy", d => d.y!);

      labels
        .attr("x", d => d.x!)
        .attr("y", d => d.y! + NODE_RADIUS + 15);
    });

    // 点击空白处取消选择并恢复动画
    svg.on("click", () => {
      setSelectedNodeId(null);
      selectedNodeIdRef.current = null;

      // 释放所有节点的固定位置，允许重新移动
      node.each((d: any) => {
        d.fx = null;
        d.fy = null;
      });

      // 恢复所有节点和连线的默认样式
      node
        .style("opacity", 1)
        .attr("stroke-width", 2)
        .attr("stroke", "#fff");
      link.style("opacity", 0.6);

      // 重新启动动画
      simulation.alpha(0.3).restart();
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, width, height, onNodeClick]);

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full bg-gradient-to-br from-gray-50 to-blue-50"
        style={{
          border: '1px solid #e5e7eb',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 0
        }}
      />
    </div>
  );
};

export default D3ForceGraph;