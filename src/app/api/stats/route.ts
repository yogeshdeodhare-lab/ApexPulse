import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CLAUDE_PRICING, PROVIDER_CATALOG, getAnyModelPricing } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const day14Ago   = new Date(now)
  day14Ago.setDate(day14Ago.getDate() - 13)
  day14Ago.setHours(0, 0, 0, 0)

  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [mtdAgg, budget, allRecords14d, projectAgg, modelAgg, providerAgg] = await Promise.all([
    prisma.usageRecord.aggregate({
      where: { timestamp: { gte: monthStart } },
      _sum: {
        totalCost: true, inputTokens: true, outputTokens: true,
        cacheReadTokens: true, cacheWriteTokens: true,
      },
      _count: true,
    }),

    prisma.budget.findUnique({ where: { period: thisMonth } }),

    prisma.usageRecord.findMany({
      where: { timestamp: { gte: day14Ago } },
      select: { timestamp: true, inputTokens: true, outputTokens: true,
                cacheReadTokens: true, cacheWriteTokens: true, totalCost: true },
      orderBy: { timestamp: 'asc' },
    }),

    prisma.usageRecord.groupBy({
      by: ['projectId'],
      where: { timestamp: { gte: monthStart } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
      orderBy: { _sum: { totalCost: 'desc' } },
    }),

    prisma.usageRecord.groupBy({
      by: ['model'],
      where: { timestamp: { gte: monthStart } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
    }),

    prisma.usageRecord.groupBy({
      by: ['provider'],
      where: { timestamp: { gte: monthStart } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
  ])

  const mtdSpend   = mtdAgg._sum.totalCost       ?? 0
  const mtdInputT  = mtdAgg._sum.inputTokens     ?? 0
  const mtdOutputT = mtdAgg._sum.outputTokens    ?? 0
  const mtdCacheT  = mtdAgg._sum.cacheReadTokens ?? 0
  const mtdRequests= mtdAgg._count

  const mtdTokens    = mtdInputT + mtdOutputT + mtdCacheT
  const cacheHitRate = mtdInputT + mtdCacheT > 0
    ? Math.round((mtdCacheT / (mtdInputT + mtdCacheT)) * 100)
    : 0

  // ── 14-day daily trend ────────────────────────────────────────────────────
  const dayMap = new Map<string, { billable: number; cached: number }>()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dayMap.set(d.toISOString().slice(0, 10), { billable: 0, cached: 0 })
  }

  for (const r of allRecords14d) {
    const key = (r.timestamp as Date).toISOString().slice(0, 10)
    if (dayMap.has(key)) {
      const entry = dayMap.get(key)!
      entry.billable = Math.round((entry.billable + (r.inputTokens + r.outputTokens) / 1_000_000) * 100) / 100
      entry.cached   = Math.round((entry.cached   + r.cacheReadTokens / 1_000_000)                 * 100) / 100
    }
  }

  const dailyTrend = Array.from(dayMap.entries()).map(([dateStr, v]) => {
    const [, m, day] = dateStr.split('-')
    return { date: `${parseInt(m, 10)}/${parseInt(day, 10)}`, ...v }
  })

  // ── Provider mix (for donut) ──────────────────────────────────────────────
  const totalProviderCost = providerAgg.reduce((s, p) => s + (p._sum.totalCost ?? 0), 0)
  const providerMix = providerAgg
    .map(p => {
      const id   = p.provider ?? 'anthropic'
      const info = PROVIDER_CATALOG[id]
      return {
        provider: id,
        name:     info?.name  ?? id,
        color:    info?.color ?? '#60a5fa',
        cost:     p._sum.totalCost ?? 0,
        tokens:   (p._sum.inputTokens ?? 0) + (p._sum.outputTokens ?? 0),
        requests: p._count,
        pct:      totalProviderCost > 0
          ? Math.round(((p._sum.totalCost ?? 0) / totalProviderCost) * 100)
          : 0,
      }
    })
    .sort((a, b) => b.cost - a.cost)

  // ── Model mix (detailed, cross-provider) ──────────────────────────────────
  const totalModelCost = modelAgg.reduce((s, m) => s + (m._sum.totalCost ?? 0), 0)
  const modelMix = modelAgg
    .map(m => {
      const pricing = getAnyModelPricing(m.model)
      return {
        model:       m.model,
        displayName: pricing.shortName,
        tier:        pricing.tier,
        color:       pricing.color,
        cost:        m._sum.totalCost ?? 0,
        tokens:      (m._sum.inputTokens ?? 0) + (m._sum.outputTokens ?? 0),
        requests:    m._count,
        pct:         totalModelCost > 0
          ? Math.round(((m._sum.totalCost ?? 0) / totalModelCost) * 100)
          : 0,
      }
    })
    .sort((a, b) => b.cost - a.cost)

  // ── Project breakdown ─────────────────────────────────────────────────────
  const projectBreakdown = projectAgg.map(p => ({
    projectId:   p.projectId ?? 'unattributed',
    cost:        p._sum.totalCost    ?? 0,
    tokens:      (p._sum.inputTokens ?? 0) + (p._sum.outputTokens ?? 0),
    requests:    p._count,
    cacheTokens: p._sum.cacheReadTokens ?? 0,
  }))

  // ── Budget status ─────────────────────────────────────────────────────────
  const budgetStatus = budget
    ? {
        amount:         budget.amount,
        consumed:       mtdSpend,
        remaining:      Math.max(0, budget.amount - mtdSpend),
        utilizationPct: Math.min(100, Math.round((mtdSpend / budget.amount) * 100)),
      }
    : null

  // ── Cache savings (Anthropic-only — only Claude supports prompt caching) ──
  const anthropicMix = modelMix.filter(m => CLAUDE_PRICING[m.model])
  const avgInputPrice = anthropicMix.length > 0
    ? anthropicMix.reduce((s, m) => {
        const p = CLAUDE_PRICING[m.model]
        return s + (p ? p.input * (m.cost / Math.max(totalModelCost, 1)) : 0)
      }, 0)
    : 3.0
  const cacheSavings = (mtdCacheT / 1_000_000) * (avgInputPrice * 0.90)

  return NextResponse.json({
    mtdSpend,
    mtdTokens,
    mtdRequests,
    cacheHitRate,
    avgCostPerRequest: mtdRequests > 0 ? mtdSpend / mtdRequests : 0,
    cacheSavings,
    dailyTrend,
    providerMix,
    modelMix,
    projectBreakdown,
    budget: budgetStatus,
  })
}
