import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/vault'
import { verifyTotp } from '@/lib/totp'
import { logAudit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

// POST — confirm enrollment by proving the user can generate a valid code.
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId || userId === 'env-admin') return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { code } = await req.json() as { code: string }
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.mfaSecret) return NextResponse.json({ error: 'No MFA setup in progress — call /setup first' }, { status: 400 })

  if (!code || !verifyTotp(decrypt(user.mfaSecret), code)) {
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } })
  void logAudit({ action: 'UPDATE', resource: 'auth', resourceId: userId, ipAddress: getClientIp(req), after: { mfaEnabled: true } })

  return NextResponse.json({ ok: true })
}
