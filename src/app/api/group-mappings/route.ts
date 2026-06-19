import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

const VALID_ROLES = ['viewer', 'manager', 'finance', 'admin']

export const dynamic = 'force-dynamic'

// GET — list IdP group → role mappings (viewer+)
export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'viewer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const mappings = await prisma.groupRoleMapping.findMany({ orderBy: { idpGroup: 'asc' } })
  return NextResponse.json(mappings)
}

// POST — create or update a mapping (admin); upsert by idpGroup for simple "add or edit" UX
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const { idpGroup, role } = await req.json() as { idpGroup: string; role: string }
  if (!idpGroup || !role) return NextResponse.json({ error: 'idpGroup and role required' }, { status: 400 })
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })

  const mapping = await prisma.groupRoleMapping.upsert({
    where:  { idpGroup },
    update: { role },
    create: { idpGroup, role },
  })

  void logAudit({
    action: 'CREATE', resource: 'user', resourceId: mapping.id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { idpGroup, role },
  })

  return NextResponse.json(mapping, { status: 201 })
}

// DELETE — remove a mapping (admin)
export async function DELETE(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.groupRoleMapping.delete({ where: { id } })

  void logAudit({
    action: 'DELETE', resource: 'user', resourceId: id,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req),
  })

  return NextResponse.json({ ok: true })
}
