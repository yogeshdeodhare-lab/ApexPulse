import { NextRequest, NextResponse } from 'next/server'
import { getAllConfig, setConfig, CONFIG_SCHEMA } from '@/lib/config'
import { can }       from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

export const dynamic = 'force-dynamic'

function session(req: NextRequest) {
  return {
    id:    req.headers.get('x-user-id')    ?? 'anon',
    email: req.headers.get('x-user-email') ?? '',
    role:  req.headers.get('x-user-role')  ?? (process.env.NEXTAUTH_SECRET ? 'viewer' : 'admin'),
  }
}

// GET /api/config — any authenticated user can read config
export async function GET(req: NextRequest) {
  const s = session(req)
  if (!can(s.role, 'config:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const config = await getAllConfig()
  return NextResponse.json({ config })
}

// PUT /api/config — admin only; body: { key: string, value: string }
export async function PUT(req: NextRequest) {
  const s = session(req)
  if (!can(s.role, 'config:write')) {
    void logAudit({
      action: 'ACCESS_DENIED', resource: 'config',
      userId: s.id, userEmail: s.email, ipAddress: getClientIp(req),
      metadata: { required: 'admin', actual: s.role },
    })
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  let body: { key?: string; value?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { key, value } = body
  if (!key || value === undefined || value === null) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }
  if (!(key in CONFIG_SCHEMA)) {
    return NextResponse.json({ error: `Unknown config key: ${key}` }, { status: 400 })
  }

  const schema = CONFIG_SCHEMA[key]
  // Validate numeric keys
  if (!isNaN(Number(schema.default)) && isNaN(Number(value))) {
    return NextResponse.json({ error: `${key} expects a numeric value` }, { status: 400 })
  }

  const before = schema.default
  await setConfig(key, value, s.email)

  void logAudit({
    action: 'UPDATE', resource: 'config', resourceId: key,
    userId: s.id, userEmail: s.email, ipAddress: getClientIp(req),
    before: { [key]: before },
    after:  { [key]: value },
  })

  return NextResponse.json({ key, value, message: 'Config updated' })
}
