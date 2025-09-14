-- 更新知识图谱的知识库ID
-- 将知识库ID更新为正确的RAGFlow知识库ID

UPDATE knowledge_graphs 
SET kb_id = 'dc949110906a11f08b78aa7cd3e67281'
WHERE name = '国贸制度知识库' 
  AND is_active = true;

-- 查看更新结果
SELECT id, name, kb_id, ragflow_url, is_active 
FROM knowledge_graphs 
WHERE is_active = true;
