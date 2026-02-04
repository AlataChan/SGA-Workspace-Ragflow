-- 🗄️ SGA 企业AI工作空间 - PostgreSQL 数据库 Schema
-- 与 Prisma Schema 完全同步
-- 生成时间: 2024-12-24

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ===========================================
-- 枚举类型定义
-- ===========================================

-- 用户角色枚举
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- Agent 平台枚举
CREATE TYPE "AgentPlatform" AS ENUM ('DIFY', 'RAGFLOW', 'HIAGENT', 'OPENAI', 'CLAUDE', 'CUSTOM');

-- 消息角色枚举
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- 临时知识库状态枚举
CREATE TYPE "TempKbStatus" AS ENUM ('ACTIVE', 'BUILDING', 'EXPIRED', 'PERSISTENT');

-- ===========================================
-- 核心业务表
-- ===========================================

-- 企业表
CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 部门表
CREATE TABLE departments (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    parent_id TEXT,
    description TEXT,
    icon VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    parent_sids TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    chinese_name VARCHAR(100) NOT NULL,
    english_name VARCHAR(100),
    email VARCHAR(255),
    display_name VARCHAR(255),
    avatar_url VARCHAR(500),
    department_id TEXT REFERENCES departments(id),
    position VARCHAR(100),
    role "UserRole" NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- SSO 相关字段
    yunzhijia_user_id VARCHAR(100) UNIQUE,
    sso_provider VARCHAR(100),
    sso_access_token TEXT,
    sso_refresh_token TEXT,
    sso_token_expires_at TIMESTAMPTZ,
    
    -- 唯一约束
    CONSTRAINT "unique_username" UNIQUE (company_id, username),
    CONSTRAINT "unique_user_id" UNIQUE (company_id, user_id),
    CONSTRAINT "unique_phone" UNIQUE (company_id, phone)
);

-- Agent 智能体表
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    chinese_name VARCHAR(100) NOT NULL,
    english_name VARCHAR(100),
    position VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(500),
    photo_url VARCHAR(500),
    platform "AgentPlatform" NOT NULL DEFAULT 'DIFY',
    platform_config JSONB,
    dify_url VARCHAR(500),
    dify_key VARCHAR(500),
    is_online BOOLEAN NOT NULL DEFAULT false,
    connection_tested_at TIMESTAMPTZ,
    last_error TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 用户 Agent 权限表
CREATE TABLE user_agent_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    granted_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT "unique_user_agent" UNIQUE (user_id, agent_id)
);

-- 用户 Agent 权限撤销表（用于审计/临时禁用等场景）
CREATE TABLE user_agent_permission_revocations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,

    revoked_by TEXT NOT NULL,
    revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT,

    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,

    CONSTRAINT "unique_user_agent_revocation" UNIQUE (user_id, agent_id)
);

-- Agent 按部门授权表（支持授权部门及其子部门）
CREATE TABLE agent_department_grants (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    department_id TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    include_sub_departments BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,

    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "unique_agent_department_grant" UNIQUE (agent_id, department_id)
);

-- ===========================================
-- 知识图谱系统表
-- ===========================================

-- 知识图谱表 (RAGFlow 集成)
CREATE TABLE knowledge_graphs (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    ragflow_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    kb_id VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    node_count INTEGER NOT NULL DEFAULT 0,
    edge_count INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT "companyId_name_kg" UNIQUE (company_id, name)
);

-- 用户知识图谱权限表
CREATE TABLE user_knowledge_graph_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    knowledge_graph_id TEXT NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
    granted_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT "userId_knowledgeGraphId" UNIQUE (user_id, knowledge_graph_id)
);

-- ===========================================
-- 临时知识库（用户侧）表
-- ===========================================

