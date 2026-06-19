import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { INTEGRATIONS } from '@/lib/integrations'

function callerRole(req: NextRequest) { return req.headers.get('x-user-role') ?? null }

export const dynamic = 'force-dynamic'

// GET — catalog of all marketplace integrations + connection status (viewer+)
export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.integration.findMany()
  const byProvider = new Map(rows.map(r => [r.provider, r]))

  const catalog = Object.values(INTEGRATIONS).map(mod => {
    const row = byProvider.get(mod.id)
    return {
      id:          mod.id,
      label:       mod.label,
      category:    mod.category,
      authMethod:  mod.authMethod,
      description: mod.description,
      fields:      mod.fields,
      secretLabel: mod.secretLabel,
      supportsSync:   !!mod.sync,
      supportsTicket: !!mod.createTicket,
      connected:      !!row,
      active:         row?.active ?? false,
      config:         row ? JSON.parse(row.config) : {},
      testedAt:       row?.testedAt ?? null,
      testOk:         row?.testOk ?? false,
      lastSyncAt:     row?.lastSyncAt ?? null,
      lastSyncStatus: row?.lastSyncStatus ?? null,
      lastSyncError:  row?.lastSyncError ?? null,
      lastSyncCount:  row?.lastSyncCount ?? null,
    }
  })

  return NextResponse.json(catalog)
}
