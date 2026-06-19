import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { decrypt } from '@/lib/vault'
import { logAudit, getClientIp } from '@/lib/audit'
import { INTEGRATIONS, isIntegrationId } from '@/lib/integrations'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// POST — manually trigger a sync (finance+, since this can push billing data out)
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }
  const { provider } = await params
  if (!isIntegrationId(provider)) return NextResponse.json({ error: 'Unknown integration' }, { status: 404 })

  const mod = INTEGRATIONS[provider]
  if (!mod.sync) return NextResponse.json({ error: `${mod.label} does not support manual sync` }, { status: 400 })

  const row = await prisma.integration.findUnique({ where: { provider } })
  if (!row || !row.active) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  const result = await mod.sync({
    config: JSON.parse(row.config),
    secret: row.encryptedSecret ? decrypt(row.encryptedSecret) : undefined,
  })

  await prisma.integration.update({
    where: { provider },
    data: {
      lastSyncAt:     new Date(),
      lastSyncStatus: result.ok ? 'ok' : 'error',
      lastSyncError:  result.ok ? null : result.message,
      lastSyncCount:  result.count ?? null,
    },
  })

  void logAudit({
    action: 'UPDATE', resource: 'provider_credential', resourceId: provider,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { sync: result.ok, message: result.message },
  })

  return NextResponse.json(result)
}
