-- SGA 初始化数据
-- 包含公司信息、部门、Agent和管理员用户

-- 插入SGA公司信息
INSERT INTO companies (id, name, logo_url, created_at, updated_at) VALUES 
('sga_company_001', 'Solo Genius Agent', '/assets/sga-logo.png', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 插入部门数据
INSERT INTO departments (id, company_id, name, description, icon, sort_order, created_at, updated_at) VALUES 
('dept_management', 'sga_company_001', '管理层', '公司高级管理团队', 'Crown', 1, NOW(), NOW()),
('dept_consultant', 'sga_company_001', 'Ai Consultant 中心', '人工智能咨询服务团队', 'Bot', 2, NOW(), NOW()),
('dept_finance', 'sga_company_001', '财务及风控中心', '财务管理和风险控制团队', 'Shield', 3, NOW(), NOW()),
('dept_marketing', 'sga_company_001', '市场营销部', '市场推广和营销团队', 'Megaphone', 4, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 插入Agent数据（SGA真实团队）
INSERT INTO agents (
  id, company_id, department_id, chinese_name, english_name, position, description,
  avatar_url, photo_url, dify_url, dify_key, is_online, sort_order, created_at, updated_at
) VALUES 
-- 管理层
('agent_leon', 'sga_company_001', 'dept_management', '李昂 (Leon Li)', 'Leon Li', 'COO', 
 '基于Claude 3.5 Sonnet，负责公司运营管理，制定战略规划，优化业务流程，确保公司高效运转。',
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
 NULL, NULL, false, 1, NOW(), NOW()),

('agent_vivian', 'sga_company_001', 'dept_management', '李薇 (Vivian Li)', 'Vivian Li', 'CHO',
 '基于GPT-4O，负责人力资源管理，包括招聘、培训、绩效管理和企业文化建设。',
 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop',
 NULL, NULL, false, 2, NOW(), NOW()),

-- 财务及风控中心
('agent_alex', 'sga_company_001', 'dept_finance', '张睿 (Alex Zhang)', 'Alex Zhang', '法务及风控主管',
 '基于Gemini 1.5 Pro，负责公司风控、合同制定与审核，确保公司在合规的轨道上高速发展。',
 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=600&fit=crop',
 NULL, NULL, false, 3, NOW(), NOW()),

('agent_wendy', 'sga_company_001', 'dept_finance', '蔡婉清 (Wendy)', 'Wendy Cai', '财务经理',
 '基于GPT-4O，从ERP系统中获取财务数据进行分析，并对财务数据进行调整和分析。',
 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=600&fit=crop',
 NULL, NULL, false, 4, NOW(), NOW()),

-- Ai Consultant 中心
('agent_sophia', 'sga_company_001', 'dept_consultant', '赵思睿 (Sophia)', 'Sophia Zhao', 'B端顾问',
 '基于Claude 3.5 Sonnet，专注于B端客户服务，提供专业的商业咨询和解决方案。',
 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=600&fit=crop',
 NULL, NULL, false, 5, NOW(), NOW()),

-- 市场营销部
('agent_jingzhi', 'sga_company_001', 'dept_marketing', '璟智 (Jingzhi)', 'Jingzhi', '市场专员',
 '基于GPT-4O，负责市场推广、品牌建设和客户关系维护，助力公司业务增长。',
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop',
 NULL, NULL, false, 6, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 插入管理员用户
INSERT INTO users (
  id, company_id, user_id, phone, password_hash, display_name, role, is_active, created_at, updated_at
) VALUES 
('user_admin', 'sga_company_001', 'admin', '13800000000', 
 '$2b$10$example_hash_replace_with_real_hash', '系统管理员', 'ADMIN', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 为管理员授权所有Agent权限
INSERT INTO user_agent_permissions (id, user_id, agent_id, granted_by, created_at) VALUES 
('perm_admin_leon', 'user_admin', 'agent_leon', 'user_admin', NOW()),
('perm_admin_vivian', 'user_admin', 'agent_vivian', 'user_admin', NOW()),
('perm_admin_alex', 'user_admin', 'agent_alex', 'user_admin', NOW()),
('perm_admin_wendy', 'user_admin', 'agent_wendy', 'user_admin', NOW()),
('perm_admin_sophia', 'user_admin', 'agent_sophia', 'user_admin', NOW()),
('perm_admin_jingzhi', 'user_admin', 'agent_jingzhi', 'user_admin', NOW())
ON CONFLICT DO NOTHING;
