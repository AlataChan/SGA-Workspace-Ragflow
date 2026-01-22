/**
 * 用户部门归属覆盖
 * POST /api/admin/users/[id]/department-override
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAdminAuth } from "@/lib/auth/middleware"
import { z } from "zod"
import { computeEffectiveDepartmentId } from "@/lib/user-department"

export const dynamic = "force-dynamic"

const SUPER_ADMIN_ID = "00000000-0000-0000-0000-000000000001"

const requestSchema = z.object({
  departmentId: z.union([z.string().min(1), z.null()]),
  reason: z.string().max(200).optional(),
})

export const POST = withAdminAuth(async (request, context) => {
  try {
    const admin = request.user!
    const targetUserId = context.params.id
    const body = (await request.json().catch(() => ({}))) as unknown

    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "请求参数错误", details: parsed.error.flatten().fieldErrors } },
        { status: 400 },
      )
    }

    if (targetUserId === SUPER_ADMIN_ID) {
      return NextResponse.json(
        { error: { code: "PROTECTED_USER", message: "系统超级管理员账号不能被操作" } },
        { status: 403 },
      )
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: targetUserId, companyId: admin.companyId },
      select: {
        id: true,
        mdmDepartmentExternalId: true,
      },
    })
    if (!targetUser) {
      return NextResponse.json(
        { error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
        { status: 404 },
      )
    }

    const { departmentId, reason } = parsed.data

    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, companyId: admin.companyId },
        select: { id: true },
      })
      if (!dept) {
        return NextResponse.json(
          { error: { code: "DEPARTMENT_NOT_FOUND", message: "部门不存在" } },
          { status: 400 },
        )
      }
    }

    const effectiveDeptId = await computeEffectiveDepartmentId(
      {
        mdmDepartmentExternalId: targetUser.mdmDepartmentExternalId,
        localDepartmentOverride: departmentId,
      },
      admin.companyId,
    )

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        localDepartmentOverride: departmentId,
        localDeptOverrideReason: departmentId ? reason ?? null : null,
        localDeptOverrideAt: departmentId ? new Date() : null,
        localDeptOverrideBy: departmentId ? admin.userId : null,
        departmentId: effectiveDeptId,
      },
      select: {
        id: true,
        departmentId: true,
        mdmDepartmentExternalId: true,
        localDepartmentOverride: true,
        localDeptOverrideReason: true,
        localDeptOverrideAt: true,
        localDeptOverrideBy: true,
        department: {
          select: { id: true, name: true, icon: true },
        },
      },
    })

    return NextResponse.json({ data: updated, message: "部门覆盖已更新" })
  } catch (error) {
    console.error("设置部门覆盖失败:", error)
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "设置部门覆盖失败" } },
      { status: 500 },
    )
  } finally {
    await prisma.$disconnect()
  }
})
