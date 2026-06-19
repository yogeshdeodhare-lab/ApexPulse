import type { IntegrationModule } from './types'

function authHeader(email: string, token: string): string {
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`
}

export const jira: IntegrationModule = {
  id:          'jira',
  label:       'Jira',
  category:    'Issue Tracker',
  authMethod:  'OAuth 2.0 / API token (Basic auth)',
  description: 'Create issues for anomalies; tag spend by Jira project',
  fields: [
    { key: 'baseUrl',    label: 'Site URL',     placeholder: 'https://yourcompany.atlassian.net' },
    { key: 'email',      label: 'Account email', placeholder: 'you@company.com' },
    { key: 'projectKey', label: 'Project key',   placeholder: 'FIN' },
  ],
  secretLabel: 'API token',

  async test({ config, secret }) {
    const start = Date.now()
    if (!config.baseUrl || !config.email || !secret) {
      return { ok: false, message: 'Site URL, email, and API token are required', latencyMs: 0 }
    }
    try {
      const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/rest/api/3/myself`, {
        headers: { Authorization: authHeader(config.email, secret), Accept: 'application/json' },
        signal:  AbortSignal.timeout(8_000),
      })
      const latencyMs = Date.now() - start
      if (!res.ok) return { ok: false, message: `Jira responded ${res.status}`, latencyMs }
      const me = await res.json()
      return { ok: true, message: `Connected as ${me.displayName ?? config.email}`, latencyMs }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed', latencyMs: Date.now() - start }
    }
  },

  async createTicket({ config, secret }, alert) {
    if (!config.baseUrl || !config.email || !secret || !config.projectKey) {
      return { ok: false, error: 'Jira integration is missing required fields' }
    }
    try {
      const res = await fetch(`${config.baseUrl.replace(/\/$/, '')}/rest/api/3/issue`, {
        method:  'POST',
        headers: { Authorization: authHeader(config.email, secret), 'content-type': 'application/json' },
        body: JSON.stringify({
          fields: {
            project:   { key: config.projectKey },
            summary:   `[APEX Pulse] ${alert.title}`,
            issuetype: { name: 'Task' },
            description: {
              type: 'doc', version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: `${alert.message} (source: ${alert.source}, severity: ${alert.severity})` }] }],
            },
          },
        }),
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) return { ok: false, error: `Jira responded ${res.status}: ${await res.text().catch(() => '')}` }
      const data = await res.json()
      return { ok: true, url: `${config.baseUrl.replace(/\/$/, '')}/browse/${data.key}` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Issue creation failed' }
    }
  },
}
