import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { resolveRoleFromGroups } from '@/lib/group-mapping'
import {
  verifyScimAuth, scimError, toScimUser,
  extractEmail, extractName, extractGroups, parseFilterEmail,
} from '@/lib/scim'

export const dynamic = 'force-dynamic'

const SCIM_CONTENT_TYPE = 'application/scim+json'

function scimJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'content-type': SCIM_CONTENT_TYPE } })
}

// GET /api/scim/v2/Users — list, or look up a single user via ?filter=userName eq "..."
export async function GET(req: NextRequest) {
  if (!verifyScimAuth(req)) {
    const { status, body } = scimError(401, 'Invalid or missing bearer token')
    return scimJson(body, status)
  }

  const filterEmail = parseFilterEmail(req.nextUrl.searchParams.get('filter'))
  const users = filterEmail
    ? await prisma.user.findMany({ where: { email: filterEmail } })
    : await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })

  return scimJson({
    schemas:      ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: users.length,
    startIndex:   1,
    itemsPerPage: users.length,
    Resources:    users.map(toScimUser),
  })
}

// POST /api/scim/v2/Users — provision a new user (Okta/Azure AD "push user" action)
export async function POST(req: NextRequest) {
  if (!verifyScimAuth(req)) {
    const { status, body } = scimError(401, 'Invalid or missing bearer token')
    return scimJson(body, status)
  }

  const payload = await req.json()
  const email = extractEmail(payload)
  if (!email) {
    const { status, body } = scimError(400, 'userName or emails[] is required')
    return scimJson(body, status)
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    const { status, body } = scimError(409, 'User already exists')
    return scimJson(body, status)
  }

  const groups = extractGroups(payload)
  const role   = await resolveRoleFromGroups(groups) ?? 'viewer'
  const name   = extractName(payload, email)

  const user = await prisma.user.create({
    data: {
      email, name, role,
      active:      payload.active !== false,
      externalId:  payload.externalId ?? null,
      ssoProvider: 'scim',
    },
  })

  void logAudit({
    action: 'CREATE', resource: 'user', resourceId: user.id,
    userEmail: 'scim-provisioning',
    after: { email, role, externalId: payload.externalId, groups },
  })

  return scimJson(toScimUser(user), 201)
}
