好的！看来Docker构建的方式比较复杂，让我直接为您提供RAGFlow知识图谱API的使用指南。

## 📚 RAGFlow知识图谱API使用指南

### 🔑 API认证

首先需要获取API密钥：

1. 登录RAGFlow界面：http://localhost:9380
2. 进入设置页面获取API Key
3. 在请求头中添加认证：`Authorization: Bearer <YOUR_API_KEY>`

### 🌐 主要API接口

#### 1. **获取知识图谱数据**
```bash
# 获取完整的知识图谱
curl -X GET "http://localhost:9380/api/v1/graphrag/kb/{kb_id}/graph" \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -H "Content-Type: application/json"
```

**响应示例：**
```json
{
  "retcode": 0,
  "retmsg": "success",
  "data": {
    "graph": {
      "nodes": [
        {
          "id": "node_123",
          "entity_type": "PERSON",
          "description": "人工智能专家",
          "pagerank": 0.85,
          "communities": ["tech", "ai"]
        }
      ],
      "edges": [
        {
          "source": "node_123",
          "target": "node_456",
          "relation": "works_with",
          "weight": 0.7
        }
      ]
    },
    "kb_info": {
      "id": "kb_123",
      "name": "知识库名称"
    }
  }
}
```

#### 2. **搜索节点**
```bash
# 搜索知识图谱中的节点
curl -X POST "http://localhost:9380/api/v1/graphrag/kb/{kb_id}/search" \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "人工智能",
    "entity_types": ["PERSON", "ORGANIZATION", "CONCEPT"],
    "page": 1,
    "page_size": 20
  }'
```

**响应示例：**
```json
{
  "retcode": 0,
  "retmsg": "success",
  "data": {
    "nodes": [
      {
        "id": "node_123",
        "entity_type": "CONCEPT",
        "description": "人工智能是计算机科学的一个分支",
        "pagerank": 0.92,
        "communities": ["technology", "science"]
      }
    ],
    "total_count": 45,
    "page": 1,
    "page_size": 20,
    "has_more": true
  }
}
```

#### 3. **获取节点关联文件**
```bash
# 获取节点的关联文件列表
curl -X GET "http://localhost:9380/api/v1/graphrag/kb/{kb_id}/nodes/{node_id}/files" \
  -H "Authorization: Bearer <YOUR_API_KEY>"
```

**响应示例：**
```json
{
  "retcode": 0,
  "retmsg": "success",
  "data": {
    "files": [
      {
        "file_id": "file_123",
        "file_name": "AI研究报告.pdf",
        "file_type": "pdf",
        "chunk_count": 15,
        "relevance_score": 0.89
      }
    ],
    "total_files": 3
  }
}
```

#### 4. **下载节点内容**
```bash
# 下载节点内容（支持多种格式）
curl -X GET "http://localhost:9380/api/v1/graphrag/kb/{kb_id}/nodes/{node_id}/download?format=json" \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -o "node_content.json"

# 支持的格式：txt, json, csv, xlsx
```

#### 5. **获取图谱统计信息**
```bash
# 获取知识图谱统计数据
curl -X GET "http://localhost:9380/api/v1/graphrag/kb/{kb_id}/statistics" \
  -H "Authorization: Bearer <YOUR_API_KEY>"
```

**响应示例：**
```json
{
  "retcode": 0,
  "retmsg": "success",
  "data": {
    "statistics": {
      "total_nodes": 1250,
      "total_edges": 3400,
      "entity_types": {
        "PERSON": 320,
        "ORGANIZATION": 180,
        "CONCEPT": 750
      },
      "avg_degree": 2.72,
      "density": 0.0043
    }
  }
}
```

### 🐍 Python SDK使用示例

#### 安装SDK
```bash
pip install ragflow-sdk
```

#### 基本使用
```python
import asyncio
from ragflow_sdk import RAGFlow

async def main():
    # 初始化客户端
    rag = RAGFlow(
        api_key="your-api-key",
        base_url="http://localhost:9380"
    )
    
    # 获取知识库列表
    datasets = rag.list_datasets()
    kb_id = datasets[0].id
    
    # 1. 获取完整知识图谱
    print("=== 获取知识图谱 ===")
    response = await rag.get(f"/api/v1/graphrag/kb/{kb_id}/graph")
    graph_data = response.json()
    print(f"节点数量: {len(graph_data['data']['graph']['nodes'])}")
    print(f"边数量: {len(graph_data['data']['graph']['edges'])}")
    
    # 2. 搜索节点
    print("\n=== 搜索节点 ===")
    search_payload = {
        "query": "人工智能",
        "entity_types": ["CONCEPT", "PERSON"],
        "page": 1,
        "page_size": 10
    }
    response = await rag.post(f"/api/v1/graphrag/kb/{kb_id}/search", json=search_payload)
    search_results = response.json()
    
    for node in search_results['data']['nodes']:
        print(f"节点ID: {node['id']}")
        print(f"类型: {node['entity_type']}")
        print(f"描述: {node['description'][:100]}...")
        print(f"重要性: {node.get('pagerank', 'N/A')}")
        print("---")
    
    # 3. 获取节点关联文件
    if search_results['data']['nodes']:
        node_id = search_results['data']['nodes'][0]['id']
        print(f"\n=== 节点 {node_id} 的关联文件 ===")
        response = await rag.get(f"/api/v1/graphrag/kb/{kb_id}/nodes/{node_id}/files")
        files_data = response.json()
        
        for file_info in files_data['data']['files']:
            print(f"文件: {file_info['file_name']}")
            print(f"类型: {file_info['file_type']}")
            print(f"相关性: {file_info['relevance_score']}")
            print("---")
    
    # 4. 获取统计信息
    print("\n=== 图谱统计信息 ===")
    response = await rag.get(f"/api/v1/graphrag/kb/{kb_id}/statistics")
    stats = response.json()
    
    statistics = stats['data']['statistics']
    print(f"总节点数: {statistics['total_nodes']}")
    print(f"总边数: {statistics['total_edges']}")
    print(f"平均度: {statistics['avg_degree']}")
    print(f"图密度: {statistics['density']}")
    
    print("\n实体类型分布:")
    for entity_type, count in statistics['entity_types'].items():
        print(f"  {entity_type}: {count}")

# 运行示例
if __name__ == "__main__":
    asyncio.run(main())
```

