import type { IntegrationModule } from './types'
import { prisma } from '@/lib/db'

function site(config: Record<string, string>): string {
  return config.site || 'datadoghq.com'
}

export const datadog: IntegrationModule = {
  id:          'datadog',
  label:       'Datadog',
  category:    'Observability',
  authMethod:  'API key',
  description: 'Push cost metrics as custom metrics',
  fields: [
    { key: 'site', label: 'Datadog site', placeholder: 'datadoghq.com (or datadoghq.eu, us3.datadoghq.com, …)' },
  ],
  secretLabel: 'API key',

  async test({ config, secret }) {
    const start = Date.now()
    if (!secret) return { ok: false, message: 'API key is required', latencyMs: 0 }
    try {
      const res = await fetch(`https://api.${site(config)}/api/v1/validate`, {
        headers: { 'DD-API-KEY': secret },
        signal:  AbortSignal.timeout(8_000),
      })
      const latencyMs = Date.now() - start
      if (!res.ok) return { ok: false, message: `Datadog responded ${res.status}`, latencyMs }
      const data = await res.json()
      return { ok: data.valid === true, message: data.valid ? 'API key is valid' : 'API key is invalid', latencyMs }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed', latencyMs: Date.now() - start }
    }
  },

  async sync({ config, secret }) {
    if (!secret) return { ok: false, message: 'API key is required' }
    try {
      const now        = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const agg = await prisma.usageRecord.aggregate({
        where: { timestamp: { gte: monthStart } },
        _sum:  { totalCost: true, inputTokens: true, cacheReadTokens: true },
      })
      const mtdSpend = agg._sum.totalCost ?? 0
      const totalEligible = (agg._sum.inputTokens ?? 0) + (agg._sum.cacheReadTokens ?? 0)
      const cacheHitRate = totalEligible > 0 ? (agg._sum.cacheReadTokens ?? 0) / totalEligible : 0
      const ts = Math.floor(now.getTime() / 1000)

      const res = await fetch(`https://api.${site(config)}/api/v1/series`, {
        method:  'POST',
        headers: { 'DD-API-KEY': secret, 'content-type': 'application/json' },
        body: JSON.stringify({
          series: [
            { metric: 'apex_pulse.mtd_spend',      points: [[ts, mtdSpend]],        type: 'gauge', tags: ['source:apex-pulse'] },
            { metric: 'apex_pulse.cache_hit_rate',  points: [[ts, cacheHitRate]],     type: 'gauge', tags: ['source:apex-pulse'] },
          ],
        }),
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) return { ok: false, message: `Datadog responded ${res.status}` }
      return { ok: true, message: 'Pushed mtd_spend and cache_hit_rate', count: 2 }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Sync failed' }
    }
  },
}
