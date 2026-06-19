import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/vault'
import { getConfigNum } from '@/lib/config'

export const dynamic = 'force-dynamic'

async function verifyToken(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const token = auth.slice(7)

  const row = await prisma.integration.findUnique({ where: { provider: 'grafana' } })
  if (!row?.active || !row.encryptedSecret) return false
  return decrypt(row.encryptedSecret) === token
}

function metric(name: string, help: string, type: 'gauge' | 'counter', value: number): string {
  return `# HELP ${name} ${help}\n# TYPE ${name} ${type}\n${name} ${value}\n`
}

// GET — Prometheus text-exposition format, scraped by Grafana/Prometheus.
// Bearer-token gated (the token is the grafana Integration's auto-generated secret),
// not session-gated — this path is public in middleware so external scrapers can reach it.
export async function GET(req: NextRequest) {
  if (!(await verifyToken(req))) {
    return new NextResponse('Unauthorized\n', { status: 401, headers: { 'content-type': 'text/plain' } })
  }

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const period     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [agg, budget, activeAlerts] = await Promise.all([
    prisma.usageRecord.aggregate({
      where: { timestamp: { gte: monthStart } },
      _sum:  { totalCost: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
    }),
    prisma.budget.findUnique({ where: { period } }),
    prisma.alertEvent.count({ where: { active: true } }).catch(() => 0),
  ])

  const mtdSpend       = agg._sum.totalCost ?? 0
  const mtdTokens      = (agg._sum.inputTokens ?? 0) + (agg._sum.outputTokens ?? 0) + (agg._sum.cacheReadTokens ?? 0)
  const totalEligible  = (agg._sum.inputTokens ?? 0) + (agg._sum.cacheReadTokens ?? 0)
  const cacheHitRate   = totalEligible > 0 ? (agg._sum.cacheReadTokens ?? 0) / totalEligible : 0
  const budgetUtilPct  = budget ? (mtdSpend / budget.amount) * 100 : 0
  const warnPct        = await getConfigNum('budget.warn_pct')

  const body = [
    metric('apex_pulse_mtd_spend_dollars',       'Month-to-date spend in USD',           'gauge', mtdSpend),
    metric('apex_pulse_mtd_tokens_total',        'Month-to-date token count',            'gauge', mtdTokens),
    metric('apex_pulse_mtd_requests_total',      'Month-to-date request count',          'gauge', agg._count),
    metric('apex_pulse_cache_hit_rate',          'Cache hit rate (0-1)',                 'gauge', cacheHitRate),
    metric('apex_pulse_budget_utilization_pct',  'Budget utilization percentage',        'gauge', budgetUtilPct),
    metric('apex_pulse_budget_warn_threshold_pct','Configured budget warn threshold %',  'gauge', warnPct),
    metric('apex_pulse_active_alerts_total',     'Currently active alerts',              'gauge', activeAlerts),
  ].join('\n')

  return new NextResponse(body, { status: 200, headers: { 'content-type': 'text/plain; version=0.0.4' } })
}
