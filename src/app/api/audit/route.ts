import { NextRequest, NextResponse } from 'next/server'
import { prisma }    from '@/lib/db'
import { can }       from '@/lib/rbac'

export const dynamic = 'force-dynamic'

const MAX_PAGE_SIZE = 200

export async function GET(req: NextRequest) {
  const role = req.headers.get('x-user-role') ?? (process.env.NEXTAUTH_SECRET ? 'viewer' : 'admin')

  if (!can(role, 'audit:read')) {
    return NextResponse.json({ error: 'Forbidden — finance or admin role required' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page     = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10))
  const limit    = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const action   = searchParams.get('action')   ?? undefined
  const resource = searchParams.get('resource') ?? undefined
  const userId   = searchParams.get('userId')   ?? undefined
  const from     = searchParams.get('from')     ? new Date(searchParams.get('from')!) : undefined
  const to       = searchParams.get('to')       ? new Date(searchParams.get('to')!)   : undefined

  const where = {
    ...(action   ? { action }    : {}),
    ...(resource ? { resource }  : {}),
    ...(userId   ? { userId }    : {}),
    ...(from || to ? { timestamp: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
  ])

  return NextResponse.json({
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
    rows,
  })
}
