import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'
import { encrypt } from '@/lib/vault'
import { INTEGRATIONS, isIntegrationId } from '@/lib/integrations'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// POST — connect or update an integration (admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const { provider } = await params
  if (!isIntegrationId(provider)) return NextResponse.json({ error: 'Unknown integration' }, { status: 404 })

  const mod  = INTEGRATIONS[provider]
  const body = await req.json() as { config?: Record<string, string>; secret?: string }

  let secret = body.secret?.trim()
  if (!secret && mod.secretLabel === null) {
    secret = randomBytes(24).toString('hex') // e.g. Grafana scrape token — auto-generated, not user-typed
  }

  const integration = await prisma.integration.upsert({
    where:  { provider },
    update: {
      config: JSON.stringify(body.config ?? {}),
      ...(secret && { encryptedSecret: encrypt(secret) }),
      active: true,
    },
    create: {
      provider,
      config:          JSON.stringify(body.config ?? {}),
      encryptedSecret: secret ? encrypt(secret) : null,
      createdBy:       callerEmail(req) ?? undefined,
    },
  })

  void logAudit({
    action: 'CREATE', resource: 'provider_credential', resourceId: provider,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { provider, config: body.config },
  })

  // Surface the freshly-generated token exactly once (e.g. Grafana scrape token) — never on subsequent reads.
  const justGenerated = !body.secret && mod.secretLabel === null
  return NextResponse.json({
    id: integration.id, provider, active: integration.active,
    ...(justGenerated && { secret }),
  }, { status: 201 })
}

// DELETE — disconnect an integration (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const { provider } = await params
  if (!isIntegrationId(provider)) return NextResponse.json({ error: 'Unknown integration' }, { status: 404 })

  await prisma.integration.deleteMany({ where: { provider } })

  void logAudit({
    action: 'DELETE', resource: 'provider_credential', resourceId: provider,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
