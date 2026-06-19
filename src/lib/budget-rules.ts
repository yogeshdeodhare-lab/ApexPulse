import { prisma } from '@/lib/db'
import { dispatchWebhooks } from '@/lib/webhook-delivery'

export type ActionType = 'notify_slack' | 'notify_webhook' | 'config_write' | 'log_only'

export interface RuleAction {
  type:     ActionType
  message?: string
  key?:     string
  value?:   string
}

interface ActionResult { type: string; ok: boolean; error?: string }

async function execAction(action: RuleAction, spendPct: number, ruleName: string): Promise<void> {
  const msg = (action.message ?? `APEX Pulse rule "${ruleName}" fired — budget at ${spendPct.toFixed(1)}%`)
    .replace(/\{\{pct\}\}/g, spendPct.toFixed(1))

  switch (action.type) {
    case 'notify_slack': {
      const url = process.env.SLACK_WEBHOOK_URL
      if (!url) throw new Error('SLACK_WEBHOOK_URL not set')
      const r = await fetch(url, {
        method:  'POST',
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify({ text: `🚨 *Budget Rule Fired* — ${msg}` }),
        signal:  AbortSignal.timeout(8_000),
      })
      if (!r.ok) throw new Error(`Slack responded ${r.status}`)
      break
    }
    case 'notify_webhook': {
      const url = process.env.ALERT_WEBHOOK_URL
      if (!url) throw new Error('ALERT_WEBHOOK_URL not set')
      const r = await fetch(url, {
        method:  'POST',
        headers: { 'content-type': 'application/json', 'x-apex-pulse': 'budget-rule' },
        body:    JSON.stringify({ type: 'budget_rule', rule: ruleName, pct: spendPct, message: msg, ts: new Date().toISOString() }),
        signal:  AbortSignal.timeout(8_000),
      })
      if (!r.ok) throw new Error(`Webhook responded ${r.status}`)
      break
    }
    case 'config_write': {
      if (!action.key || action.value === undefined) throw new Error('config_write needs key + value')
      await prisma.appConfig.upsert({
        where:  { key: action.key },
        update: { value: action.value, updatedBy: 'budget-rules-engine', updatedAt: new Date() },
        create: { key: action.key, value: action.value, description: `Auto-set by rule: ${ruleName}`, updatedBy: 'budget-rules-engine' },
      })
      break
    }
    case 'log_only':
    default:
      break
  }
}

export async function evaluateRules(spendPct: number): Promise<{ fired: number; results: unknown[] }> {
  const rules  = await prisma.budgetRule.findMany({ where: { active: true } })
  const now    = new Date()
  let   fired  = 0
  const results: unknown[] = []

  for (const rule of rules) {
    if (spendPct < rule.triggerPct) continue

    // Cooldown: skip if fired recently
    if (rule.lastFiredAt) {
      const elapsedMs = now.getTime() - rule.lastFiredAt.getTime()
      if (elapsedMs < rule.cooldownHours * 3_600_000) continue
    }

    const actions: RuleAction[] = JSON.parse(rule.actions as string)
    const actionLog: ActionResult[] = []
    let   success    = true
    let   firstError: string | undefined

    for (const action of actions) {
      try {
        await execAction(action, spendPct, rule.name)
        actionLog.push({ type: action.type, ok: true })
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e)
        actionLog.push({ type: action.type, ok: false, error: err })
        success   = false
        firstError ??= err
      }
    }

    await Promise.all([
      prisma.budgetRule.update({ where: { id: rule.id }, data: { lastFiredAt: now } }),
      prisma.ruleExecution.create({
        data: { ruleId: rule.id, spendPct, actions: JSON.stringify(actionLog), success, error: firstError },
      }),
    ])

    fired++
    results.push({ ruleId: rule.id, ruleName: rule.name, triggerPct: rule.triggerPct, actionLog, success })

    // Registered webhooks (S14) subscribed to "budget_rule" — fire-and-forget
    void dispatchWebhooks('budget_rule', {
      title:    `Budget Rule Fired — ${rule.name}`,
      message:  `Rule "${rule.name}" triggered at ${spendPct.toFixed(1)}% spend (threshold ${rule.triggerPct}%).`,
      severity: success ? 'warning' : 'critical',
      value:    spendPct, threshold: rule.triggerPct, source: 'budget-rules-engine',
    })
  }

  return { fired, results }
}
