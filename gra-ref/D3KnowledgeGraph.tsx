'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'concept';
  isTemporary?: boolean;
  value: number; // 节点大小
  color: string; // 节点颜色
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  type: string;
}

interface D3KnowledgeGraphProps {
  mode: 'core' | 'temporary' | 'mixed';
  showTemporary: boolean;
  onNodeClick?: (node: Node) => void;
}

const D3KnowledgeGraph: React.FC<D3KnowledgeGraphProps> = ({ 
  mode, 
  showTemporary, 
  onNodeClick 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 节点颜色映射函数
  const getNodeColor = (type: string, isTemporary?: boolean) => {
    if (isTemporary) return '#fbbf24'; // 黄色
    switch (type) {
      case 'person': return '#3b82f6'; // 蓝色
      case 'organization': return '#10b981'; // 绿色
      case 'concept': return '#8b5cf6'; // 紫色
      default: return '#6b7280'; // 灰色
    }
  };  // 模拟数据 - 直接按照knowledge-graph-studio格式
  const allNodes: Node[] = [
    { id: '1', name: 'SGA公司', type: 'organization', value: 30, color: getNodeColor('organization') },
    { id: '2', name: '研发部门', type: 'organization', value: 25, color: getNodeColor('organization') },
    { id: '3', name: '产品部门', type: 'organization', value: 25, color: getNodeColor('organization') },
    { id: '4', name: '张工程师', type: 'person', value: 20, color: getNodeColor('person') },
    { id: '5', name: '李产品经理', type: 'person', value: 20, color: getNodeColor('person') },
    { id: '6', name: '王架构师', type: 'person', value: 20, color: getNodeColor('person') },
    { id: '7', name: '人工智能', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '8', name: '机器学习', type: 'concept', value: 20, color: getNodeColor('concept') },
    { id: '9', name: '深度学习', type: 'concept', value: 18, color: getNodeColor('concept') },
    { id: '10', name: '知识图谱', type: 'concept', value: 22, color: getNodeColor('concept') },
    { id: '11', name: '自然语言处理', type: 'concept', value: 18, color: getNodeColor('concept') },
    { id: '12', name: 'SGA-CIP平台', type: 'concept', value: 28, color: getNodeColor('concept') },
    { id: '13', name: 'FastAPI', type: 'concept', value: 15, color: getNodeColor('concept') },
    { id: '14', name: 'React', type: 'concept', value: 15, color: getNodeColor('concept') },
    { id: '15', name: 'MongoDB', type: 'concept', value: 15, color: getNodeColor('concept') },
    { id: '16', name: 'Neo4j', type: 'concept', value: 15, color: getNodeColor('concept') },
    { id: '17', name: 'Python', type: 'concept', value: 18, color: getNodeColor('concept') },
    { id: '18', name: 'Docker', type: 'concept', value: 15, color: getNodeColor('concept') },
    { id: '19', name: '临时项目', type: 'concept', value: 20, color: getNodeColor('concept', true), isTemporary: true },
    { id: '20', name: '临时需求', type: 'concept', value: 20, color: getNodeColor('concept', true), isTemporary: true },
  ];

  const allLinks: Link[] = [
    { source: '1', target: '2', type: 'contains' },
    { source: '1', target: '3', type: 'contains' },
    { source: '2', target: '4', type: 'employs' },
    { source: '2', target: '6', type: 'employs' },
    { source: '3', target: '5', type: 'employs' },
    { source: '4', target: '7', type: 'works_on' },
    { source: '4', target: '8', type: 'works_on' },
    { source: '5', target: '12', type: 'manages' },
    { source: '6', target: '12', type: 'designs' },
    { source: '7', target: '8', type: 'includes' },
    { source: '8', target: '9', type: 'includes' },
    { source: '7', target: '10', type: 'includes' },
    { source: '7', target: '11', type: 'includes' },
    { source: '12', target: '13', type: 'uses' },
    { source: '12', target: '14', type: 'uses' },
    { source: '12', target: '15', type: 'uses' },
    { source: '12', target: '16', type: 'uses' },
    { source: '13', target: '17', type: 'built_with' },
    { source: '14', target: '17', type: 'built_with' },
    { source: '12', target: '18', type: 'deployed_with' },
    { source: '1', target: '19', type: 'has' },
    { source: '1', target: '20', type: 'has' },
    { source: '19', target: '12', type: 'relates_to' },
    { source: '20', target: '12', type: 'relates_to' },
    { source: '12', target: '7', type: 'implements' },
  ];  useEffect(() => {
    if (!containerRef.current) return;

    // 清除之前的内容
    d3.select(containerRef.current).selectAll("*").remove();

    // 根据模式过滤数据
    let nodes = [...allNodes];
    let links = [...allLinks];

    if (mode === 'core') {
      nodes = nodes.filter(node => !node.isTemporary);
      links = links.filter(link => {
        const sourceNode = nodes.find(n => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
        const targetNode = nodes.find(n => n.id === (typeof link.target === 'string' ? link.target : link.target.id));
        return sourceNode && targetNode;
      });
    } else if (mode === 'temporary') {
      nodes = nodes.filter(node => node.isTemporary);
      links = links.filter(link => {
        const sourceNode = nodes.find(n => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
        const targetNode = nodes.find(n => n.id === (typeof link.target === 'string' ? link.target : link.target.id));
        return sourceNode && targetNode;
      });
    }

    if (!showTemporary && mode === 'mixed') {
      nodes = nodes.filter(node => !node.isTemporary);
      links = links.filter(link => {
        const sourceNode = nodes.find(n => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
        const targetNode = nodes.find(n => n.id === (typeof link.target === 'string' ? link.target : link.target.id));
        return sourceNode && targetNode;
      });
    }

    // 直接复制knowledge-graph-studio的实现
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;    const svgElement = d3
      .select(containerRef.current)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");

    const svg = svgElement
      .call(
        d3.zoom<SVGSVGElement, unknown>().on("zoom", function (event) {
          svg.attr("transform", event.transform);
        })
      )
      .append("g");

    // Initialize force simulation - 完全按照原版
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink(links).id((d: any) => d.id)
      )
      .force("charge", d3.forceManyBody().strength(-1000)) // 原版参数
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg
      .append("g")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)"); // Add arrowheads

    const node = svg
      .append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d: any) => d.value) // Node size based on "value"
      .attr("fill", (d: any) => d.color) // Node color based on "color"
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      )
      .on('click', (event, d) => {
        onNodeClick?.(d);
      });    const labels = svg
      .append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .join("text")
      .text((d: any) => d.name)
      .attr("x", (d: any) => d.x)
      .attr("y", (d: any) => d.y)
      .attr('font-family', 'Microsoft YaHei, SimHei, Arial, sans-serif')
      .attr('font-size', '12px')
      .attr('fill', '#333');

    // 箭头标记 - 原版
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#999")
      .attr("d", "M0,-5L10,0L0,5");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);

      labels.attr("x", (d: any) => d.x + 5).attr("y", (d: any) => d.y + 5);
    });    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

  }, [mode, showTemporary, onNodeClick]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full"
      style={{
        border: '1px solid #e0e0e0',
        backgroundColor: '#fff',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
        borderRadius: '1rem',
        overflow: 'hidden'
      }}
    />
  );
};

export default D3KnowledgeGraph;