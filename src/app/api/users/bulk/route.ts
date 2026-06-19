import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

const VALID_ROLES = ['viewer', 'manager', 'finance', 'admin']

function genTempPassword(): string {
  return randomBytes(9).toString('base64').replace(/[+/=]/g, '') + '!1'
}

// POST — bulk-invite users parsed client-side from a CSV (email,name,role per row).
// Generates a temporary password per user (no email integration yet — returned
// once in the response, same dev-convenience tradeoff as /api/auth/reset-password).
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const { rows } = await req.json() as { rows: { email: string; name?: string; role?: string }[] }
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: 'rows[] required' }, { status: 400 })
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: 'Max 500 rows per import' }, { status: 400 })
  }

  const created: { email: string; tempPassword: string }[] = []
  const skipped: { email: string; reason: string }[] = []

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase()
    const role  = row.role?.trim() || 'viewer'

    if (!email || !email.includes('@')) { skipped.push({ email: row.email ?? '', reason: 'Invalid email' }); continue }
    if (!VALID_ROLES.includes(role))     { skipped.push({ email, reason: `Invalid role: ${role}` }); continue }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) { skipped.push({ email, reason: 'Already exists' }); continue }

    const tempPassword = genTempPassword()
    const passwordHash = await hash(tempPassword, 10)
    await prisma.user.create({
      data: { email, name: row.name?.trim() || null, role, passwordHash },
    })
    created.push({ email, tempPassword })
  }

  void logAudit({
    action: 'CREATE', resource: 'user',
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
    after: { bulkInvite: true, createdCount: created.length, skippedCount: skipped.length },
  })

  return NextResponse.json({ created, skipped, summary: { createdCount: created.length, skippedCount: skipped.length } })
}
