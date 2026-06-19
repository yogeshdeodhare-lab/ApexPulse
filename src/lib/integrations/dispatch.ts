import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/vault'
import { INTEGRATIONS, type IntegrationId, type AlertPayload } from './index'

// ServiceNow is reserved for critical alerts per the backlog ("ITSM tickets for
// critical alerts"); Jira/Linear track every new alert as a lightweight task.
const CRITICAL_ONLY: IntegrationId[] = ['servicenow']

// Fire-and-forget: creates tickets/issues in every connected, active integration
// that supports it, for a newly-fired alert. Never throws — ticket creation is
// best-effort and must not block the alert pipeline.
export async function dispatchTickets(alert: AlertPayload): Promise<void> {
  const rows = await prisma.integration.findMany({ where: { active: true } })

  await Promise.allSettled(rows.map(async row => {
    const mod = INTEGRATIONS[row.provider as IntegrationId]
    if (!mod?.createTicket) return
    if (CRITICAL_ONLY.includes(mod.id as IntegrationId) && alert.severity !== 'critical') return

    const creds = { config: JSON.parse(row.config), secret: row.encryptedSecret ? decrypt(row.encryptedSecret) : undefined }
    const result = await mod.createTicket!(creds, alert)
    if (!result.ok) {
      console.error(`[integrations] ${mod.label} ticket creation failed: ${result.error}`)
    }
  }))
}
