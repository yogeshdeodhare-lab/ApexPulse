import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// GET — list rules with recent execution count (viewer+)
export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rules = await prisma.budgetRule.findMany({ orderBy: { createdAt: 'asc' } })

  // Fetch recent executions for all rules in one query
  const executions = await prisma.ruleExecution.findMany({
    where:   { ruleId: { in: rules.map(r => r.id) } },
    orderBy: { firedAt: 'desc' },
    take:    50,
  })

  const execByRule = new Map<string, typeof executions>()
  for (const e of executions) {
    const arr = execByRule.get(e.ruleId) ?? []
    arr.push(e)
    execByRule.set(e.ruleId, arr)
  }

  return NextResponse.json({
    rules: rules.map(r => ({
      ...r,
      recentExecutions: (execByRule.get(r.id) ?? []).slice(0, 5),
    })),
    executions: executions.slice(0, 20),
  })
}

// POST — create rule (finance+)
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  const body = await req.json() as {
    name: string; triggerPct: number; actions: string
    cooldownHours?: number; active?: boolean
  }

  if (!body.name || body.triggerPct == null || !body.actions) {
    return NextResponse.json({ error: 'name, triggerPct, actions required' }, { status: 400 })
  }

  const rule = await prisma.budgetRule.create({
    data: {
      name:         body.name,
      triggerPct:   body.triggerPct,
      actions:      body.actions,
      cooldownHours: body.cooldownHours ?? 4,
      active:       body.active ?? true,
    },
  })

  void logAudit({
    action: 'CREATE', resource: 'budget_rule', resourceId: rule.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { name: rule.name, triggerPct: rule.triggerPct },
  })

  return NextResponse.json(rule, { status: 201 })
}

// PUT — update rule (finance+)
export async function PUT(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  const body = await req.json() as {
    id: string; name?: string; triggerPct?: number; actions?: string
    cooldownHours?: number; active?: boolean
  }

  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const rule = await prisma.budgetRule.update({
    where: { id: body.id },
    data: {
      ...(body.name         !== undefined && { name:         body.name }),
      ...(body.triggerPct   !== undefined && { triggerPct:   body.triggerPct }),
      ...(body.actions      !== undefined && { actions:      body.actions }),
      ...(body.cooldownHours !== undefined && { cooldownHours: body.cooldownHours }),
      ...(body.active       !== undefined && { active:       body.active }),
    },
  })

  void logAudit({
    action: 'UPDATE', resource: 'budget_rule', resourceId: rule.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: body,
  })

  return NextResponse.json(rule)
}

// DELETE — remove rule (admin)
export async function DELETE(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.budgetRule.delete({ where: { id } })

  void logAudit({
    action: 'DELETE', resource: 'budget_rule', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
