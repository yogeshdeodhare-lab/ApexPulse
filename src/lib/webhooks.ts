export interface AlertPayload {
  severity: string
  title:    string
  message:  string
  source:   string
  firedAt:  string
}

export async function fireAlertWebhook(alert: AlertPayload): Promise<boolean> {
  const slackUrl = process.env.SLACK_WEBHOOK_URL
  const httpUrl  = process.env.ALERT_WEBHOOK_URL
  if (!slackUrl && !httpUrl) return false

  const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'
  const jobs: Promise<void>[] = []

  if (slackUrl) {
    jobs.push(
      fetch(slackUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${emoji} *APEX Pulse ${alert.severity.toUpperCase()}*: ${alert.title}`,
          blocks: [
            { type: 'header',  text: { type: 'plain_text', text: `${emoji} ${alert.title}` } },
            { type: 'section', text: { type: 'mrkdwn',     text: alert.message } },
            { type: 'context', elements: [{ type: 'mrkdwn', text: `APEX Pulse · \`${alert.source}\` · ${new Date(alert.firedAt).toLocaleString()}` }] },
          ],
        }),
      }).then(() => {}).catch(() => {})
    )
  }

  if (httpUrl) {
    jobs.push(
      fetch(httpUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event:    'alert.fired',
          severity: alert.severity,
          title:    alert.title,
          message:  alert.message,
          source:   alert.source,
          firedAt:  alert.firedAt,
          platform: 'apex-pulse',
        }),
      }).then(() => {}).catch(() => {})
    )
  }

  const results = await Promise.allSettled(jobs)
  return results.some(r => r.status === 'fulfilled')
}
