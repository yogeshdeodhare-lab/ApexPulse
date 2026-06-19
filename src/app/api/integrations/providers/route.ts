import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { encrypt, decrypt, maskKey } from '@/lib/vault'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.providerCredential.findMany({ orderBy: { provider: 'asc' } })

  return NextResponse.json(rows.map(r => ({
    provider:  r.provider,
    keyHint:   r.keyHint,
    testedAt:  r.testedAt,
    testOk:    r.testOk,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  })))
}

export async function PUT(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const { provider, key } = await req.json() as { provider: string; key: string }
  if (!provider || !key) return NextResponse.json({ error: 'provider and key required' }, { status: 400 })

  const trimmed      = key.trim()
  const keyHint      = trimmed.slice(-4)
  const encryptedKey = encrypt(trimmed)

  const credential = await prisma.providerCredential.upsert({
    where:  { provider },
    update: { encryptedKey, keyHint, updatedAt: new Date() },
    create: { provider, encryptedKey, keyHint },
  })

  void logAudit({
    action: 'UPDATE', resource: 'provider_credential', resourceId: provider,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
    after: { provider, hint: keyHint },
  })

  return NextResponse.json({ provider: credential.provider, keyHint: credential.keyHint, updatedAt: credential.updatedAt })
}

export async function DELETE(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const provider = req.nextUrl.searchParams.get('provider')
  if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  await prisma.providerCredential.deleteMany({ where: { provider } })

  void logAudit({
    action: 'DELETE', resource: 'provider_credential', resourceId: provider,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}

// Silence unused import warning
void maskKey
