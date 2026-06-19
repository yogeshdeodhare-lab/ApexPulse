// APEX Pulse service worker — S19
// App icons/manifest: cache-first (genuinely immutable — same URL forever).
// Next.js build chunks (/_next/static/): network-first. In production these
//   paths are content-hashed per build and would be safe to cache-first, but
//   Next's *dev* server reuses the same chunk URLs across recompiles, so
//   cache-first would pin a stale bundle until a hard cache purge — not worth
//   the risk for the marginal offline benefit of an extra round trip.
// API GETs: network-first, falling back to the last cached response when offline
//   (this is what powers the "stale data while offline" banner in the app).
// Push: displays a system notification for budget/incident alerts.

const STATIC_CACHE = 'apex-pulse-static-v2'
const API_CACHE    = 'apex-pulse-api-v1'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll([
      '/manifest.json', '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.png',
    ])).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k))
    ))
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // App icons/manifest — genuinely immutable, cache-first
  if (url.pathname.startsWith('/icons/') || url.pathname === '/icon.svg' || url.pathname === '/favicon.png' || url.pathname === '/manifest.json') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(request)
        if (cached) return cached
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      })
    )
    return
  }

  // Next.js build chunks — network-first (see note above re: dev-mode URL reuse)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        try {
          const res = await fetch(request)
          if (res.ok) cache.put(request, res.clone())
          return res
        } catch {
          const cached = await cache.match(request)
          if (cached) return cached
          throw new Error('offline and no cached chunk')
        }
      })
    )
    return
  }

  // API GETs — network-first, cache the successful response, fall back to cache when offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(API_CACHE).then(async cache => {
        try {
          const res = await fetch(request)
          if (res.ok) cache.put(request, res.clone())
          return res
        } catch {
          const cached = await cache.match(request)
          if (cached) return cached
          throw new Error('offline and no cached response')
        }
      })
    )
  }
})

self.addEventListener('push', event => {
  let data = { title: 'APEX Pulse', body: 'New alert' }
  try { if (event.data) data = event.data.json() } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'APEX Pulse', {
      body:  data.body ?? '',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag:   data.tag ?? 'apex-pulse-alert',
      data:  { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
