import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// GET — list project budgets with current month spend (viewer+)
export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [budgets, usage] = await Promise.all([
    prisma.projectBudget.findMany({ orderBy: { projectId: 'asc' } }),
    prisma.usageRecord.groupBy({
      by:      ['projectId'],
      _sum:    { totalCost: true },
      where:   { timestamp: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }, projectId: { not: null } },
    }),
  ])

  const spendByProject = new Map(usage.map(u => [u.projectId, u._sum.totalCost ?? 0]))

  return NextResponse.json(budgets.map(b => ({
    ...b,
    mtdSpend: spendByProject.get(b.projectId) ?? 0,
    utilPct:  Math.min(100, Math.round(((spendByProject.get(b.projectId) ?? 0) / b.monthlyCapDollars) * 100)),
  })))
}

// POST — create project budget (finance+)
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  const body = await req.json() as {
    projectId: string; monthlyCapDollars: number; alertPct?: number; hardStop?: boolean
  }

  if (!body.projectId || !body.monthlyCapDollars) {
    return NextResponse.json({ error: 'projectId and monthlyCapDollars required' }, { status: 400 })
  }

  const pb = await prisma.projectBudget.upsert({
    where:  { projectId: body.projectId },
    update: { monthlyCapDollars: body.monthlyCapDollars, alertPct: body.alertPct ?? 80, hardStop: body.hardStop ?? false },
    create: { projectId: body.projectId, monthlyCapDollars: body.monthlyCapDollars, alertPct: body.alertPct ?? 80, hardStop: body.hardStop ?? false },
  })

  void logAudit({
    action: 'CREATE', resource: 'project_budget', resourceId: pb.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: body,
  })

  return NextResponse.json(pb, { status: 201 })
}

// PUT — update project budget (finance+)
export async function PUT(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  const body = await req.json() as {
    id: string; monthlyCapDollars?: number; alertPct?: number; hardStop?: boolean; active?: boolean
  }

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const pb = await prisma.projectBudget.update({
    where: { id: body.id },
    data: {
      ...(body.monthlyCapDollars !== undefined && { monthlyCapDollars: body.monthlyCapDollars }),
      ...(body.alertPct          !== undefined && { alertPct:          body.alertPct }),
      ...(body.hardStop          !== undefined && { hardStop:          body.hardStop }),
      ...(body.active            !== undefined && { active:            body.active }),
    },
  })

  void logAudit({
    action: 'UPDATE', resource: 'project_budget', resourceId: pb.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: body,
  })

  return NextResponse.json(pb)
}

// DELETE — remove project budget (admin)
export async function DELETE(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.projectBudget.delete({ where: { id } })

  void logAudit({
    action: 'DELETE', resource: 'project_budget', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
