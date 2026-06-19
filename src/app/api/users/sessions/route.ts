import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hasRole } from '@/lib/rbac'
import { logAudit, getClientIp } from '@/lib/audit'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }
function callerId(req: NextRequest)    { return req.headers.get('x-user-id')    ?? undefined }

export const dynamic = 'force-dynamic'

// GET — list active (non-revoked) sessions across all users, most recently seen first (admin)
export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const sessions = await prisma.userSession.findMany({
    where:   { revokedAt: null },
    orderBy: { lastSeenAt: 'desc' },
    take:    200,
    include: { user: { select: { email: true, name: true, role: true } } },
  })
  return NextResponse.json(sessions)
}

// PATCH — force-expire an individual session (admin)
export async function PATCH(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const { id } = await req.json() as { id: string }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const session = await prisma.userSession.update({ where: { id }, data: { revokedAt: new Date() } })

  void logAudit({
    action: 'UPDATE', resource: 'user', resourceId: session.userId,
    userId: callerId(req), userEmail: callerEmail(req) ?? undefined,
    ipAddress: getClientIp(req), after: { sessionRevoked: id },
  })

  return NextResponse.json(session)
}
