import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

interface SubscribeBody {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

// POST — register a browser push subscription (any logged-in user/device).
export async function POST(req: NextRequest) {
  const body = await req.json() as SubscribeBody
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'endpoint and keys.{p256dh,auth} required' }, { status: 400 })
  }

  await prisma.webPushSubscription.upsert({
    where:  { endpoint: body.endpoint },
    update: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    create: {
      endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth,
      userId: req.headers.get('x-user-id') ?? undefined,
      userEmail: req.headers.get('x-user-email') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    },
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE — unsubscribe (?endpoint=...)
export async function DELETE(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 })

  await prisma.webPushSubscription.deleteMany({ where: { endpoint } })
  return NextResponse.json({ ok: true })
}
