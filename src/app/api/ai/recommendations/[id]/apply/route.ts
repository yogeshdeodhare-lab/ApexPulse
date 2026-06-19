import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { setConfig } from '@/lib/config'
import { logAudit, getClientIp } from '@/lib/audit'
import { decrypt } from '@/lib/vault'
import { INTEGRATIONS, type IntegrationId } from '@/lib/integrations'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// POST — apply a recommendation. config_write writes the AppConfig key directly;
// create_ticket files an issue in the first connected Jira/Linear; manual just
// records that the admin acknowledged and acted on it outside the app.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }
  const { id } = await params
  const rec = await prisma.recommendation.findUnique({ where: { id } })
  if (!rec) return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
  if (rec.status !== 'active') return NextResponse.json({ error: `Already ${rec.status}` }, { status: 400 })

  let ticketUrl: string | undefined

  if (rec.actionType === 'config_write') {
    if (!rec.actionPayload) return NextResponse.json({ error: 'No config payload on this recommendation' }, { status: 400 })
    const { key, value } = JSON.parse(rec.actionPayload) as { key: string; value: string }
    await setConfig(key, value, callerEmail(req) ?? 'ai-optimization')
  }

  if (rec.actionType === 'create_ticket') {
    const rows = await prisma.integration.findMany({ where: { active: true, provider: { in: ['jira', 'linear'] } } })
    const row = rows[0]
    if (!row) {
      return NextResponse.json({ error: 'No Jira or Linear integration connected — connect one in the Marketplace first' }, { status: 400 })
    }
    const mod = INTEGRATIONS[row.provider as IntegrationId]
    const result = await mod.createTicket!(
      { config: JSON.parse(row.config), secret: row.encryptedSecret ? decrypt(row.encryptedSecret) : undefined },
      { title: rec.title, message: `${rec.description}\n\n${rec.rationale ?? ''}`, severity: 'warning', source: 'ai-optimization' },
    )
    if (!result.ok) return NextResponse.json({ error: result.error ?? 'Ticket creation failed' }, { status: 502 })
    ticketUrl = result.url
  }

  const updated = await prisma.recommendation.update({
    where: { id }, data: { status: 'applied', appliedAt: new Date(), appliedBy: callerEmail(req) ?? undefined },
  })

  void logAudit({
    action: 'UPDATE', resource: 'optimization', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { applied: true, actionType: rec.actionType, ticketUrl },
  })

  return NextResponse.json({ ...updated, ticketUrl })
}
