'use client';

import React, { useEffect, useRef } from 'react';

interface Node {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'concept';
  isTemporary?: boolean;
  value: number;
  color: string;
}

interface Link {
  source: string;
  target: string;
  type: string;
}

interface KnowledgeGraphStudioProps {
  mode: 'core' | 'temporary' | 'mixed';
  showTemporary: boolean;
  onNodeClick?: (node: Node) => void;
}

const KnowledgeGraphStudio: React.FC<KnowledgeGraphStudioProps> = ({ 
  mode, 
  showTemporary, 
  onNodeClick 
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 节点颜色映射函数
  const getNodeColor = (type: string, isTemporary?: boolean) => {
    if (isTemporary) return '#fbbf24'; // 黄色
    switch (type) {
      case 'person': return '#3b82f6'; // 蓝色
      case 'organization': return '#10b981'; // 绿色
      case 'concept': return '#8b5cf6'; // 紫色
      default: return '#6b7280'; // 灰色
    }
  };  // 模拟数据
  const allNodes: Node[] = [
    { id: '1', name: 'SGA公司', type: 'organization', value: 25, color: getNodeColor('organization') },
    { id: '2', name: '研发部门', type: 'organization', value: 25, color: getNodeColor('organization') },
    { id: '3', name: '产品部门', type: 'organization', value: 25, color: getNodeColor('organization') },
    { id: '4', name: '张工程师', type: 'person', value: 25, color: getNodeColor('person') },
    { id: '5', name: '李产品经理', type: 'person', value: 25, color: getNodeColor('person') },
    { id: '6', name: '王架构师', type: 'person', value: 25, color: getNodeColor('person') },
    { id: '7', name: '人工智能', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '8', name: '机器学习', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '9', name: '深度学习', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '10', name: '知识图谱', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '11', name: '自然语言处理', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '12', name: 'SGA-CIP平台', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '13', name: 'FastAPI', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '14', name: 'React', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '15', name: 'MongoDB', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '16', name: 'Neo4j', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '17', name: 'Python', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '18', name: 'Docker', type: 'concept', value: 25, color: getNodeColor('concept') },
    { id: '19', name: '临时项目', type: 'concept', value: 25, color: getNodeColor('concept', true), isTemporary: true },
    { id: '20', name: '临时需求', type: 'concept', value: 25, color: getNodeColor('concept', true), isTemporary: true },
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
    // 根据模式过滤数据
    let nodes = [...allNodes];
    let links = [...allLinks];

    if (mode === 'core') {
      nodes = nodes.filter(node => !node.isTemporary);
      links = links.filter(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        return sourceNode && targetNode;
      });
    } else if (mode === 'temporary') {
      nodes = nodes.filter(node => node.isTemporary);
      links = links.filter(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        return sourceNode && targetNode;
      });
    }

    if (!showTemporary && mode === 'mixed') {
      nodes = nodes.filter(node => !node.isTemporary);
      links = links.filter(link => {
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);
        return sourceNode && targetNode;
      });
    }    // 创建HTML内容，直接使用knowledge-graph-studio的模板
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knowledge Graph</title>
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #f4f4f4;
      }

      #graph {
        width: 100vw;
        height: 100vh;
        border: 1px solid #e0e0e0;
        background-color: #fff;
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        padding: 20px;
        overflow: hidden;
        border-radius: 1rem;
      }

      svg {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>

  <body>
    <div id="graph">
      <script src="https://d3js.org/d3.v6.min.js"></script>
      <script>
        const width = document.getElementById("graph").clientWidth;
        const height = document.getElementById("graph").clientHeight;        const svg = d3
          .select("#graph")
          .append("svg")
          .attr("width", "100%")
          .attr("height", "100%")
          .call(
            d3.zoom().on("zoom", function (event) {
              svg.attr("transform", event.transform);
            })
          )
          .append("g");

        const nodes = ${JSON.stringify(nodes)};
        const links = ${JSON.stringify(links)};

        const simulation = d3
          .forceSimulation(nodes)
          .force(
            "link",
            d3.forceLink(links).id((d) => d.id)
          )
          .force("charge", d3.forceManyBody().strength(-1000))
          .force("center", d3.forceCenter(width / 2, height / 2));

        const link = svg
          .append("g")
          .attr("stroke", "#999")
          .attr("stroke-opacity", 0.6)
          .selectAll("line")
          .data(links)
          .join("line")
          .attr("stroke-width", 2)
          .attr("marker-end", "url(#arrow)");

        const node = svg
          .append("g")
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .selectAll("circle")
          .data(nodes)
          .join("circle")
          .attr("r", (d) => d.value)
          .attr("fill", (d) => d.color)
          .call(
            d3
              .drag()
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended)
          )
          .on('click', (event, d) => {
            window.parent.postMessage({
              type: 'nodeClick',
              node: d
            }, '*');
          });        const labels = svg
          .append("g")
          .attr("class", "labels")
          .selectAll("text")
          .data(nodes)
          .join("text")
          .text((d) => d.name.length > 6 ? d.name.substring(0, 5) + '...' : d.name)
          .attr("x", (d) => d.x)
          .attr("y", (d) => d.y)
          .attr('font-family', 'Microsoft YaHei, SimHei, Arial, sans-serif')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .attr('fill', (d) => {
            const darkColors = ['#3b82f6', '#8b5cf6'];
            return darkColors.includes(d.color) ? '#ffffff' : '#333333';
          })
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .style('pointer-events', 'none');

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
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);

          node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

          labels.attr("x", (d) => d.x).attr("y", (d) => d.y);
        });        function dragstarted(event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }

        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }

        function dragended(event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
      </script>
    </div>
  </body>
</html>
    `;

    // 将HTML内容写入iframe
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      iframe.srcdoc = htmlContent;
    }

  }, [mode, showTemporary]);

  // 监听来自iframe的消息
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'nodeClick') {
        onNodeClick?.(event.data.node);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNodeClick]);

  return (
    <div className="w-full h-full">
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        title="Knowledge Graph Studio"
      />
    </div>
  );
};

export default KnowledgeGraphStudio;