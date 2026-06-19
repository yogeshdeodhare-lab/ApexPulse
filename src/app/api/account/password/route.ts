import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { logAudit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST — self-service password change (requires the current password, unlike
// the email-token reset flow which is for when the password is forgotten).
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId || userId === 'env-admin') return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json() as { currentPassword: string; newPassword: string }
  if (!currentPassword || !newPassword) return NextResponse.json({ error: 'currentPassword and newPassword required' }, { status: 400 })
  if (newPassword.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.passwordHash) return NextResponse.json({ error: 'This account has no local password (SSO-only)' }, { status: 400 })

  const valid = await compare(currentPassword, user.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })

  const passwordHash = await hash(newPassword, 10)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

  void logAudit({ action: 'UPDATE', resource: 'auth', resourceId: userId, ipAddress: getClientIp(req), metadata: { selfServicePasswordChange: true } })

  return NextResponse.json({ ok: true })
}
