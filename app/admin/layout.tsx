import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { UserRole } from "@prisma/client"

import prisma from "@/lib/prisma"
import { verifyToken } from "@/lib/auth/jwt"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get("auth-token")?.value
  if (!token) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/admin")}`)
  }

  const payload = verifyToken(token)
  if (!payload) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/admin")}`)
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, isActive: true },
  })

  if (!user || !user.isActive) {
    redirect(`/auth/login?redirect=${encodeURIComponent("/admin")}`)
  }

  if (user.role !== UserRole.ADMIN) {
    redirect("/workspace")
  }

  return children
}

