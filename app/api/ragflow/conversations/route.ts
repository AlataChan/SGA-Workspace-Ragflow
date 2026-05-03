import { NextRequest, NextResponse } from 'next/server'
import { RAGFlowClient } from '@/lib/ragflow-client'
import prisma from '@/lib/prisma'
import { verifyUserAuth } from '@/lib/auth/user'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const user = await verifyUserAuth(request)
        if (!user) {
            return NextResponse.json(
                { error: '未授权' },
                { status: 401 }
            )
        }

        const searchParams = request.nextUrl.searchParams
        const agent_id = searchParams.get('agent_id')
        const page = parseInt(searchParams.get('page') || '1')
        const page_size = parseInt(searchParams.get('page_size') || '20')
        const user_id = user.userId || 'default-user'

        if (!agent_id) {
            return NextResponse.json(
                { error: 'Missing agent_id' },
                { status: 400 }
            )
        }

        // 获取 Agent 配置
        const agent = await prisma.agent.findFirst({
            where: {
                id: agent_id,
                companyId: user.companyId
            }
        })
        if (!agent) {
            return NextResponse.json(
                { error: 'Agent not found' },
                { status: 404 }
            )
        }

        if (agent.platform !== 'RAGFLOW') {
            return NextResponse.json(
                { error: 'Agent platform is not RAGFlow' },
                { status: 400 }
            )
        }

        const platformConfig = agent.platformConfig as Record<string, any> | null
        const baseUrl = platformConfig?.baseUrl?.replace(/\/$/, '')
        const apiKey = platformConfig?.apiKey
        const ragflowAgentId = platformConfig?.agentId

        if (!baseUrl || !apiKey || !ragflowAgentId) {
            return NextResponse.json(
                { error: 'RAGFlow agent config is incomplete' },
                { status: 400 }
            )
        }

        // 初始化 RAGFlow 客户端
        const ragflowClient = new RAGFlowClient({
            baseUrl,
            apiKey,
            agentId: ragflowAgentId,
            userId: user_id
        })

        const sessions = await ragflowClient.getSessions(page, page_size, user_id)

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
