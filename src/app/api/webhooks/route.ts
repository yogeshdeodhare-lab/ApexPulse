import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'
import { genSecret } from '@/lib/webhook-delivery'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// GET — list webhooks with recent deliveries (viewer+)
export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [webhooks, recentDeliveries] = await Promise.all([
    prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
      include: { deliveries: { orderBy: { sentAt: 'desc' }, take: 5 } },
    }),
    prisma.webhookDelivery.findMany({
      orderBy: { sentAt: 'desc' },
      take: 20,
      include: { webhook: { select: { name: true, type: true } } },
    }),
  ])

  return NextResponse.json({
    webhooks: webhooks.map(w => ({ ...w, events: JSON.parse(w.events) })),
    recentDeliveries,
  })
}

// POST — create webhook (admin)
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const body = await req.json() as { name: string; url: string; type?: string; events: string[] }
  if (!body.name || !body.url || !body.events?.length) {
    return NextResponse.json({ error: 'name, url and events required' }, { status: 400 })
  }

  const webhook = await prisma.webhook.create({
    data: {
      name:   body.name,
      url:    body.url,
      type:   body.type ?? 'http',
      events: JSON.stringify(body.events),
      secret: genSecret(),
    },
  })

  void logAudit({
    action: 'CREATE', resource: 'webhook', resourceId: webhook.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { name: body.name, url: body.url, type: body.type, events: body.events },
  })

  return NextResponse.json({ ...webhook, events: body.events }, { status: 201 })
}

// PUT — update webhook (admin)
export async function PUT(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const body = await req.json() as {
    id: string; name?: string; url?: string; type?: string; events?: string[]; active?: boolean; regenerateSecret?: boolean
  }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const webhook = await prisma.webhook.update({
    where: { id: body.id },
    data: {
      ...(body.name   !== undefined && { name: body.name }),
      ...(body.url    !== undefined && { url: body.url }),
      ...(body.type   !== undefined && { type: body.type }),
      ...(body.events !== undefined && { events: JSON.stringify(body.events) }),
      ...(body.active !== undefined && { active: body.active }),
      ...(body.regenerateSecret && { secret: genSecret() }),
    },
  })

  void logAudit({
    action: 'UPDATE', resource: 'webhook', resourceId: webhook.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: body,
  })

  return NextResponse.json({ ...webhook, events: JSON.parse(webhook.events) })
}

// DELETE — remove webhook (admin)
export async function DELETE(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.webhook.delete({ where: { id } })

  void logAudit({
    action: 'DELETE', resource: 'webhook', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
