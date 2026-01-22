/**
 * 批量为用户授予“全部 Agent 权限”
 *
 * POST /api/admin/users/bulk/grant-all-agents
 *
 * 说明：
 * - 仅管理员可调用
 * - 默认对当前公司所有普通用户（USER）生效
 * - 使用 createMany + skipDuplicates，支持重复执行（幂等）
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminAuth } from "@/lib/auth/middleware";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { nanoid } from "nanoid";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

const requestSchema = z.object({
  userIds: z.array(z.string().min(1)).optional(),
  includeAdmins: z.boolean().optional().default(false),
  includeInactive: z.boolean().optional().default(true),
});

function chunkArray<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const POST = withAdminAuth(async (request) => {
  try {
    const admin = request.user!;
    const body = (await request.json().catch(() => ({}))) as unknown;
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请求参数错误" } },
        { status: 400, headers: corsHeaders },
      );
    }

    const { userIds, includeAdmins, includeInactive } = parsed.data;

    const agents = await prisma.agent.findMany({
      where: { companyId: admin.companyId },
      select: { id: true },
    });
    const agentIds = agents.map((a) => a.id);
    if (agentIds.length === 0) {
      return NextResponse.json(
        { error: { code: "NO_AGENTS", message: "当前公司暂无 Agent" } },
        { status: 400, headers: corsHeaders },
      );
    }

    const whereUsers: any = {
      companyId: admin.companyId,
      id: { not: "00000000-0000-0000-0000-000000000001" }, // 保护超级管理员
    };
    if (!includeAdmins) whereUsers.role = UserRole.USER;
    if (!includeInactive) whereUsers.isActive = true;
    if (userIds && userIds.length > 0) whereUsers.id = { in: userIds };

    const users = await prisma.user.findMany({
      where: whereUsers,
      select: { id: true },
    });
    const targetUserIds = users.map((u) => u.id);
    if (targetUserIds.length === 0) {
      return NextResponse.json(
        {
          data: { inserted: 0, usersProcessed: 0, agentCount: agentIds.length },
          message: "没有需要处理的用户",
        },
        { headers: corsHeaders },
      );
    }

    // 控制单次 createMany 的行数，避免 SQL 参数过多
    const maxRowsPerBatch = 8000;
    const usersPerBatch = Math.max(1, Math.floor(maxRowsPerBatch / agentIds.length));
    const userBatches = chunkArray(targetUserIds, usersPerBatch);

    let inserted = 0;
    const grantBatchId = nanoid(16);
    for (const batch of userBatches) {
      const rows = batch.flatMap((userId) =>
        agentIds.map((agentId) => ({
          userId,
          agentId,
          grantedBy: admin.userId,
          grantedVia: "bulk_all_agents",
          grantBatchId,
        })),
      );

      const result = await prisma.userAgentPermission.createMany({
        data: rows,
        skipDuplicates: true,
      });
      inserted += result.count;
    }

    return NextResponse.json(
      {
        data: {
          inserted,
          usersProcessed: targetUserIds.length,
          agentCount: agentIds.length,
          grantBatchId,
        },
        message: "批量授权完成",
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("批量授权全部 Agent 失败:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "批量授权失败" } },
      { status: 500, headers: corsHeaders },
    );
  } finally {
    await prisma.$disconnect();
  }
});
