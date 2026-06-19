import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/export?format=csv|json&from=2024-01&to=2024-12&provider=anthropic&team=platform
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const format   = searchParams.get('format')   ?? 'json'
  const from     = searchParams.get('from')
  const to       = searchParams.get('to')
  const provider = searchParams.get('provider')
  const teamId   = searchParams.get('team')
  const limit    = Math.min(parseInt(searchParams.get('limit') ?? '10000'), 50_000)

  const where: Record<string, unknown> = {}

  if (from || to) {
    where.timestamp = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to + 'T23:59:59Z') } : {}),
    }
  }
  if (provider) where.provider = provider
  if (teamId)   where.teamId   = teamId

  const records = await prisma.usageRecord.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take:    limit,
    select: {
      id:               true,
      timestamp:        true,
      provider:         true,
      model:            true,
      inputTokens:      true,
      outputTokens:     true,
      cacheReadTokens:  true,
      cacheWriteTokens: true,
      totalCost:        true,
      inputCost:        true,
      outputCost:       true,
      userId:           true,
      teamId:           true,
      projectId:        true,
      latencyMs:        true,
      source:           true,
    },
  })

  if (format === 'csv') {
    const headers = [
      'id','timestamp','provider','model',
      'inputTokens','outputTokens','cacheReadTokens','cacheWriteTokens',
      'totalCost','inputCost','outputCost',
      'userId','teamId','projectId','latencyMs','source',
    ]
    const rows = records.map(r =>
      headers.map(h => {
        const v = (r as Record<string, unknown>)[h]
        if (v instanceof Date) return v.toISOString()
        if (typeof v === 'string' && v.includes(',')) return `"${v}"`
        return v ?? ''
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv',
        'Content-Disposition': `attachment; filename="apex-usage-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    count:      records.length,
    filters:    { from, to, provider, teamId, limit },
    records,
  })
}
