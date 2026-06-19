import webpush from 'web-push'
import { prisma } from '@/lib/db'

function configure(): boolean {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:admin@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return true
}

export interface PushPayload {
  title: string
  body:  string
  tag?:  string
  url?:  string
}

// Broadcasts to every stored subscription — alerts aren't per-user scoped in
// this app (same pattern as the S14 webhook registry and S8 Slack alerts).
// Fire-and-forget: never throws, prunes dead subscriptions (HTTP 404/410) as it goes.
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; pruned: number }> {
  if (!configure()) return { sent: 0, pruned: 0 }

  const subs = await prisma.webPushSubscription.findMany()
  if (subs.length === 0) return { sent: 0, pruned: 0 }

  const body = JSON.stringify(payload)
  let sent = 0
  let pruned = 0

  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      )
      sent++
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await prisma.webPushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
        pruned++
      }
    }
  }))

  return { sent, pruned }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null
}
