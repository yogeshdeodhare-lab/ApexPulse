import { NextRequest, NextResponse } from 'next/server'
import { hasRole } from '@/lib/rbac'
import { runAnalysis } from '@/lib/ai-recommendations'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// POST — force a fresh Claude Haiku analysis run right now (manual trigger,
// e.g. for the "Refresh Analysis" button — the same endpoint a 6h cron would hit).
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  const result = await runAnalysis()

  void logAudit({
    action: 'UPDATE', resource: 'optimization',
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: result,
  })

  if (result.error) return NextResponse.json(result, { status: 502 })
  return NextResponse.json(result)
}
