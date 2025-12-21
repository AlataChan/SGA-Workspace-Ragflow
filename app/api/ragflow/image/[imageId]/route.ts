import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: { imageId: string } }) {
    try {
        const imageId = params.imageId;
        if (!imageId) {
            return new NextResponse('Missing image ID', { status: 400 });
        }

        // We need to find *which* agent this image belongs to, to get the base URL and API key.
        // This is tricky because the image ID doesn't tell us the agent.
        // Option 1: Pass agent_id in query param? /api/ragflow/image/[imageId]?agent_id=...
        // Option 2: Try to find a RAGFlow agent default?
        // I will assume the frontend passes `agent_id` as a search param for now, 
        // or I iterate all RAGFlow agents (expensive).
        // Let's check query params.

        const searchParams = request.nextUrl.searchParams;
        const agentId = searchParams.get('agent_id');

        if (!agentId) {
            // Fallback: try to find the first RAGFlow agent or return 400.
            // For a robust system, we should require agent_id.
            return new NextResponse('Missing agent_id param', { status: 400 });
        }

        const agent = await prisma.agent.findUnique({
            where: { id: agentId }
        });
        if (!agent) {
            return new NextResponse('Agent not found', { status: 404 });
        }

        if (agent.platform !== 'RAGFLOW') {
            return new NextResponse('Agent platform is not RAGFlow', { status: 400 });
        }

        const platformConfig = agent.platformConfig as Record<string, any> | null;
        const apiKey = platformConfig?.apiKey;
        let baseUrl = platformConfig?.baseUrl;

        if (!apiKey || !baseUrl) {
            return new NextResponse('RAGFlow agent config is incomplete', { status: 400 });
        }

        // Construct RAGFlow image URL
        // Assumption: RAGFlow serves images at `/api/v1/image/{imageId}` or similar?
        // The web search said: `/image/<image_id>` on Ragflow server.
        // It might be authenticated? 
        // "GET request made to the /image/<image_id> endpoint on the Ragflow server".
        // I will assume it needs the Bearer token.

        // Clean base URL (remove /v1 suffix if present, purely heuristic)
        if (baseUrl.endsWith('/v1')) {
            baseUrl = baseUrl.slice(0, -3); // remove /v1
        } else if (baseUrl.endsWith('/api/v1')) {
            baseUrl = baseUrl.slice(0, -7);
        }

        // Or maybe the API URL provided IS the base.
        // Let's assume `agent.apiUrl` is like `http://host` or `http://host/api`.
        // If it's `http://host/v1`, we might need to adjust.
        // Safest bet: Try to use the same host.

        // Web search: "GET request can be made to the /image/<image_id> endpoint"
        // I'll assume it's `/logo/{imageId}` or `/image/{imageId}` relative to root.

        // Let's try `${baseUrl}/image/${imageId}` first, assuming baseUrl is root-ish.
        // If `apiUrl` is `.../api/v1`, we probably want `.../image/${imageId}`?
        // Actually, usually RAGFlow `logo` endpoint is `/logo/...`?
        // Let's trust the search which said `/image/<image_id>`.

        const imageUrl = `${baseUrl}/image/${imageId}`;

        const response = await fetch(imageUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.status}`, { status: response.status });
        }

        // Stream back headers and body
        const headers = new Headers(response.headers);
        headers.set('Content-Disposition', `inline; filename="${imageId}"`);

        return new NextResponse(response.body, {
            status: 200,
            headers
        });

    } catch (error) {
        console.error("Proxy image error:", error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
