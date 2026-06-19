import { NextResponse } from 'next/server'
import { getProviderStatus } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version:     '10.0.0',
    sprint:      10,
    providers:   getProviderStatus(),
    nodeEnv:     process.env.NODE_ENV,
    dbType:      (process.env.DATABASE_URL ?? '').startsWith('postgresql') ? 'postgresql' : 'sqlite',
    authEnabled: !!process.env.NEXTAUTH_SECRET,
  })
}
