import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database/simple-db'
import { RAGFlowClient } from '@/lib/ragflow-client'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const agent_id = searchParams.get('agent_id')
        const page = parseInt(searchParams.get('page') || '1')
        const page_size = parseInt(searchParams.get('page_size') || '20')
        const user_id = searchParams.get('user_id') || 'default-user'

        if (!agent_id) {
            return NextResponse.json(
                { error: 'Missing agent_id' },
                { status: 400 }
            )
        }

        // 获取 Agent 配置
        const agent = await db.findAgentById(agent_id)
        if (!agent) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            )
        }

        if (agent.platform.toLowerCase() !== 'ragflow') {
            return NextResponse.json(
                { error: 'Agent platform is not RAGFlow' },
                { status: 400 }
            )
        }

        // 初始化 RAGFlow 客户端
        const ragflowClient = new RAGFlowClient({
            baseUrl: agent.apiUrl,
            apiKey: agent.apiKey,
            agentId: agent.modelConfig?.agent_id || agent.id,
            userId: user_id
        })

        const sessions = await ragflowClient.getSessions(page, page_size)

        return NextResponse.json({
            data: sessions,
            has_more: sessions.length === page_size // 简单的分页判断
        })

    } catch (error) {
        console.error('[RAGFlow History] Error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
