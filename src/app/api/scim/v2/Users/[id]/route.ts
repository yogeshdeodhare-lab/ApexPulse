import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { resolveRoleFromGroups } from '@/lib/group-mapping'
import { verifyScimAuth, scimError, toScimUser, extractGroups } from '@/lib/scim'

export const dynamic = 'force-dynamic'

const SCIM_CONTENT_TYPE = 'application/scim+json'

function scimJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'content-type': SCIM_CONTENT_TYPE } })
}

interface PatchOp { op: string; path?: string; value?: unknown }

// GET /api/scim/v2/Users/:id
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyScimAuth(req)) {
    const { status, body } = scimError(401, 'Invalid or missing bearer token')
    return scimJson(body, status)
  }
  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    const { status, body } = scimError(404, 'User not found')
    return scimJson(body, status)
  }
  return scimJson(toScimUser(user))
}

// PATCH /api/scim/v2/Users/:id — standard SCIM PatchOp, e.g. {"Operations":[{"op":"replace","path":"active","value":false}]}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyScimAuth(req)) {
    const { status, body } = scimError(401, 'Invalid or missing bearer token')
    return scimJson(body, status)
  }
  const { id } = await params
  const before = await prisma.user.findUnique({ where: { id } })
  if (!before) {
    const { status, body } = scimError(404, 'User not found')
    return scimJson(body, status)
  }

  const payload = await req.json() as { Operations?: PatchOp[]; active?: boolean; groups?: unknown[] }
  const data: { active?: boolean; name?: string; role?: string } = {}

  for (const opEntry of payload.Operations ?? []) {
    const path = opEntry.path?.toLowerCase()
    if (path === 'active') data.active = Boolean(opEntry.value)
    if (path === 'displayname' || path === 'name.formatted') data.name = String(opEntry.value)
  }
  // Tolerate non-compliant clients that PATCH with a flat body instead of Operations[]
  if (payload.active !== undefined) data.active = payload.active
  if (payload.groups !== undefined) {
    const role = await resolveRoleFromGroups(extractGroups({ groups: payload.groups as never }))
    if (role) data.role = role
  }

  const user = await prisma.user.update({ where: { id }, data })

  void logAudit({
    action: 'UPDATE', resource: 'user', resourceId: id,
    userEmail: 'scim-provisioning',
    before: { active: before.active, role: before.role },
    after:  data,
  })

  return scimJson(toScimUser(user))
}

// DELETE /api/scim/v2/Users/:id — soft deprovision (active=false), consistent with
// the app-wide "deactivate, never hard-delete" policy so attribution history is preserved.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyScimAuth(req)) {
    const { status, body } = scimError(401, 'Invalid or missing bearer token')
    return scimJson(body, status)
  }
  const { id } = await params
  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) {
    const { status, body } = scimError(404, 'User not found')
    return scimJson(body, status)
  }

  await prisma.user.update({ where: { id }, data: { active: false } })
  await prisma.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } })

  void logAudit({
    action: 'DELETE', resource: 'user', resourceId: id,
    userEmail: 'scim-provisioning',
    before: { active: true },
  })

  return new NextResponse(null, { status: 204 })
}
