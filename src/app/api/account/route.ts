import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET — the calling user's own profile (self-service "My Account" page).
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id')
  if (!userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  if (userId === 'env-admin') {
    return NextResponse.json({
      email: req.headers.get('x-user-email'), name: 'Admin', role: 'admin',
      mfaEnabled: false, ssoProvider: null, isEnvAdmin: true,
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, role: true, mfaEnabled: true, ssoProvider: true, passwordHash: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({ ...user, hasPassword: !!user.passwordHash, passwordHash: undefined, isEnvAdmin: false })
}
