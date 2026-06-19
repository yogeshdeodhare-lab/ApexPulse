import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { evaluateRules } from '@/lib/budget-rules'

function callerRole(req: NextRequest) { return req.headers.get('x-user-role') ?? null }

export const dynamic = 'force-dynamic'

// POST — evaluate all active rules against current month spend
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'finance')) {
    return NextResponse.json({ error: 'Forbidden — finance role required' }, { status: 403 })
  }

  // Compute current month's spend %
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [usage, budget] = await Promise.all([
    prisma.usageRecord.aggregate({ _sum: { totalCost: true }, where: { timestamp: { gte: start } } }),
    prisma.budget.findUnique({ where: { period } }),
  ])

  const mtdSpend = usage._sum.totalCost ?? 0
  const spendPct = budget?.amount ? Math.min(100, (mtdSpend / budget.amount) * 100) : 0

  const result = await evaluateRules(spendPct)

  return NextResponse.json({
    spendPct:  Math.round(spendPct * 10) / 10,
    mtdSpend,
    budget:    budget?.amount ?? null,
    ...result,
  })
}
