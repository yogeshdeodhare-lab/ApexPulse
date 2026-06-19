import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { runAnalysis, getLatestRun, measureRoi } from '@/lib/ai-recommendations'

function callerRole(req: NextRequest) { return req.headers.get('x-user-role') ?? null }

export const dynamic = 'force-dynamic'

const SIX_HOURS_MS = 6 * 60 * 60 * 1000

// GET — active + recent recommendations. Lazily refreshes if the last run is
// stale (> 6h or never run), so recommendations refresh "automatically" without
// needing a dedicated background worker.
export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let lastRun = await getLatestRun()
  let refreshError: string | undefined

  if (!lastRun || Date.now() - lastRun.runAt.getTime() > SIX_HOURS_MS) {
    const result = await runAnalysis()
    refreshError = result.error
    lastRun = await getLatestRun()
  }

  void measureRoi().catch(() => {})

  const [active, history] = await Promise.all([
    prisma.recommendation.findMany({ where: { status: 'active' }, orderBy: { estimatedSavings: 'desc' } }),
    prisma.recommendation.findMany({
      where: { status: { in: ['applied', 'dismissed', 'expired'] } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
  ])

  return NextResponse.json({
    recommendations: active,
    history,
    lastRunAt: lastRun?.runAt ?? null,
    nextRunDue: lastRun ? new Date(lastRun.runAt.getTime() + SIX_HOURS_MS) : null,
    refreshError,
  })
}
