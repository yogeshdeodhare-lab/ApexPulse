import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`
    const latencyMs = Date.now() - start

    return NextResponse.json({
      status:    'ok',
      version:   '5.0.0',
      sprint:    5,
      db:        'ok',
      latencyMs,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'degraded', db: 'error', error: String(err), timestamp: new Date().toISOString() },
      { status: 503 },
    )
  }
}
