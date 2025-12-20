#!/bin/bash

# RAGFlow API 测试脚本
# 用于测试RAGFlow API的连接和功能

set -e

echo "🧪 RAGFlow API 测试脚本"
echo "========================"
echo ""

# 配置参数（请根据实际情况修改）
RAGFLOW_URL="${RAGFLOW_URL:-http://localhost:9380}"
RAGFLOW_API_KEY="${RAGFLOW_API_KEY:-}"
RAGFLOW_KB_ID="${RAGFLOW_KB_ID:-}"

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$RAGFLOW_API_KEY" ]; then
    echo -e "${RED}❌ 错误: 请设置 RAGFLOW_API_KEY 环境变量${NC}"
    echo "示例: export RAGFLOW_API_KEY='ragflow-xxx...'"
    exit 1
fi

echo "📍 RAGFlow URL: $RAGFLOW_URL"
echo "🔑 API Key: ${RAGFLOW_API_KEY:0:20}..."
echo ""

# 测试1: 检查RAGFlow服务状态
echo "测试1: 检查RAGFlow服务状态"
echo "----------------------------"
if curl -s -f "$RAGFLOW_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ RAGFlow服务正常运行${NC}"
else
    echo -e "${YELLOW}⚠️  无法访问健康检查端点，尝试其他方式...${NC}"
fi
echo ""

# 测试2: 获取数据集列表
echo "测试2: 获取知识库列表"
echo "----------------------------"
DATASETS_RESPONSE=$(curl -s -X GET "$RAGFLOW_URL/api/v1/datasets" \
  -H "Authorization: Bearer $RAGFLOW_API_KEY" \
  -H "Content-Type: application/json")

echo "响应: $DATASETS_RESPONSE" | jq '.' 2>/dev/null || echo "$DATASETS_RESPONSE"

# 提取第一个知识库ID（如果未指定）
if [ -z "$RAGFLOW_KB_ID" ]; then
    RAGFLOW_KB_ID=$(echo "$DATASETS_RESPONSE" | jq -r '.data[0].id' 2>/dev/null)
    if [ "$RAGFLOW_KB_ID" != "null" ] && [ -n "$RAGFLOW_KB_ID" ]; then
        echo -e "${GREEN}✅ 自动获取知识库ID: $RAGFLOW_KB_ID${NC}"
    else
        echo -e "${RED}❌ 无法获取知识库ID，请手动指定${NC}"
        exit 1
    fi
fi
echo ""

# 测试3: 获取知识图谱数据（新版API）
echo "测试3: 获取知识图谱数据（新版API）"
echo "----------------------------"
GRAPH_URL="$RAGFLOW_URL/api/v1/datasets/$RAGFLOW_KB_ID/knowledge_graph"
echo "请求URL: $GRAPH_URL"

GRAPH_RESPONSE=$(curl -s -X GET "$GRAPH_URL" \
  -H "Authorization: Bearer $RAGFLOW_API_KEY" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$GRAPH_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
GRAPH_DATA=$(echo "$GRAPH_RESPONSE" | sed '/HTTP_CODE/d')

echo "HTTP状态码: $HTTP_CODE"
echo "响应数据:"
echo "$GRAPH_DATA" | jq '.' 2>/dev/null || echo "$GRAPH_DATA"

if [ "$HTTP_CODE" = "200" ]; then
    NODE_COUNT=$(echo "$GRAPH_DATA" | jq '.data.graph.nodes | length' 2>/dev/null || echo "0")
    EDGE_COUNT=$(echo "$GRAPH_DATA" | jq '.data.graph.edges | length' 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ 成功获取知识图谱！节点数: $NODE_COUNT, 边数: $EDGE_COUNT${NC}"
else
    echo -e "${YELLOW}⚠️  新版API不可用，尝试旧版API...${NC}"
    
    # 测试旧版API
    OLD_GRAPH_URL="$RAGFLOW_URL/api/v1/graphrag/kb/$RAGFLOW_KB_ID/graph"
    echo "请求URL: $OLD_GRAPH_URL"
    
    OLD_GRAPH_RESPONSE=$(curl -s -X GET "$OLD_GRAPH_URL" \
      -H "Authorization: Bearer $RAGFLOW_API_KEY" \
      -H "Content-Type: application/json")
    
    echo "响应数据:"
    echo "$OLD_GRAPH_RESPONSE" | jq '.' 2>/dev/null || echo "$OLD_GRAPH_RESPONSE"
fi
echo ""

# 测试4: 获取统计信息
echo "测试4: 获取知识图谱统计信息"
echo "----------------------------"
STATS_URL="$RAGFLOW_URL/api/v1/graphrag/kb/$RAGFLOW_KB_ID/statistics"
echo "请求URL: $STATS_URL"

STATS_RESPONSE=$(curl -s -X GET "$STATS_URL" \
  -H "Authorization: Bearer $RAGFLOW_API_KEY" \
  -H "Content-Type: application/json")

echo "响应数据:"
echo "$STATS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATS_RESPONSE"
echo ""

# 测试5: 测试对话接口（Dialog模式）
echo "测试5: 测试对话接口（Dialog模式）"
echo "----------------------------"
echo "⚠️  此测试需要JWT Token和Dialog ID，跳过..."
echo ""

# 总结
echo "========================"
echo "🎉 测试完成！"
echo "========================"
echo ""
echo "📊 测试结果总结:"
echo "1. RAGFlow服务: 已检查"
echo "2. 知识库列表: 已获取"
echo "3. 知识图谱数据: 已测试"
echo "4. 统计信息: 已测试"
echo ""
echo "💡 下一步建议:"
echo "1. 如果新版API不可用，考虑升级RAGFlow到v0.22.1"
echo "2. 检查知识库是否已启用GraphRAG功能"
echo "3. 在前端界面测试完整的知识图谱可视化"

