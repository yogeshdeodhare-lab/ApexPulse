import crypto from 'crypto'
import { prisma } from '@/lib/db'

export type WebhookType = 'slack' | 'http' | 'pagerduty' | 'teams'

export const EVENT_TYPES = [
  { id: 'budget_threshold', label: 'Budget Threshold' },
  { id: 'seat_roi',         label: 'Seat ROI' },
  { id: 'cache_efficiency', label: 'Cache Efficiency' },
  { id: 'security',         label: 'Security' },
  { id: 'budget_rule',      label: 'Budget Rule Fired' },
] as const

export interface DispatchPayload {
  title:     string
  message:   string
  severity?: string
  value?:    number
  threshold?: number
  source?:   string
}

interface WebhookLike {
  id:     string
  url:    string
  type:   string
  name:   string
  secret: string
}

interface AttemptResult {
  success:    boolean
  statusCode?: number
  error?:     string
  latencyMs:  number
}

export function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

export function genSecret(): string {
  return crypto.randomBytes(24).toString('hex')
}

function formatBody(webhook: { type: string }, eventType: string, payload: DispatchPayload): string {
  const emoji = payload.severity === 'critical' ? '🚨' : payload.severity === 'warning' ? '⚠️' : 'ℹ️'

  if (webhook.type === 'slack') {
    return JSON.stringify({
      text: `${emoji} *${payload.title}*`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `${emoji} *${payload.title}*\n${payload.message}` } },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `APEX Pulse · \`${payload.source ?? 'apex-pulse'}\` · ${new Date().toLocaleString()}` }] },
      ],
    })
  }

  if (webhook.type === 'teams') {
    return JSON.stringify({
      '@type':    'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary:    payload.title,
      themeColor: payload.severity === 'critical' ? 'E24B4A' : payload.severity === 'warning' ? 'C98A20' : '378ADD',
      sections:   [{ activityTitle: payload.title, text: payload.message }],
    })
  }

  if (webhook.type === 'pagerduty') {
    return JSON.stringify({
      event_action: 'trigger',
      payload: {
        summary:  payload.title,
        severity: payload.severity ?? 'warning',
        source:   payload.source ?? 'apex-pulse',
      },
    })
  }

  // generic http
  return JSON.stringify({
    event:    eventType,
    title:    payload.title,
    message:  payload.message,
    severity: payload.severity,
    value:    payload.value,
    threshold: payload.threshold,
    source:   payload.source ?? 'apex-pulse',
    platform: 'apex-pulse',
    timestamp: new Date().toISOString(),
  })
}

async function attempt(webhook: WebhookLike, eventType: string, payload: DispatchPayload, attemptNum: number, persist: boolean): Promise<AttemptResult> {
  const body      = formatBody(webhook, eventType, payload)
  const signature = sign(webhook.secret, body)
  const start     = Date.now()
  let statusCode: number | undefined
  let success     = false
  let error: string | undefined

  try {
    const res = await fetch(webhook.url, {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'x-apex-signature': signature, 'x-apex-event': eventType },
      body,
      signal:  AbortSignal.timeout(8_000),
    })
    statusCode = res.status
    success    = res.ok
    if (!res.ok) error = `HTTP ${res.status}`
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  }

  const latencyMs = Date.now() - start

  if (persist) {
    await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id, eventType, statusCode, latencyMs,
        success, attempt: attemptNum, error, payload: body,
      },
    })
  }

  return { success, statusCode, error, latencyMs }
}

const BACKOFF_MS = [0, 2_000, 8_000] // immediate, +2s, +8s — up to 3 attempts total

async function deliverWithRetry(webhook: WebhookLike, eventType: string, payload: DispatchPayload): Promise<AttemptResult> {
  let result: AttemptResult | undefined
  for (let i = 0; i < BACKOFF_MS.length; i++) {
    if (BACKOFF_MS[i] > 0) await new Promise(r => setTimeout(r, BACKOFF_MS[i]))
    result = await attempt(webhook, eventType, payload, i + 1, true)
    if (result.success) return result
  }
  return result!
}

// Fire-and-forget dispatch to every active webhook subscribed to this event type.
// Never throws — call with `void dispatchWebhooks(...)` from request handlers.
export async function dispatchWebhooks(eventType: string, payload: DispatchPayload): Promise<{ dispatched: number }> {
  const webhooks = await prisma.webhook.findMany({ where: { active: true } })
  const matching = webhooks.filter(w => {
    try {
      const events: string[] = JSON.parse(w.events)
      return events.includes('*') || events.includes(eventType)
    } catch {
      return false
    }
  })

  await Promise.allSettled(matching.map(w => deliverWithRetry(w, eventType, payload)))

  return { dispatched: matching.length }
}

// Single-attempt test delivery — used by the "Send test" button, no retry.
// `persist` is false for unsaved drafts (no Webhook row to attach the delivery to).
export async function testDeliver(webhook: WebhookLike, payload: DispatchPayload, persist = true): Promise<AttemptResult> {
  return attempt(webhook, 'test', payload, 1, persist)
}
