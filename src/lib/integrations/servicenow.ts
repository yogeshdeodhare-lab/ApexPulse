import type { IntegrationModule } from './types'

function authHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

const URGENCY: Record<string, string> = { critical: '1', warning: '2', info: '3' }

export const servicenow: IntegrationModule = {
  id:          'servicenow',
  label:       'ServiceNow',
  category:    'ITSM',
  authMethod:  'Basic auth / OAuth',
  description: 'Create ITSM tickets for critical alerts',
  fields: [
    { key: 'instanceUrl', label: 'Instance URL', placeholder: 'https://yourinstance.service-now.com' },
    { key: 'username',    label: 'Username',     placeholder: 'integration-user' },
  ],
  secretLabel: 'Password',

  async test({ config, secret }) {
    const start = Date.now()
    if (!config.instanceUrl || !config.username || !secret) {
      return { ok: false, message: 'Instance URL, username, and password are required', latencyMs: 0 }
    }
    try {
      const res = await fetch(`${config.instanceUrl.replace(/\/$/, '')}/api/now/table/sys_user?sysparm_limit=1`, {
        headers: { Authorization: authHeader(config.username, secret), Accept: 'application/json' },
        signal:  AbortSignal.timeout(8_000),
      })
      const latencyMs = Date.now() - start
      if (!res.ok) return { ok: false, message: `ServiceNow responded ${res.status}`, latencyMs }
      return { ok: true, message: 'Connected to ServiceNow instance', latencyMs }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed', latencyMs: Date.now() - start }
    }
  },

  async createTicket({ config, secret }, alert) {
    if (!config.instanceUrl || !config.username || !secret) {
      return { ok: false, error: 'ServiceNow integration is missing required fields' }
    }
    try {
      const urgency = URGENCY[alert.severity] ?? '2'
      const res = await fetch(`${config.instanceUrl.replace(/\/$/, '')}/api/now/table/incident`, {
        method:  'POST',
        headers: { Authorization: authHeader(config.username, secret), 'content-type': 'application/json' },
        body: JSON.stringify({
          short_description: `[APEX Pulse] ${alert.title}`,
          description: `${alert.message} (source: ${alert.source})`,
          urgency, impact: urgency,
        }),
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) return { ok: false, error: `ServiceNow responded ${res.status}` }
      const data = await res.json()
      return { ok: true, url: `${config.instanceUrl.replace(/\/$/, '')}/nav_to.do?uri=incident.do?sys_id=${data.result?.sys_id}` }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Incident creation failed' }
    }
  },
}
