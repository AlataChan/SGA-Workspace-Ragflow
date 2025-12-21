import { NextRequest, NextResponse } from 'next/server';
import { RAGFlowClient } from '@/lib/ragflow-client';
import prisma from '@/lib/prisma';
import { normalizeRagflowContent } from '@/lib/ragflow-utils';

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
        const agent = await prisma.agent.findUnique({
            where: { id: agentId }
        });
        if (!agent) {
            return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
        }

        // 验证是否是 RAGFlow Agent
        if (agent.platform !== 'RAGFLOW') {
            return NextResponse.json({ error: 'Agent is not using RAGFlow' }, { status: 400 });
        }

        const platformConfig = agent.platformConfig as Record<string, any> | null;
        const baseUrl = platformConfig?.baseUrl?.replace(/\/$/, '');
        const apiKey = platformConfig?.apiKey;
        const ragflowAgentId = platformConfig?.agentId;

        if (!baseUrl || !apiKey || !ragflowAgentId) {
            return NextResponse.json({ error: 'RAGFlow agent config is incomplete' }, { status: 400 });
        }

        // 初始化 RAGFlow 客户端
        const client = new RAGFlowClient({
            baseUrl,
            apiKey,
            agentId: ragflowAgentId,
            userId: userId
        });

        const messages = await client.getConversationHistory(conversationId);
        const normalizedMessages = messages.map((msg: any) => ({
            id: msg.id || msg.message_id,
            role: msg.role ?? (msg.type === 'human' ? 'user' : 'assistant'),
            content: normalizeRagflowContent(
                msg.content ?? msg.data?.content ?? msg.answer ?? msg.outputs?.content ?? msg.output?.content
            ),
            created_at: msg.created_at ?? msg.create_time,
            reference: msg.reference ?? msg.data?.reference
        }));

        return NextResponse.json({ messages: normalizedMessages });
    } catch (error) {
        console.error("Fetch history error:", error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
