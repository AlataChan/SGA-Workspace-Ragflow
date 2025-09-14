# RAGFlow 知识图谱 API 使用指南

## 📚 概述

RAGFlow 提供了完整的知识图谱 API 接口，支持图谱数据获取、节点搜索、文件关联和内容下载等功能。

## 🔑 API 认证

### 获取 API 密钥
1. 登录 RAGFlow 界面：http://localhost:9380
2. 进入设置页面获取 API Key
3. 在请求头中添加认证：`Authorization: Bearer <YOUR_API_KEY>`

### 示例 API 密钥
```
ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW
```

## 📋 数据集管理

### 1. 列出所有数据集
```bash
curl -X GET "http://localhost:9380/api/v1/datasets" \
  -H "Authorization: Bearer ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW"
```

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": "dc949110906a11f08b78aa7cd3e67281",
      "name": "国贸制度知识库",
      "document_count": 31,
      "chunk_count": 566,
      "parser_config": {
        "graphrag": {
          "use_graphrag": true,
          "method": "light",
          "entity_types": ["organization", "person", "geo", "event", "category"]
        }
      }
    }
  ]
}
```

## 🕸️ 知识图谱 API

### 2. 获取完整知识图谱
```bash
curl -X GET "http://localhost:9380/api/v1/datasets/{kb_id}/knowledge_graph" \
  -H "Authorization: Bearer ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW"
```

**实际示例：**
```bash
curl -X GET "http://localhost:9380/api/v1/datasets/dc949110906a11f08b78aa7cd3e67281/knowledge_graph" \
  -H "Authorization: Bearer ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW"
```

**响应结构：**
```json
{
  "code": 0,
  "data": {
    "graph": {
      "directed": false,
      "nodes": [
        {
          "entity_name": "财务部",
          "entity_type": "ORGANIZATION",
          "id": "财务部",
          "pagerank": 0.025,
          "description": "负责财务审核和管理的部门"
        }
      ],
      "edges": [
        {
          "source": "财务部",
          "target": "黄向华",
          "description": "黄向华是财务部的审核员",
          "weight": 39.0
        }
      ]
    }
  }
}
```

## 🔍 实体类型分析

### 主要实体类型

#### 👥 人员 (PERSON)
- **黄向华**: 财务部审核员，提供初步审批
- **孙春臣**: 文档起草人，负责安全管理规定提交
- **纪凌麒**: 总办最终审批人
- **周武杨**: 财务部成员，参与文档审批流程

#### 🏢 组织 (ORGANIZATION)
- **厦门国贸股份有限公司**: 主体公司
- **财务部**: 负责财务审核和管理
- **法律事务部**: 负责法律相关费用审批
- **总裁办公室**: 最终审批机构

#### 📋 类别 (CATEGORY)
- **出差借款**: 需要财务经理审批的费用类型
- **诉讼费**: 需要法律事务部额外审批
- **备用金**: 需要区域总经理审批
- **业务活动费**: 需要联合审批的费用

#### 🌍 地理位置 (GEO)
- **厦门**: 公司总部所在地

## 🔗 关系分析

### 审批流程关系
1. **起草阶段**: 孙春臣 → 文档起草
2. **初审阶段**: 财务部(黄向华) → 初步审批
3. **终审阶段**: 总办(纪凌麒) → 最终审批

### 部门协作关系
- 财务部 ↔ 区域公司总经理：联合审批某些费用
- 法律事务部 ↔ 诉讼费：专项审批权限
- 总裁办公室 ↔ 各部门：最终审批权威

## 🚀 实际应用示例

### 1. 搜索财务相关实体
```bash
curl -X POST "http://localhost:9380/api/v1/datasets/dc949110906a11f08b78aa7cd3e67281/search" \
  -H "Authorization: Bearer ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "财务",
    "entity_types": ["PERSON", "ORGANIZATION"],
    "page": 1,
    "page_size": 10
  }'
```

### 2. 获取节点关联文件
```bash
curl -X GET "http://localhost:9380/api/v1/datasets/dc949110906a11f08b78aa7cd3e67281/nodes/财务部/files" \
  -H "Authorization: Bearer ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW"
