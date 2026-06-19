import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// POST — dismiss a recommendation; won't resurface for 30 days even if the
// underlying candidate is still present in the next analysis run.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }
  const { id } = await params
  const rec = await prisma.recommendation.findUnique({ where: { id } })
  if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
  if (rec.status !== 'active') return NextResponse.json({ error: `Already ${rec.status}` }, { status: 400 })

  const now = new Date()
  const updated = await prisma.recommendation.update({
    where: { id },
    data: { status: 'dismissed', dismissedAt: now, dismissedUntil: new Date(now.getTime() + THIRTY_DAYS_MS) },
  })

  void logAudit({
    action: 'UPDATE', resource: 'optimization', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { dismissed: true },
  })

  return NextResponse.json(updated)
}
