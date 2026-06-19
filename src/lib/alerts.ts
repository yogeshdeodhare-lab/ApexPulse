// Outbound alert webhooks — Slack + generic HTTP

interface AlertPayload {
  type:    'budget_threshold' | 'spend_spike' | 'provider_error' | 'daily_summary'
  title:   string
  message: string
  value?:  number
  limit?:  number
  pct?:    number
  team?:   string
  provider?: string
}

export async function sendSlackAlert(payload: AlertPayload): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return  // silently skip if not configured

  const emoji =
    payload.type === 'budget_threshold' ? '🚨' :
    payload.type === 'spend_spike'      ? '⚠️' :
    payload.type === 'provider_error'   ? '🔴' : '📊'

  const body = {
    text: `${emoji} *${payload.title}*`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${emoji} *${payload.title}*\n${payload.message}` },
      },
      ...(payload.value != null ? [{
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Spend*\n$${payload.value.toFixed(2)}` },
          ...(payload.limit != null ? [{ type: 'mrkdwn', text: `*Limit*\n$${payload.limit.toFixed(2)}` }] : []),
          ...(payload.pct   != null ? [{ type: 'mrkdwn', text: `*Utilization*\n${payload.pct}%` }]         : []),
          ...(payload.team  != null ? [{ type: 'mrkdwn', text: `*Team*\n${payload.team}` }]                : []),
        ],
      }] : []),
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `APEX Pulse™ · ${new Date().toISOString()}` }],
      },
    ],
  }

  await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  }).catch(() => {})  // never throw — alerts are best-effort
}

export async function sendWebhookAlert(payload: AlertPayload): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return

  await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-APEX-Event': payload.type },
    body:    JSON.stringify({ ...payload, timestamp: new Date().toISOString(), source: 'apex-pulse' }),
  }).catch(() => {})
}

export async function fireAlert(payload: AlertPayload): Promise<void> {
  await Promise.allSettled([sendSlackAlert(payload), sendWebhookAlert(payload)])
}
