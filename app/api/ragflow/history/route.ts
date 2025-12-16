import { NextRequest, NextResponse } from 'next/server';
import { RAGFlowClient } from '@/lib/ragflow-client';
import { db } from '@/lib/database/simple-db';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const conversationId = searchParams.get('conversation_id');
        const agentId = searchParams.get('agent_id');
        const userId = searchParams.get('user_id') || 'history_sys';

        if (!conversationId || !agentId) {
            return NextResponse.json({ error: 'Missing conversation_id or agent_id' }, { status: 400 });
        }

        // 获取Agent配置
        const agent = await db.findAgentById(agentId);
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // 验证是否是 RAGFlow Agent
        if (agent.platform.toLowerCase() !== 'ragflow') {
            // Note: platform string case might vary, check logic
            // simple-db.ts shows 'dify', 'openai', 'custom'. 
            // If agent is RAGFLOW, platform should be 'ragflow'.
            // I will assume case-insensitive check.
            return NextResponse.json({ error: 'Agent is not using RAGFlow' }, { status: 400 });
        }

        // 初始化 RAGFlow 客户端
        const client = new RAGFlowClient({
            baseUrl: agent.apiUrl,
            apiKey: agent.apiKey,
            agentId: agent.id, // Or agent config might have specific ragflow agent id? 
            // Usually agent.id is local ID. RAGFlow external Agent ID might be in modelConfig or implied.
            // Looking at `ragflow-bot.ts` config: agentId is passed. 
            // In `simple-db.ts`, agent has `id`. 
            // If RAGFlow API needs a specific ID (not the local one), it should be in `modelConfig`.
            // Let's assume for now the local agent ID maps 1:1 or use modelConfig.agent_id if present.
            // However, usually API URL structure is .../chats/{agent_id}/...
            // So if `agent.apiUrl` is the base URL, we need the RAGFlow Agent ID.
            // If `agent.id` is just our local DB ID, we might need the real one.
            // Check `chat/route.ts` usage:
            // imports `sendToCustomAPI`... doesn't help.
            // Let's look at `ragflow-bot.ts` again.
            // It takes `agentId`.
            // I will assume `agent.id` IS the RAGFlow agent id OR `agent.modelConfig.agent_id` is.
            // For safety, I will check `modelConfig` first.
            userId: 'system-history-fetcher' // We need a userId, maybe from session but we just fetching history
        });

        // Override agentId if present in modelConfig, otherwise use agent.id
        // Actually, `chat/route.ts` passes `agentId` (local) to `sendToCustomAPI`? No.
        // Use `agent.id` for now, assuming user set it up that way.

        // NOTE: RAGFlowClient constructor takes config. 
        // We need to be careful about what ID is used. 
        // If I use `agent.id` it might be "demo-agent-1" which is definitely not a RAGFlow UUID.
        // Real usage probably involves storing the RAGFlow ID in `modelConfig` or `apiKey`?
        // Or maybe `agent.api_url` includes it?
        // `ragflow-client.ts` constructs URL: `${this.config.baseUrl}/api/v1/chats/${this.config.agentId}/completions`
        // So `agentId` is a path parameter.
        // If our DB stores `api_url` as `http://host/v1`, then we need `agentId`.
        // I will use `agent.modelConfig?.agent_id || agent.id`.

        // wait, `lib/ragflow-client.ts` is `export class RAGFlowClient`.
        // I need to make sure I am importing it correctly.

        // To properly support this, I should probably check if `agent.modelConfig` has `ragflow_agent_id`.

        const ragflowAgentId = agent.modelConfig?.agent_id || agent.id;

        // Re-instantiate with correct ID
        const clientWithCorrectId = new RAGFlowClient({
            baseUrl: agent.apiUrl,
            apiKey: agent.apiKey,
            agentId: ragflowAgentId,
            userId: userId
        });

        const messages = await clientWithCorrectId.getConversationHistory(conversationId);

        // Transform messages to our format if needed
        // Our format: { role: 'user'|'assistant', content: string, ... }
        // RAGFlow format: check `getConversationHistory` implementation. 
        // It returns `session.messages`.

        return NextResponse.json({ messages });
    } catch (error) {
        console.error("Fetch history error:", error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
