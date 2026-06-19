import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/push'

export const dynamic = 'force-dynamic'

// GET — the public VAPID key the client needs to call pushManager.subscribe().
export async function GET() {
  const key = getVapidPublicKey()
  if (!key) return NextResponse.json({ error: 'Push notifications are not configured (VAPID keys missing)' }, { status: 503 })
  return NextResponse.json({ publicKey: key })
}
