import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Session-revocation lookups need Prisma, which requires the Node.js runtime (not Edge).
export const runtime = 'nodejs'

// ── Routes that bypass auth ──────────────────────────────────────────────────
const PUBLIC_PATHS = new Set([
  '/login',
  '/forgot-password',  // S13 — requester isn't logged in yet
  '/reset-password',   // S13 — authenticated via a one-time token in the URL, not a session
  '/api/auth',          // NextAuth endpoints (also covers /api/auth/reset-password/* — see below)
  '/api/health',        // uptime checks — no auth needed
  '/api/scim',          // S13 — SCIM provisioning authenticates via its own Bearer token
  '/api/settings',      // S13 — login/forgot-password pages read SSO feature flags pre-auth; no secrets exposed
  '/demo.html',          // standalone demo
])

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname.startsWith('/api/scim/')) return true
  if (pathname.startsWith('/_next/')) return true
  if (pathname.startsWith('/favicon')) return true
  return false
}

// ── In-process token-bucket rate limiter (per IP, edge-compatible) ───────────
// Config read from env; AppConfig hot-reload happens at the API layer only.
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM ?? '120', 10)
const WINDOW_MS      = 60_000

const ipBuckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now    = Date.now()
  const bucket = ipBuckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (bucket.count >= RATE_LIMIT_RPM) return false
  bucket.count++
  return true
}

// Prune stale buckets every ~500 requests to avoid unbounded memory
let _pruneCounter = 0
function maybePrune() {
  if (++_pruneCounter % 500 !== 0) return
  const now = Date.now()
  for (const [ip, b] of ipBuckets) {
    if (now > b.resetAt) ipBuckets.delete(ip)
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Rate limiting — applied to all /api/* paths
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? request.headers.get('x-real-ip')
            ?? 'unknown'
    maybePrune()
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSeconds: 60 },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }
  }

  // 2. Auth check — skip public paths
  if (isPublic(pathname)) return NextResponse.next()

  // NEXTAUTH_SECRET not configured → open mode (dev convenience)
  if (!process.env.NEXTAUTH_SECRET) return NextResponse.next()

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    // API calls get 401; page navigations get redirect to /login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 3. Session revocation + deprovisioning enforcement (S13).
  // Best-effort: any DB error fails OPEN (trusts the JWT) so a DB hiccup never locks out the app.
  let role = token.role
  if (token.sid) {
    try {
      const { prisma } = await import('@/lib/db')
      const sess = await prisma.userSession.findUnique({
        where:   { id: token.sid },
        include: { user: { select: { active: true, role: true } } },
      })
      if (sess && (sess.revokedAt || !sess.user.active)) {
        if (pathname.startsWith('/api/')) {
          const error = sess.revokedAt ? 'Session revoked' : 'Account deactivated'
          return NextResponse.json({ error }, { status: 401 })
        }
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(loginUrl)
      }
      if (sess) {
        role = sess.user.role // live role — picks up admin role changes immediately, not just on next JWT refresh
        void prisma.userSession.update({ where: { id: token.sid }, data: { lastSeenAt: new Date() } }).catch(() => {})
      }
    } catch {
      // DB unavailable — fail open, trust the JWT claim
    }
  }

  // 4. Forward identity headers so API routes can skip re-verifying JWT
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id',    String(token.id   ?? ''))
  requestHeaders.set('x-user-email', String(token.email ?? ''))
  requestHeaders.set('x-user-role',  String(role        ?? 'viewer'))
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
