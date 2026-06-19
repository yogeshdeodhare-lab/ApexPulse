import { NextResponse }       from 'next/server'
import { prisma }             from '@/lib/db'
import { getConfigNum }       from '@/lib/config'
import { fireAlertWebhook }   from '@/lib/webhooks'
import { dispatchWebhooks }   from '@/lib/webhook-delivery'
import { dispatchTickets }    from '@/lib/integrations/dispatch'

export const dynamic = 'force-dynamic'

export interface AlertEvent {
  id:         string
  type:       'budget_threshold' | 'seat_roi' | 'cache_efficiency' | 'security' | 'provider_error'
  severity:   'critical' | 'warning' | 'info'
  title:      string
  message:    string
  value?:     number
  threshold?: number
  resolvedAt?: string | null
  firedAt:    string
  source:     string
}

export async function GET() {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const period     = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [budget, mtdAgg, effSnapshots, seatAllocations, recentDenied, warnPct, criticalPct] = await Promise.all([
    prisma.budget.findUnique({ where: { period } }),
    prisma.usageRecord.aggregate({ where: { timestamp: { gte: monthStart } }, _sum: { totalCost: true } }),
    prisma.copilotEffectivenessSnapshot.groupBy({
      by: ['codingTool'],
      where: { dateKey: { gte: new Date(now.getTime() - 30 * 86400_000) } },
      _avg: { acceptanceRate: true, survivalRate: true },
      _count: true,
    }),
    prisma.seatAllocation.findMany({ where: { period } }),
    prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED', timestamp: { gte: new Date(now.getTime() - 7 * 86400_000) } },
      orderBy: { timestamp: 'desc' },
      take: 10,
    }),
    getConfigNum('budget.warn_pct'),
    getConfigNum('budget.critical_pct'),
  ])

  // ── Compute current alert conditions ───────────────────────────────────────

  const computed: AlertEvent[] = []

  if (budget) {
    const mtd = mtdAgg._sum.totalCost ?? 0
    const pct = Math.round((mtd / budget.amount) * 100)
    if (pct >= criticalPct) {
      computed.push({
        id: 'budget-critical', type: 'budget_threshold', severity: 'critical',
        title: `Budget ${pct >= 100 ? 'Exceeded' : 'Critical'} — ${pct}%`,
        message: `MTD spend $${mtd.toFixed(2)} has reached ${pct}% of $${budget.amount.toLocaleString()} budget.`,
        value: mtd, threshold: budget.amount,
        firedAt: now.toISOString(), source: 'budget-monitor',
      })
    } else if (pct >= warnPct) {
      computed.push({
        id: 'budget-warning', type: 'budget_threshold', severity: 'warning',
        title: `Budget Warning — ${pct}%`,
        message: `MTD spend $${mtd.toFixed(2)} has reached ${pct}% of $${budget.amount.toLocaleString()} budget.`,
        value: mtd, threshold: budget.amount,
        firedAt: now.toISOString(), source: 'budget-monitor',
      })
    }
  }

  for (const seat of seatAllocations) {
    const eff = effSnapshots.find(e => e.codingTool === seat.provider)
    if (!eff) continue
    const acceptRate = eff._avg.acceptanceRate ?? 0
    const roiApprox  = (((eff._avg.acceptanceRate ?? 0) * 50 * 22 * 0.05) / (seat.seats * seat.pricePerSeat))
    if (roiApprox < 1.0 || acceptRate < 30) {
      const toolName = (
        { github_copilot: 'GitHub Copilot', cursor: 'Cursor', windsurf: 'Windsurf', claude_code: 'Claude Code' } as Record<string, string>
      )[seat.provider] ?? seat.provider
      computed.push({
        id: `seat-roi-${seat.provider}`, type: 'seat_roi', severity: roiApprox < 0.5 ? 'critical' : 'warning',
        title: `${toolName} ROI below threshold`,
        message: `${toolName} acceptance rate ${acceptRate.toFixed(1)}% on ${seat.seats} seats × $${seat.pricePerSeat}/mo. Estimated ROI ${roiApprox.toFixed(2)}× vs 1.5× target.`,
        value: roiApprox, threshold: 1.5,
        firedAt: now.toISOString(), source: 'effectiveness-monitor',
      })
    }
  }

  const cacheAgg = await prisma.usageRecord.aggregate({
    where: { timestamp: { gte: monthStart }, provider: 'anthropic' },
    _sum: { inputTokens: true, cacheReadTokens: true },
  })
  const totalEligible = (cacheAgg._sum.inputTokens ?? 0) + (cacheAgg._sum.cacheReadTokens ?? 0)
  const cacheHitRate  = totalEligible > 0 ? (cacheAgg._sum.cacheReadTokens ?? 0) / totalEligible : null
  if (cacheHitRate !== null && cacheHitRate < 0.60 && totalEligible > 500_000) {
    computed.push({
      id: 'cache-hit-rate', type: 'cache_efficiency', severity: 'warning',
      title: `Cache hit rate ${Math.round(cacheHitRate * 100)}% — below 60% floor`,
      message: `Anthropic MTD cache hit rate is ${Math.round(cacheHitRate * 100)}%. Enable persistent cache blocks to reduce token spend.`,
      value: Math.round(cacheHitRate * 100), threshold: 65,
      firedAt: now.toISOString(), source: 'cache-monitor',
    })
  }

  if (recentDenied.length >= 3) {
    computed.push({
      id: 'access-denied-spike', type: 'security', severity: 'warning',
      title: `${recentDenied.length} access denied events in past 7 days`,
      message: `${recentDenied.length} unauthorized API calls blocked by RBAC. Check audit log for details.`,
      value: recentDenied.length,
      firedAt: recentDenied[0]?.timestamp.toISOString() ?? now.toISOString(),
      source: 'security-monitor',
    })
  }

  // ── Persist + auto-resolve (best-effort — DB table may not exist yet) ───────

  let resolved: AlertEvent[] = []

  try {
    const dbActive     = await prisma.alertEvent.findMany({ where: { active: true } })
    const computedKeys = new Set(computed.map(a => a.id))

    for (const c of computed) {
      if (!dbActive.find(d => d.alertKey === c.id)) {
        const evt = await prisma.alertEvent.create({
          data: {
            alertKey: c.id, type: c.type, severity: c.severity,
            title: c.title, message: c.message,
            value: c.value ?? null, threshold: c.threshold ?? null,
            source: c.source,
          },
        })
        const sent = await fireAlertWebhook({
          severity: c.severity, title: c.title, message: c.message,
          source: c.source, firedAt: evt.firedAt.toISOString(),
        })
        if (sent) {
          await prisma.alertEvent.update({ where: { id: evt.id }, data: { webhookSent: true } })
        }
        // Registered webhooks (S14) — fire-and-forget, retries happen in the background
        void dispatchWebhooks(c.type, {
          title: c.title, message: c.message, severity: c.severity,
          value: c.value, threshold: c.threshold, source: c.source,
        })
        // Connected integrations (S15) — Jira/Linear issues, ServiceNow incidents for critical alerts
        void dispatchTickets({ title: c.title, message: c.message, severity: c.severity, source: c.source })
      }
    }

    for (const db of dbActive) {
      if (!computedKeys.has(db.alertKey)) {
        await prisma.alertEvent.update({
          where: { id: db.id },
          data:  { active: false, resolvedAt: now },
        })
      }
    }

    const dbResolved = await prisma.alertEvent.findMany({
      where:   { active: false, resolvedAt: { gte: new Date(now.getTime() - 30 * 86400_000) } },
      orderBy: { resolvedAt: 'desc' },
      take:    20,
    })
    resolved = dbResolved.map(r => ({
      id:         r.id,
      type:       r.type       as AlertEvent['type'],
      severity:   r.severity   as AlertEvent['severity'],
      title:      r.title,
      message:    r.message,
      value:      r.value      ?? undefined,
      threshold:  r.threshold  ?? undefined,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      firedAt:    r.firedAt.toISOString(),
      source:     r.source,
    }))
  } catch {
    // AlertEvent table may not exist until `prisma db push` is run
  }

  const active = computed
  return NextResponse.json({
    active,
    resolved,
    total:         active.length + resolved.length,
    criticalCount: active.filter(a => a.severity === 'critical').length,
    warningCount:  active.filter(a => a.severity === 'warning').length,
  })
}
