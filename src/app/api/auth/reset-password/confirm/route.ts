import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { logAudit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST — consume a reset token and set a new password.
export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json() as { token: string; newPassword: string }
  if (!token || !newPassword) {
    return NextResponse.json({ error: 'token and newPassword required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
  }

  const passwordHash = await hash(newPassword, 10)
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: resetToken.userId, usedAt: null } }),
    // Force re-login everywhere — a password change should invalidate every existing session.
    prisma.userSession.updateMany({ where: { userId: resetToken.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ])

  void logAudit({
    action: 'UPDATE', resource: 'auth', resourceId: resetToken.userId,
    ipAddress: getClientIp(req), metadata: { passwordReset: true },
  })

  return NextResponse.json({ ok: true })
}