```

### 3. 下载节点内容
```bash
curl -X GET "http://localhost:9380/api/v1/datasets/dc949110906a11f08b78aa7cd3e67281/nodes/财务部/download?format=json" \
  -H "Authorization: Bearer ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU7NW" \
  -o "财务部_content.json"
```

## 💡 业务应用场景

### 1. 合规检查系统
- 查询特定审批流程和责任人
- 验证费用审批是否符合规定
- 追踪文档审批路径

### 2. 组织架构分析
- 分析部门间协作关系
- 识别关键决策节点
- 优化审批流程

### 3. 风险管理
- 识别单点故障风险
- 分析权限集中度
- 监控异常审批模式

### 4. 智能问答
- "谁负责出差借款审批？" → 财务经理
- "诉讼费需要哪些部门审批？" → 法律事务部 + 财务部
- "厦门国贸的组织架构是什么？" → 返回相关组织关系图

## 🛠️ Python SDK 示例

```python
import requests
import json

class RAGFlowKnowledgeGraph:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {api_key}"}
    
    def get_datasets(self):
        """获取所有数据集"""
        response = requests.get(f"{self.base_url}/api/v1/datasets", headers=self.headers)
        return response.json()
    
    def get_knowledge_graph(self, kb_id):
        """获取知识图谱"""
        response = requests.get(
            f"{self.base_url}/api/v1/datasets/{kb_id}/knowledge_graph", 
            headers=self.headers
        )
        return response.json()
    
    def search_entities(self, kb_id, query, entity_types=None):
        """搜索实体"""
        data = {
            "query": query,
            "entity_types": entity_types or [],
            "page": 1,
            "page_size": 20
        }
        response = requests.post(
            f"{self.base_url}/api/v1/datasets/{kb_id}/search",
            headers=self.headers,
            json=data
        )
        return response.json()

# 使用示例
kg = RAGFlowKnowledgeGraph("http://localhost:9380", "ragflow-BlMGQyNzM0OTBhNzExZjA4MzU4ZGU3NW")

# 获取数据集
datasets = kg.get_datasets()
kb_id = datasets['data'][0]['id']

# 获取知识图谱
graph = kg.get_knowledge_graph(kb_id)

# 搜索财务相关实体
results = kg.search_entities(kb_id, "财务", ["PERSON", "ORGANIZATION"])
```

## 📊 图谱数据统计

**当前知识库统计**:
- 节点数量: 200+ 个实体
- 边数量: 100+ 条关系
- 文档数量: 31 个
- 分块数量: 566 个

**实体分布**:
- 人员 (PERSON): ~30%
- 组织 (ORGANIZATION): ~25%
- 类别 (CATEGORY): ~35%
- 地理位置 (GEO): ~5%
- 事件 (EVENT): ~5%

## 🔧 配置说明

### 网络配置
如果使用 frp 内网穿透，请确保配置正确：
```toml
# frpc.toml
localIP = "host.docker.internal"
localPort = 9380
```

### API 端点
- 基础URL: `http://localhost:9380`
- 数据集API: `/api/v1/datasets`
- 知识图谱API: `/api/v1/datasets/{kb_id}/knowledge_graph`

## ⚠️ 注意事项

1. **API 密钥安全**: 请妥善保管 API 密钥，避免泄露
2. **请求频率**: 建议控制请求频率，避免过载
3. **数据更新**: 知识图谱数据会随文档更新而变化
4. **权限控制**: 确保只有授权用户可以访问敏感数据

## 🔄 高级用法

### 批量数据分析
```python
def analyze_approval_workflow(kg, kb_id):
    """分析审批工作流程"""

    # 获取完整图谱
    graph = kg.get_knowledge_graph(kb_id)
    nodes = graph['data']['graph']['nodes']
    edges = graph['data']['graph']['edges']

    # 分析审批链路
    approval_chain = {}
    for edge in edges:
        if "审批" in edge.get('description', ''):
            source = edge['source']
            target = edge['target']
            approval_chain[source] = approval_chain.get(source, [])
            approval_chain[source].append(target)

    return approval_chain

def find_key_personnel(kg, kb_id):
    """识别关键人员"""

    # 搜索所有人员
    results = kg.search_entities(kb_id, "", ["PERSON"])

    # 按重要性排序
    personnel = sorted(
        results['data']['nodes'],
        key=lambda x: x.get('pagerank', 0),
        reverse=True
    )

    return personnel[:10]  # 返回前10个重要人员
```

