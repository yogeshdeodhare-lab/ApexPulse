import { NextRequest, NextResponse } from 'next/server'
import { prisma }    from '@/lib/db'
import { fireAlert } from '@/lib/alerts'
import { dispatchWebhooks } from '@/lib/webhook-delivery'
import { can }       from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'
import { getConfigNum } from '@/lib/config'

export const dynamic = 'force-dynamic'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function session(req: NextRequest) {
  return {
    id:    req.headers.get('x-user-id')    ?? 'anon',
    email: req.headers.get('x-user-email') ?? '',
    role:  req.headers.get('x-user-role')  ?? (process.env.NEXTAUTH_SECRET ? 'viewer' : 'admin'),
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? currentPeriod()

  const budget = await prisma.budget.findUnique({ where: { period } })
  if (!budget) return NextResponse.json(null)

  return NextResponse.json(budget)
}

export async function POST(req: NextRequest) {
  const s = session(req)
  if (!can(s.role, 'budget:write')) {
    void logAudit({
      action: 'ACCESS_DENIED', resource: 'budget',
      userId: s.id, userEmail: s.email, ipAddress: getClientIp(req),
      metadata: { required: 'finance', actual: s.role },
    })
    return NextResponse.json({ error: 'Forbidden — finance or admin role required' }, { status: 403 })
  }

  const { amount, period = currentPeriod() } = await req.json()

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  const existing = await prisma.budget.findUnique({ where: { period } })

  const budget = await prisma.budget.upsert({
    where: { period },
    update: { amount },
    create: { period, amount },
  })

  void logAudit({
    action: existing ? 'UPDATE' : 'CREATE', resource: 'budget', resourceId: period,
    userId: s.id, userEmail: s.email, ipAddress: getClientIp(req),
    before: existing ? { amount: existing.amount } : undefined,
    after:  { amount },
  })

  // Read alert thresholds from config (configurable without redeploy)
  const [warnPct, criticalPct] = await Promise.all([
    getConfigNum('budget.warn_pct'),
    getConfigNum('budget.critical_pct'),
  ])

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const agg = await prisma.usageRecord.aggregate({
    where: { timestamp: { gte: monthStart } },
    _sum:  { totalCost: true },
  })
  const mtdSpend = agg._sum.totalCost ?? 0
  const pct = Math.round((mtdSpend / amount) * 100)

  if (pct >= warnPct) {
    const title = `Budget ${pct >= 100 ? 'Exceeded' : pct >= criticalPct ? 'Critical' : 'Elevated'} — ${pct}%`
    const message = `MTD spend $${mtdSpend.toFixed(2)} has reached ${pct}% of $${amount} budget for ${period}.`
    await fireAlert({ type: 'budget_threshold', title, message, value: mtdSpend, limit: amount, pct })
    void dispatchWebhooks('budget_threshold', {
      title, message, source: 'budget-monitor',
      severity: pct >= criticalPct ? 'critical' : 'warning',
      value: mtdSpend, threshold: amount,
    })
  }

  return NextResponse.json(budget, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const s = session(req)
  if (!can(s.role, 'budget:write')) {
    void logAudit({
      action: 'ACCESS_DENIED', resource: 'budget',
      userId: s.id, userEmail: s.email, ipAddress: getClientIp(req),
      metadata: { required: 'finance', actual: s.role },
    })
    return NextResponse.json({ error: 'Forbidden — finance or admin role required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? currentPeriod()

  await prisma.budget.deleteMany({ where: { period } })

  void logAudit({
    action: 'DELETE', resource: 'budget', resourceId: period,
    userId: s.id, userEmail: s.email, ipAddress: getClientIp(req),
  })

  return new NextResponse(null, { status: 204 })
}
