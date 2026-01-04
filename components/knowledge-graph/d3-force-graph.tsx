'use client';

import React, { useEffect, useRef, useState, memo } from 'react';
import * as d3 from 'd3';
import { getEntityColor } from '@/lib/utils/entity-colors';

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
  description?: string;
  files?: any[];
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
  focusNodeId?: string;
}

const NODE_RADIUS = 28;

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
  const onNodeClickRef = useRef(onNodeClick);

  // 更新onNodeClick引用
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  // 当focusNodeId变化时，更新选中状态
  useEffect(() => {
    if (focusNodeId && focusNodeId !== selectedNodeId) {
      setSelectedNodeId(focusNodeId);
      selectedNodeIdRef.current = focusNodeId;
      
      const targetNode = nodes.find(n => n.id === focusNodeId);
      if (targetNode && onNodeClickRef.current) {
        onNodeClickRef.current(targetNode);
      }
    }
  }, [focusNodeId, selectedNodeId, nodes]);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    console.log('D3ForceGraph rendering with:', { nodes: nodes.length, links: links.length });

    // 检查选中的节点是否还存在于当前节点列表中
    const selectedNodeExists = selectedNodeIdRef.current &&
      nodes.some(n => n.id === selectedNodeIdRef.current);

    if (selectedNodeIdRef.current && selectedNodeExists) {
      console.log('跳过重新渲染，保持静态高亮效果:', selectedNodeIdRef.current);
      return;
    }

    if (selectedNodeIdRef.current && !selectedNodeExists) {
      console.log('选中节点不存在，清除选中状态:', selectedNodeIdRef.current);
      selectedNodeIdRef.current = null;
      setSelectedNodeId(null);
    }

    // 清除之前的内容
    d3.select(svgRef.current).selectAll("*").remove();

    // 验证节点ID集合
    const nodeIds = new Set(nodes.map(n => n.id));
    
    // 过滤有效的链接
    const validLinks = links.filter(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      const isValid = nodeIds.has(sourceId) && nodeIds.has(targetId);
      if (!isValid) {
        console.warn('链接引用了不存在的节点:', { sourceId, targetId });
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
      .attr("stroke", d => (d as any).isTemporary ? "#fbbf24" : "#6b7280")
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", (d: any) => d.isTemporary ? "5,5" : "none");

    // 创建节点
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", d => getEntityColor(d.type, d.isTemporary))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(d3.drag<any, Node>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          // 拖拽结束后释放固定，允许自然布局
          d.fx = null;
          d.fy = null;
        })
      )
      .on("click", (event, d) => {
        event.stopPropagation();

        const newSelectedId = selectedNodeIdRef.current === d.id ? null : d.id;
        setSelectedNodeId(newSelectedId);
        selectedNodeIdRef.current = newSelectedId;
        


        const connectedNodes = newSelectedId ? analyzeNodeRelations(newSelectedId, validLinks) : new Set();

        // 强化高亮对比
        node
          .style("opacity", nodeData => {
            if (!newSelectedId) return 1;
            if (nodeData.id === newSelectedId) return 1;
            if (connectedNodes.has(nodeData.id)) return 0.6;
            return 0.15;
          })
          .attr("stroke-width", nodeData => {
            if (!newSelectedId) return 2;
            if (nodeData.id === newSelectedId) return 5;
            return 2;
          })
          .attr("stroke", nodeData => {
            if (!newSelectedId) return "#fff";
            if (nodeData.id === newSelectedId) return "#ffd700";
            return "#fff";
          });

        // 强化连线对比
        link.style("opacity", linkData => {
          if (!newSelectedId) return 0.6;
          const sourceId = typeof linkData.source === 'string' ? linkData.source : linkData.source.id;
          const targetId = typeof linkData.target === 'string' ? linkData.target : linkData.target.id;
          if (sourceId === newSelectedId || targetId === newSelectedId) return 0.9;
          return 0.05;
        });

        onNodeClickRef.current?.(d);
      });

    // 创建标签 - 白色字体配合深色背景，添加阴影增强可读性
    const labels = g.append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text(d => d.name.length > 10 ? d.name.substring(0, 10) + '...' : d.name)
      .attr("font-size", "14px")
      .attr("font-family", "Microsoft YaHei, SimHei, Arial, sans-serif")
      .attr("fill", "#ffffff")
      .attr("font-weight", "500")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 3px rgba(0,0,0,0.8), 0 -1px 3px rgba(0,0,0,0.8), 1px 0 3px rgba(0,0,0,0.8), -1px 0 3px rgba(0,0,0,0.8)");

    // 添加动画完成标志
    let animationCompleted = false;
    let tickCount = 0;
    const maxTicks = 300; // 最大tick次数，防止无限动画

    // 更新位置
    simulation.on("tick", () => {
      tickCount++;

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

      // 检查是否应该停止动画
      if (!animationCompleted && (simulation.alpha() < 0.01 || tickCount > maxTicks)) {
        animationCompleted = true;
        simulation.stop();

        // 固定所有节点位置，防止后续拖拽时重新启动动画
        node.each((d: any) => {
          d.fx = d.x;
          d.fy = d.y;
        });

        console.log('D3 animation completed after', tickCount, 'ticks');
      }
    });

    // 点击空白处取消选择
    svg.on("click", () => {
      setSelectedNodeId(null);
      selectedNodeIdRef.current = null;

      node.each((d: any) => {
        d.fx = null;
        d.fy = null;
      });

      node
        .style("opacity", 1)
        .attr("stroke-width", 2)
        .attr("stroke", "#fff");
      link.style("opacity", 0.6);

      // 只在必要时重启动画，并且使用较低的alpha值
      if (!animationCompleted) {
        simulation.alpha(0.1).restart();
      }
    });

    return () => {
      simulation.stop();
    };
  }, [nodes, links, width, height]);

  return (
    <div className="w-full h-full relative">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full bg-[#0d1117]"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 0
        }}
      />
    </div>
  );
};

export default memo(D3ForceGraph);