-- 用户临时知识库（RAGFlow dataset + 虚拟文档）
CREATE TABLE user_temp_knowledge_bases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    ragflow_kb_id VARCHAR(255) NOT NULL,
    ragflow_doc_id VARCHAR(255),
    ragflow_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    session_id TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    node_count INTEGER NOT NULL DEFAULT 0,
    edge_count INTEGER NOT NULL DEFAULT 0,
    status "TempKbStatus" NOT NULL DEFAULT 'ACTIVE',
    is_persistent BOOLEAN NOT NULL DEFAULT false,
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 用户保存的知识片段
CREATE TABLE user_saved_chunks (
    id TEXT PRIMARY KEY,
    temp_kb_id TEXT NOT NULL REFERENCES user_temp_knowledge_bases(id) ON DELETE CASCADE,
    ragflow_chunk_id VARCHAR(255),
    content TEXT NOT NULL,
    content_summary TEXT,
    keywords TEXT[] NOT NULL,
    source_message_id TEXT,
    source_type VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- 聊天系统表
-- ===========================================

-- 聊天会话表
CREATE TABLE chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    session_name VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 聊天消息表
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role "MessageRole" NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- 文件管理表
-- ===========================================

-- 上传文件表
CREATE TABLE uploaded_files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- 索引优化
-- ===========================================

-- 公司相关索引
CREATE INDEX idx_departments_company_id ON departments(company_id);
CREATE INDEX idx_department_company_parent ON departments(company_id, parent_id);

-- 用户相关索引
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_yunzhijia_user_id ON users(yunzhijia_user_id);

-- Agent 相关索引
CREATE INDEX idx_agents_company_id ON agents(company_id);
CREATE INDEX idx_agents_department_id ON agents(department_id);

-- 权限相关索引
CREATE INDEX idx_user_agent_permissions_user_id ON user_agent_permissions(user_id);
CREATE INDEX idx_user_agent_permissions_agent_id ON user_agent_permissions(agent_id);
CREATE INDEX idx_user_agent_revocation_agent_active ON user_agent_permission_revocations(agent_id, is_active);
CREATE INDEX idx_agent_department_grant_company_agent ON agent_department_grants(company_id, agent_id);
CREATE INDEX idx_agent_department_grant_company_department ON agent_department_grants(company_id, department_id);
CREATE INDEX idx_user_kg_permissions_user_id ON user_knowledge_graph_permissions(user_id);
CREATE INDEX idx_user_kg_permissions_kg_id ON user_knowledge_graph_permissions(knowledge_graph_id);

-- 知识图谱相关索引
CREATE INDEX idx_knowledge_graphs_company_id ON knowledge_graphs(company_id);

-- 临时知识库相关索引
CREATE INDEX idx_user_saved_chunks_temp_kb_id ON user_saved_chunks(temp_kb_id);

-- 聊天相关索引
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_agent_id ON chat_sessions(agent_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- 文件相关索引
CREATE INDEX idx_uploaded_files_user_id ON uploaded_files(user_id);

-- 全文搜索索引
CREATE INDEX idx_chat_messages_content_gin ON chat_messages USING gin(to_tsvector('simple', content));

-- ===========================================
-- 触发器函数
-- ===========================================

-- 更新时间戳函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agent_department_grants_updated_at BEFORE UPDATE ON agent_department_grants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_graphs_updated_at BEFORE UPDATE ON knowledge_graphs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_temp_knowledge_bases_updated_at BEFORE UPDATE ON user_temp_knowledge_bases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 初始数据
-- ===========================================

-- 生成 cuid 风格的 ID 函数
CREATE OR REPLACE FUNCTION generate_cuid() RETURNS TEXT AS $$
BEGIN
    RETURN 'c' || encode(gen_random_bytes(12), 'hex');
END;
$$ LANGUAGE plpgsql;





-- ===========================================
-- 说明
-- ===========================================
-- 此 Schema 与 prisma/schema.prisma 保持完全同步
-- 使用 TEXT 类型的 ID（cuid 格式）与 Prisma 保持一致
-- 所有表名和字段名使用 snake_case（通过 Prisma @map 映射）
-- 枚举类型与 Prisma enum 定义一致
