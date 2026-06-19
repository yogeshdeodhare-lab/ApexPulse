import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { testDeliver, genSecret } from '@/lib/webhook-delivery'

function callerRole(req: NextRequest) { return req.headers.get('x-user-role') ?? null }

export const dynamic = 'force-dynamic'

// POST — fire a single test delivery, either to a saved webhook (by id) or
// to an unsaved draft (url + type), so the form can be tested before saving.
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const body = await req.json() as { id?: string; url?: string; type?: string; name?: string }

  let webhook: { id: string; url: string; type: string; name: string; secret: string }

  if (body.id) {
    const row = await prisma.webhook.findUnique({ where: { id: body.id } })
    if (!row) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
    webhook = row
  } else {
    if (!body.url) return NextResponse.json({ error: 'url required' }, { status: 400 })
    webhook = { id: 'draft', url: body.url, type: body.type ?? 'http', name: body.name ?? 'Test', secret: genSecret() }
  }

  const result = await testDeliver(webhook, {
    title:   'APEX Pulse Test Notification',
    message: `This is a test delivery from APEX Pulse for webhook "${webhook.name}". If you can see this, the connection works.`,
    severity: 'info',
    source:  'webhook-test',
  }, !!body.id)

  return NextResponse.json(result)
}
