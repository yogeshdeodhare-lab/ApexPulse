import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { decrypt } from '@/lib/vault'
import { INTEGRATIONS, isIntegrationId } from '@/lib/integrations'

function callerRole(req: NextRequest) { return req.headers.get('x-user-role') ?? null }

export const dynamic = 'force-dynamic'

// POST — test connection, either against a saved integration (by stored config)
// or a draft (config + secret passed in the body, before saving).
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const { provider } = await params
  if (!isIntegrationId(provider)) return NextResponse.json({ error: 'Unknown integration' }, { status: 404 })

  const mod  = INTEGRATIONS[provider]
  const body = await req.json().catch(() => ({})) as { config?: Record<string, string>; secret?: string }

  let config = body.config
  let secret = body.secret

  if (!config) {
    const row = await prisma.integration.findUnique({ where: { provider } })
    if (!row) return NextResponse.json({ error: 'Not connected' }, { status: 404 })
    config = JSON.parse(row.config)
    secret = row.encryptedSecret ? decrypt(row.encryptedSecret) : undefined
  }

  const result = await mod.test({ config: config ?? {}, secret })

  await prisma.integration.updateMany({
    where: { provider },
    data:  { testedAt: new Date(), testOk: result.ok },
  })

  return NextResponse.json(result)
}