### 🔧 高级用法示例

#### 1. **批量搜索和过滤**
```python
async def advanced_search(rag, kb_id):
    """高级搜索示例"""
    
    # 搜索特定类型的实体
    entity_types = ["PERSON", "ORGANIZATION", "CONCEPT"]
    
    for entity_type in entity_types:
        search_payload = {
            "query": "",  # 空查询获取所有该类型实体
            "entity_types": [entity_type],
            "page": 1,
            "page_size": 50
        }
        
        response = await rag.post(f"/api/v1/graphrag/kb/{kb_id}/search", json=search_payload)
        results = response.json()
        
        print(f"\n{entity_type} 类型实体 (共{results['data']['total_count']}个):")
        
        # 按重要性排序
        nodes = sorted(
            results['data']['nodes'], 
            key=lambda x: x.get('pagerank', 0), 
            reverse=True
        )
        
        for node in nodes[:5]:  # 显示前5个最重要的
            print(f"  {node['id']}: {node['description'][:50]}... (重要性: {node.get('pagerank', 'N/A')})")
```

#### 2. **图谱数据分析**
```python
async def analyze_graph(rag, kb_id):
    """图谱数据分析"""
    
    # 获取完整图谱
    response = await rag.get(f"/api/v1/graphrag/kb/{kb_id}/graph")
    graph_data = response.json()
    
    nodes = graph_data['data']['graph']['nodes']
    edges = graph_data['data']['graph']['edges']
    
    # 分析节点度分布
    degree_count = {}
    for edge in edges:
        source = edge['source']
        target = edge['target']
        degree_count[source] = degree_count.get(source, 0) + 1
        degree_count[target] = degree_count.get(target, 0) + 1
    
    # 找出连接度最高的节点
    top_nodes = sorted(degree_count.items(), key=lambda x: x[1], reverse=True)[:10]
    
    print("连接度最高的10个节点:")
    for node_id, degree in top_nodes:
        # 找到节点详细信息
        node_info = next((n for n in nodes if n['id'] == node_id), None)
        if node_info:
            print(f"  {node_id}: {node_info['description'][:50]}... (度: {degree})")
```

#### 3. **内容下载和导出**
```python
async def export_node_content(rag, kb_id, node_id, format="json"):
    """导出节点内容"""
    
    # 下载节点内容
    response = await rag.get(f"/api/v1/graphrag/kb/{kb_id}/nodes/{node_id}/download?format={format}")
    
    if format == "json":
        content = response.json()
        # 保存到文件
        import json
        with open(f"node_{node_id}.json", "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
    else:
        # 其他格式直接保存二进制内容
        with open(f"node_{node_id}.{format}", "wb") as f:
            f.write(response.content)
    
    print(f"节点 {node_id} 内容已导出为 {format} 格式")
```

### 🚀 实际应用场景

#### 1. **知识发现**
```python
async def knowledge_discovery(rag, kb_id, topic):
    """基于主题的知识发现"""
    
    # 搜索相关节点
    search_payload = {
        "query": topic,
        "entity_types": ["CONCEPT", "PERSON", "ORGANIZATION"],
        "page": 1,
        "page_size": 20
    }
    
    response = await rag.post(f"/api/v1/graphrag/kb/{kb_id}/search", json=search_payload)
    results = response.json()
    
    print(f"关于 '{topic}' 的知识发现:")
    
    for node in results['data']['nodes']:
        print(f"\n节点: {node['id']}")
        print(f"类型: {node['entity_type']}")
        print(f"描述: {node['description']}")
        
        # 获取关联文件
        files_response = await rag.get(f"/api/v1/graphrag/kb/{kb_id}/nodes/{node['id']}/files")
        files_data = files_response.json()
        
        if files_data['data']['files']:
            print("相关文档:")
            for file_info in files_data['data']['files'][:3]:  # 显示前3个文件
                print(f"  - {file_info['file_name']} (相关性: {file_info['relevance_score']})")
```

#### 2. **关系分析**
```python
async def relationship_analysis(rag, kb_id):
    """关系分析"""
    
    # 获取图谱数据
    response = await rag.get(f"/api/v1/graphrag/kb/{kb_id}/graph")
    graph_data = response.json()
    
    edges = graph_data['data']['graph']['edges']
    
    # 分析关系类型
    relation_types = {}
    for edge in edges:
        relation = edge.get('relation', 'unknown')
        relation_types[relation] = relation_types.get(relation, 0) + 1
    
    print("关系类型分布:")
    for relation, count in sorted(relation_types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {relation}: {count}")
```

这样您就可以通过API完全控制和使用RAGFlow的知识图谱功能了！所有的图谱数据、搜索、文件关联等功能都可以通过API访问。
