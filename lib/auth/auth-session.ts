import prisma from "@/lib/prisma"

export type AuthSessionRevokeReason =
  | "NEW_LOGIN"
  | "LOGOUT"
  | "ADMIN_FORCE"
  | "LOCKED"
  | "DISABLED"
  | (string & {})

export interface CreateAuthSessionInput {
  userId: string
  companyId: string
  expiresAt: Date
  ip?: string
  userAgent?: string
}

export async function createAuthSession(input: CreateAuthSessionInput) {
  return prisma.authSession.create({
    data: {
      userId: input.userId,
      companyId: input.companyId,
      expiresAt: input.expiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
    },
    select: {
      id: true,
      userId: true,
      companyId: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
      revokedByUserId: true,
      revokeReason: true,
      ip: true,
      userAgent: true,
    },
  })
}

export interface RevokeAuthSessionsForUserInput {
  userId: string
  companyId: string
  reason: AuthSessionRevokeReason
  revokedByUserId?: string
}

export async function revokeAuthSessionsForUser(input: RevokeAuthSessionsForUserInput) {
  const now = new Date()
  return prisma.authSession.updateMany({
    where: {
      userId: input.userId,
      companyId: input.companyId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      revokedAt: now,
      revokeReason: input.reason,
      revokedByUserId: input.revokedByUserId,
    },
  })
}

export interface RevokeAuthSessionByIdInput {
  sessionId: string
  reason: AuthSessionRevokeReason
  revokedByUserId?: string
}

export async function revokeAuthSessionById(input: RevokeAuthSessionByIdInput) {
  const now = new Date()
  return prisma.authSession.update({
    where: { id: input.sessionId },
    data: {
      revokedAt: now,
      revokeReason: input.reason,
      revokedByUserId: input.revokedByUserId,
    },
    select: { id: true },
  })
}

export interface GetActiveAuthSessionForUserInput {
  userId: string
  companyId: string
}

export async function getActiveAuthSessionForUser(input: GetActiveAuthSessionForUserInput) {
  const now = new Date()
  return prisma.authSession.findFirst({
    where: {
      userId: input.userId,
      companyId: input.companyId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { lastSeenAt: "desc" },
  })
}

export async function getAuthSessionById(sessionId: string) {
  return prisma.authSession.findUnique({
    where: { id: sessionId },
  })
}

export interface ValidateAuthSessionForJwtPayloadInput {
  sessionId: string
  userId: string
  companyId: string
  now?: Date
}

export async function validateAuthSessionForJwtPayload(
  input: ValidateAuthSessionForJwtPayloadInput,
) {
  const now = input.now ?? new Date()
  const session = await prisma.authSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      userId: true,
      companyId: true,
      lastSeenAt: true,
      expiresAt: true,
      revokedAt: true,
      ip: true,
      userAgent: true,
    },
  })

  if (!session) return null
  if (session.userId !== input.userId) return null
  if (session.companyId !== input.companyId) return null
  if (session.revokedAt) return null
  if (session.expiresAt <= now) return null

  return session
}

export interface ReplaceAuthSessionForUserInput {
  userId: string
  companyId: string
  expiresAt: Date
  ip?: string
  userAgent?: string
  reason: AuthSessionRevokeReason
  revokedByUserId?: string
}

export async function replaceAuthSessionForUser(input: ReplaceAuthSessionForUserInput) {
  return prisma.$transaction(async (tx) => {
    const now = new Date()

    await tx.authSession.updateMany({
      where: {
        userId: input.userId,
        companyId: input.companyId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
        revokeReason: input.reason,
        revokedByUserId: input.revokedByUserId,
      },
    })

    return tx.authSession.create({
      data: {
        userId: input.userId,
        companyId: input.companyId,
        expiresAt: input.expiresAt,
        ip: input.ip,
        userAgent: input.userAgent,
      },
      select: {
        id: true,
        userId: true,
        companyId: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        revokedAt: true,
        revokedByUserId: true,
        revokeReason: true,
        ip: true,
        userAgent: true,
      },
    })
  })
}
