import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/vault'
import { generateSecret, otpauthUrl } from '@/lib/totp'

export const dynamic = 'force-dynamic'

// POST — self-service: start MFA enrollment for the calling user. Returns the
// secret once (for manual entry, no QR — we don't ship a QR library or call
// third-party QR services with a TOTP secret) plus the otpauth:// URI.
export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  const email  = req.headers.get('x-user-email') ?? 'user'
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  if (userId === 'env-admin') {
    return NextResponse.json({ error: 'MFA is not available for the bootstrap admin account — create a DB-backed admin user instead.' }, { status: 400 })
  }

  const secret = generateSecret()
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: encrypt(secret), mfaEnabled: false } })

  return NextResponse.json({ secret, otpauthUrl: otpauthUrl(secret, email, 'APEX Pulse') })
}