### 实时监控示例
```python
import time
import schedule

def monitor_graph_changes(kg, kb_id):
    """监控图谱变化"""

    def check_updates():
        try:
            graph = kg.get_knowledge_graph(kb_id)
            node_count = len(graph['data']['graph']['nodes'])
            edge_count = len(graph['data']['graph']['edges'])

            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] "
                  f"节点: {node_count}, 边: {edge_count}")

        except Exception as e:
            print(f"监控出错: {e}")

    # 每小时检查一次
    schedule.every().hour.do(check_updates)

    while True:
        schedule.run_pending()
        time.sleep(60)
```

## 🎯 最佳实践

### 1. 性能优化
- 使用分页查询大量数据
- 缓存频繁访问的图谱数据
- 批量处理多个请求

### 2. 错误处理
```python
def safe_api_call(func, *args, **kwargs):
    """安全的API调用包装器"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(2 ** attempt)  # 指数退避
```

### 3. 数据验证
```python
def validate_graph_data(graph_data):
    """验证图谱数据完整性"""
    required_fields = ['nodes', 'edges']

    if not all(field in graph_data['data']['graph'] for field in required_fields):
        raise ValueError("图谱数据格式不完整")

    # 验证节点和边的引用一致性
    node_ids = {node['id'] for node in graph_data['data']['graph']['nodes']}

    for edge in graph_data['data']['graph']['edges']:
        if edge['source'] not in node_ids or edge['target'] not in node_ids:
            print(f"警告: 边引用了不存在的节点 {edge['source']} -> {edge['target']}")
```

## 📈 数据可视化

### 使用 NetworkX 和 Matplotlib
```python
import networkx as nx
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm

def visualize_knowledge_graph(graph_data, output_file="knowledge_graph.png"):
    """可视化知识图谱"""

    # 设置中文字体
    plt.rcParams['font.sans-serif'] = ['SimHei']
    plt.rcParams['axes.unicode_minus'] = False

    # 创建图
    G = nx.Graph()

    # 添加节点
    for node in graph_data['data']['graph']['nodes']:
        G.add_node(
            node['id'],
            entity_type=node['entity_type'],
            pagerank=node.get('pagerank', 0)
        )

    # 添加边
    for edge in graph_data['data']['graph']['edges']:
        G.add_edge(
            edge['source'],
            edge['target'],
            weight=edge.get('weight', 1)
        )

    # 布局
    pos = nx.spring_layout(G, k=1, iterations=50)

    # 绘制
    plt.figure(figsize=(15, 10))

    # 按实体类型着色
    color_map = {
        'PERSON': 'lightblue',
        'ORGANIZATION': 'lightgreen',
        'CATEGORY': 'lightyellow',
        'GEO': 'lightcoral',
        'EVENT': 'lightpink'
    }

    node_colors = [color_map.get(G.nodes[node].get('entity_type', ''), 'gray')
                   for node in G.nodes()]

    # 绘制网络
    nx.draw(G, pos,
            node_color=node_colors,
            node_size=300,
            font_size=8,
            font_weight='bold',
            with_labels=True,
            edge_color='gray',
            alpha=0.7)

    plt.title("RAGFlow 知识图谱可视化", fontsize=16)
    plt.tight_layout()
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.show()
```

## 📞 技术支持

### 常见问题

**Q: API 返回 404 错误？**
A: 检查数据集ID是否正确，确认知识图谱功能已启用

**Q: 图谱数据为空？**
A: 确认文档已完成解析，知识图谱构建需要时间

**Q: 中文显示乱码？**
A: 确保请求头包含正确的编码：`Content-Type: application/json; charset=utf-8`

### 故障排查步骤
1. 检查 RAGFlow 服务状态：`docker-compose ps`
2. 验证 API 密钥有效性
3. 确认网络连接正常
4. 检查请求格式和参数
5. 查看服务日志：`docker logs ragflow-server`

### 联系方式
- 项目地址: https://github.com/infiniflow/ragflow
- 文档地址: https://ragflow.io/docs
- 社区支持: https://github.com/infiniflow/ragflow/discussions
