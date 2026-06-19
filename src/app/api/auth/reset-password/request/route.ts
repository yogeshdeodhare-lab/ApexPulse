import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { logAudit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

// POST — request a password reset link. Always returns a generic success message
// (never reveals whether the email exists) to avoid user enumeration.
export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email: string }
  const generic = NextResponse.json({ message: 'If that email exists, a reset link has been sent.' })
  if (!email) return generic

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user?.active || !user.passwordHash) return generic // SSO-only / env-admin accounts have no local password to reset

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })

  const rawToken  = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  })

  const resetUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/reset-password?token=${rawToken}`

  // No email provider is wired up yet — log server-side so an admin can relay it manually.
  console.log(`[password-reset] ${user.email} → ${resetUrl}`)

  void logAudit({
    action: 'UPDATE', resource: 'auth', resourceId: user.id,
    userEmail: user.email, ipAddress: getClientIp(req),
    metadata: { passwordResetRequested: true },
  })

  // Dev convenience only — never expose the live reset link in production responses.
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.', devResetUrl: resetUrl })
  }
  return generic
}
