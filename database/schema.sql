-- SGA 私有化部署数据库设计
-- 单公司版本，支持管理员设置公司信息、Agent管理、用户权限管理

-- 1. 公司信息表
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL COMMENT '公司名称',
  logo_url VARCHAR(500) COMMENT '公司Logo URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 部门表（单层结构）
CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(100) NOT NULL COMMENT '部门名称',
  description TEXT COMMENT '部门描述',
  icon VARCHAR(50) COMMENT '部门图标名称',
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. Agent表
CREATE TABLE agents (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  department_id INT NOT NULL,
  chinese_name VARCHAR(100) NOT NULL COMMENT '中文名',
  english_name VARCHAR(100) COMMENT '英文名',
  position VARCHAR(100) NOT NULL COMMENT '岗位',
  description TEXT COMMENT '能力介绍',
  avatar_url VARCHAR(500) COMMENT '头像URL（聊天界面用）',
  photo_url VARCHAR(500) COMMENT '照片URL（主页展示用）',
  dify_url VARCHAR(500) COMMENT 'Dify API URL',
  dify_key VARCHAR(255) COMMENT 'Dify API Key',
  is_online BOOLEAN DEFAULT FALSE COMMENT '是否在线',
  connection_tested_at TIMESTAMP COMMENT '最后测试连接时间',
  sort_order INT DEFAULT 0 COMMENT '排序顺序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- 4. 用户表
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  company_id INT NOT NULL,
  user_id VARCHAR(100) NOT NULL COMMENT '用户ID（企微一致）',
  phone VARCHAR(20) NOT NULL COMMENT '手机号',
  password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希',
  display_name VARCHAR(100) COMMENT '显示名称',
  avatar_url VARCHAR(500) COMMENT '用户头像',
  role ENUM('admin', 'user') DEFAULT 'user' COMMENT '用户角色',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
  last_login_at TIMESTAMP COMMENT '最后登录时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_id (company_id, user_id),
  UNIQUE KEY unique_phone (company_id, phone)
);

-- 5. 用户Agent权限表
CREATE TABLE user_agent_permissions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  agent_id INT NOT NULL,
  granted_by INT NOT NULL COMMENT '授权管理员ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (granted_by) REFERENCES users(id),
  UNIQUE KEY unique_user_agent (user_id, agent_id)
);

-- 6. 聊天会话表（为后续功能预留）
CREATE TABLE chat_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  agent_id INT NOT NULL,
  session_name VARCHAR(255) COMMENT '会话名称',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 初始化SGA公司数据
INSERT INTO companies (name, logo_url) VALUES 
('Solo Genius Agent', '/assets/sga-logo.png');

-- 初始化部门数据
INSERT INTO departments (company_id, name, description, icon, sort_order) VALUES 
(1, '管理层', '公司高级管理团队', 'Crown', 1),
(1, 'Ai Consultant 中心', '人工智能咨询服务团队', 'Bot', 2),
(1, '财务及风控中心', '财务管理和风险控制团队', 'Shield', 3),
(1, '市场营销部', '市场推广和营销团队', 'Megaphone', 4);

-- 初始化管理员用户
INSERT INTO users (company_id, user_id, phone, password_hash, display_name, role) VALUES 
(1, 'admin', '13800000000', '$2b$10$example_hash', '系统管理员', 'admin');
