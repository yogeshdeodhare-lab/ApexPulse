import type { IntegrationModule } from './types'

async function gql(apiKey: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch('https://api.linear.app/graphql', {
    method:  'POST',
    headers: { Authorization: apiKey, 'content-type': 'application/json' },
    body:    JSON.stringify({ query, variables }),
    signal:  AbortSignal.timeout(8_000),
  })
  const json = await res.json()
  if (!res.ok || json.errors) throw new Error(json.errors?.[0]?.message ?? `Linear responded ${res.status}`)
  return json.data
}

export const linear: IntegrationModule = {
  id:          'linear',
  label:       'Linear',
  category:    'Issue Tracker',
  authMethod:  'API key',
  description: 'Create Linear issues for budget alerts',
  fields: [
    { key: 'teamId', label: 'Team ID', placeholder: 'UUID from Team Settings → General' },
  ],
  secretLabel: 'API key',

  async test({ secret }) {
    const start = Date.now()
    if (!secret) return { ok: false, message: 'API key is required', latencyMs: 0 }
    try {
      const data = await gql(secret, '{ viewer { id name } }')
      return { ok: true, message: `Connected as ${data.viewer.name}`, latencyMs: Date.now() - start }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed', latencyMs: Date.now() - start }
    }
  },

  async createTicket({ config, secret }, alert) {
    if (!secret || !config.teamId) return { ok: false, error: 'Linear integration is missing required fields' }
    try {
      const data = await gql(secret, `
        mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id url } } }
      `, {
        input: {
          teamId:      config.teamId,
          title:       `[APEX Pulse] ${alert.title}`,
          description: `${alert.message}\n\n_source: ${alert.source} · severity: ${alert.severity}_`,
        },
      })
      if (!data.issueCreate.success) return { ok: false, error: 'Linear rejected the issue create request' }
      return { ok: true, url: data.issueCreate.issue.url }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Issue creation failed' }
    }
  },
}
