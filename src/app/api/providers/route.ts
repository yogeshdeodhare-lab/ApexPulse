import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { PROVIDER_CATALOG, SEAT_PROVIDERS, PROVIDER_TABLES } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [byProvider, byProviderModel, seatAllocations] = await Promise.all([
    prisma.usageRecord.groupBy({
      by: ['provider'],
      where: { timestamp: { gte: monthStart } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
    }),

    prisma.usageRecord.groupBy({
      by: ['provider', 'model'],
      where: { timestamp: { gte: monthStart } },
      _sum: { totalCost: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),

    prisma.seatAllocation.findMany({ where: { period: thisMonth } }),
  ])

  // Build per-model index keyed by "provider::model"
  const modelIdx = new Map<string, typeof byProviderModel[0]>()
  for (const row of byProviderModel) {
    modelIdx.set(`${row.provider}::${row.model}`, row)
  }

  // Token-based provider cards
  const tokenProviders = byProvider.map(row => {
    const provider = row.provider ?? 'anthropic'
    const info     = PROVIDER_CATALOG[provider] ?? { name: provider, color: '#60a5fa', billingType: 'token' as const, models: [] }
    const table    = PROVIDER_TABLES[provider] ?? {}

    const mtdSpend    = row._sum.totalCost    ?? 0
    const mtdTokens   = (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0)
    const mtdRequests = row._count

    // Per-model breakdown for this provider
    const models = byProviderModel
      .filter(r => r.provider === provider)
      .map(r => {
        const pricing = table[r.model]
        return {
          id:       r.model,
          name:     pricing?.shortName ?? r.model,
          color:    pricing?.color     ?? '#60a5fa',
          cost:     r._sum.totalCost   ?? 0,
          tokens:   (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
          requests: r._count,
          pct:      mtdSpend > 0
            ? Math.round(((r._sum.totalCost ?? 0) / mtdSpend) * 100)
            : 0,
        }
      })
      .sort((a, b) => b.cost - a.cost)

    const topModel = models[0]?.name ?? '—'

    return {
      id:          provider,
      name:        info.name,
      color:       info.color,
      mtdSpend,
      mtdTokens,
      mtdRequests,
      topModel,
      models,
    }
  }).sort((a, b) => b.mtdSpend - a.mtdSpend)

  // Seat-based provider cards
  const seatProviders = seatAllocations.map(sa => {
    const info = SEAT_PROVIDERS[sa.provider] ?? { name: sa.provider, color: '#8a91a6', pricePerSeat: sa.pricePerSeat }
    return {
      id:          sa.provider,
      name:        info.name,
      color:       info.color,
      seats:       sa.seats,
      pricePerSeat:sa.pricePerSeat,
      mtdSpend:    sa.seats * sa.pricePerSeat,
      period:      sa.period,
    }
  }).sort((a, b) => b.mtdSpend - a.mtdSpend)

  const tokenTotal = tokenProviders.reduce((s, p) => s + p.mtdSpend, 0)
  const seatTotal  = seatProviders.reduce((s, p) => s + p.mtdSpend, 0)

  return NextResponse.json({
    tokenProviders,
    seatProviders,
    totalMtdSpend: tokenTotal + seatTotal,
    totalTokenSpend: tokenTotal,
    totalSeatSpend: seatTotal,
    totalSeats: seatProviders.reduce((s, p) => s + p.seats, 0),
  })
}
