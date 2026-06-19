import type { IntegrationModule } from './types'

// Grafana is the inverse of the other integrations: instead of us calling out
// to Grafana, Grafana (via Prometheus remote-read or a scrape job) calls IN to
// our own GET /api/metrics endpoint with a Bearer token we generate on connect.
export const grafana: IntegrationModule = {
  id:          'grafana',
  label:       'Grafana',
  category:    'Observability',
  authMethod:  'Token-based (bearer)',
  description: 'Expose /api/metrics Prometheus endpoint',
  fields:      [],
  secretLabel: null, // auto-generated scrape token, not user-provided

  async test({ secret }) {
    const start = Date.now()
    if (!secret) return { ok: false, message: 'No scrape token configured', latencyMs: 0 }
    try {
      const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
      const res  = await fetch(`${base}/api/metrics`, {
        headers: { Authorization: `Bearer ${secret}` },
        signal:  AbortSignal.timeout(8_000),
      })
      const latencyMs = Date.now() - start
      if (!res.ok) return { ok: false, message: `/api/metrics responded ${res.status}`, latencyMs }
      const body = await res.text()
      const lines = body.split('\n').filter(l => l && !l.startsWith('#')).length
      return { ok: true, message: `Endpoint reachable — ${lines} metric samples`, latencyMs }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Self-test failed', latencyMs: Date.now() - start }
    }
  },
}
