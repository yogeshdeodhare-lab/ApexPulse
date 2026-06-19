import { NextRequest, NextResponse } from 'next/server'
import { prisma }   from '@/lib/db'
import { hasRole }  from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import bcrypt       from 'bcryptjs'

export const dynamic = 'force-dynamic'

function callerRole(req: NextRequest)  { return req.headers.get('x-user-role')  ?? null }
function callerEmail(req: NextRequest) { return req.headers.get('x-user-email') ?? null }

const USER_SELECT = {
  id: true, email: true, name: true, role: true,
  active: true, createdAt: true, lastLoginAt: true,
} as const

export async function GET(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: USER_SELECT })
  const summary = {
    total:   users.length,
    active:  users.filter(u => u.active).length,
    admins:  users.filter(u => u.role === 'admin').length,
    viewers: users.filter(u => u.role === 'viewer').length,
  }
  return NextResponse.json({ users, summary })
}

export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const { email, name, role, password } = await req.json()
  if (!email || !password || !role) {
    return NextResponse.json({ error: 'email, password, and role are required' }, { status: 400 })
  }
  const validRoles = ['viewer', 'manager', 'finance', 'admin']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: `role must be one of: ${validRoles.join(', ')}` }, { status: 400 })
  }
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
  }
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, name: name ?? null, role, passwordHash: hash },
    select: USER_SELECT,
  })
  await logAudit({
    action: 'CREATE', resource: 'user', resourceId: user.id,
    userEmail: callerEmail(req) ?? undefined,
    after: JSON.stringify({ email, role }),
  })
  return NextResponse.json(user, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }
  const { id, role, active, name } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const before = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true, name: true } })
  if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(role   !== undefined && { role }),
      ...(active !== undefined && { active }),
      ...(name   !== undefined && { name }),
    },
    select: USER_SELECT,
  })
  await logAudit({
    action: 'UPDATE', resource: 'user', resourceId: id,
    userEmail: callerEmail(req) ?? undefined,
    before: JSON.stringify(before),
    after:  JSON.stringify({ role, active, name }),
  })
  return NextResponse.json(user)
}
