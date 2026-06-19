import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const subs = await prisma.subscription.findMany({ orderBy: { renewalDate: 'asc' } })
  return NextResponse.json(subs)
}

export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  const body = await req.json()
  const { vendor, name, tier, billingCycle, startDate, renewalDate, committedSpend, seats, pricePerSeat, status, notes } = body

  if (!vendor || !name || !startDate) {
    return NextResponse.json({ error: 'vendor, name, startDate required' }, { status: 400 })
  }

  const sub = await prisma.subscription.create({
    data: {
      vendor,
      name,
      tier:          tier          ?? 'usage-based',
      billingCycle:  billingCycle  ?? 'monthly',
      startDate:     new Date(startDate),
      renewalDate:   renewalDate   ? new Date(renewalDate)  : null,
      committedSpend:committedSpend ? Number(committedSpend) : null,
      seats:         seats         ? Number(seats)          : null,
      pricePerSeat:  pricePerSeat  ? Number(pricePerSeat)   : null,
      status:        status        ?? 'active',
      notes:         notes         ?? null,
    },
  })

  void logAudit({
    action: 'CREATE', resource: 'subscription', resourceId: sub.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
    after: sub,
  })

  return NextResponse.json(sub, { status: 201 })
}

export async function PUT(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  const body = await req.json()
  const { id, vendor, name, tier, billingCycle, startDate, renewalDate, committedSpend, seats, pricePerSeat, status, notes } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const before = await prisma.subscription.findUnique({ where: { id } })

  const sub = await prisma.subscription.update({
    where: { id },
    data: {
      ...(vendor         !== undefined && { vendor }),
      ...(name           !== undefined && { name }),
      ...(tier           !== undefined && { tier }),
      ...(billingCycle   !== undefined && { billingCycle }),
      ...(startDate      !== undefined && { startDate: new Date(startDate) }),
      ...(renewalDate    !== undefined && { renewalDate: renewalDate ? new Date(renewalDate) : null }),
      ...(committedSpend !== undefined && { committedSpend: committedSpend ? Number(committedSpend) : null }),
      ...(seats          !== undefined && { seats: seats ? Number(seats) : null }),
      ...(pricePerSeat   !== undefined && { pricePerSeat: pricePerSeat ? Number(pricePerSeat) : null }),
      ...(status         !== undefined && { status }),
      ...(notes          !== undefined && { notes }),
    },
  })

  void logAudit({
    action: 'UPDATE', resource: 'subscription', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
    before, after: sub,
  })

  return NextResponse.json(sub)
}

export async function DELETE(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.subscription.delete({ where: { id } })

  void logAudit({
    action: 'DELETE', resource: 'subscription', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
