'use client'

import { useEffect, useState } from 'react'
import { mono } from '@/components/ui'

const LAST_SYNC_KEY = 'apex-pulse-last-sync'

export function markSynced() {
  try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()) } catch {}
}

function relTime(iso: string | null): string {
  if (!iso) return 'unknown'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

export default function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => {
    setOnline(navigator.onLine)
    const goOnline  = () => setOnline(true)
    const goOffline = () => {
      try { setLastSync(localStorage.getItem(LAST_SYNC_KEY)) } catch {}
      setOnline(false)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div
      className={`${mono} fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 text-[10.5px] py-1.5`}
      style={{ background: '#C98A20', color: '#071E3D' }}
    >
      <span>⚠ Offline — showing cached data from {relTime(lastSync)}</span>
    </div>
  )
}
