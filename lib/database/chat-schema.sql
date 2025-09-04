-- 聊天会话表
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    topic VARCHAR(500) NOT NULL DEFAULT '新对话',
    conversation_id VARCHAR(100), -- Dify的conversation_id
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,

    -- 会话配置
    model_config JSONB,
    mask_config JSONB,

    -- 统计信息
    token_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    char_count INTEGER DEFAULT 0
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_conversation_id ON chat_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);

-- 聊天消息表
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- 消息元数据
    model VARCHAR(100),
    token_count INTEGER DEFAULT 0,
    streaming BOOLEAN DEFAULT FALSE,
    is_error BOOLEAN DEFAULT FALSE,

    -- 多媒体内容
    attachments JSONB, -- 文件、图片等附件
    tools JSONB, -- 工具调用信息

    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 创建触发器函数：更新会话的最后消息时间和消息数量
CREATE OR REPLACE FUNCTION update_session_stats_after_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET
        last_message_at = NEW.created_at,
        message_count = message_count + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_session_stats_after_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_sessions
    SET
        message_count = GREATEST(message_count - 1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = OLD.session_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trigger_update_session_stats_after_insert
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_stats_after_insert();

CREATE TRIGGER trigger_update_session_stats_after_delete
    AFTER DELETE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_session_stats_after_delete();

-- 插入示例数据（可选）
-- INSERT INTO chat_sessions (id, user_id, topic, conversation_id) 
-- VALUES ('demo-session-1', 'admin-user-id', '测试对话', 'dify-conv-123');
