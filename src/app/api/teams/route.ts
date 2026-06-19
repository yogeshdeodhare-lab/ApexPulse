import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TEAM_META: Record<string, { displayName: string; color: string; devs: number }> = {
  platform:      { displayName: 'Platform',       color: '#378ADD', devs: 2 },
  modernization: { displayName: 'Modernization',  color: '#85B7EB', devs: 2 },
  agentic:       { displayName: 'Agentic AI',     color: '#22A06B', devs: 1 },
  rag:           { displayName: 'RAG & Search',   color: '#C98A20', devs: 1 },
}

const USER_NAMES: Record<string, string> = {
  'u-a-rao':   'A. Rao',
  'u-m-singh': 'M. Singh',
  'u-p-nair':  'P. Nair',
  'u-k-iyer':  'K. Iyer',
  'u-s-das':   'S. Das',
  'u-r-bose':  'R. Bose',
}

export async function GET() {
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [byTeam, byTeamUser, byTeamProject, byTeamProvider] = await Promise.all([
    // Team totals
    prisma.usageRecord.groupBy({
      by: ['teamId'],
      where: { timestamp: { gte: monthStart }, teamId: { not: null } },
      _sum:   { totalCost: true, inputTokens: true, outputTokens: true, cacheReadTokens: true },
      _count: true,
      orderBy: { _sum: { totalCost: 'desc' } },
    }),

    // Per-user within each team
    prisma.usageRecord.groupBy({
      by: ['teamId', 'userId'],
      where: { timestamp: { gte: monthStart }, teamId: { not: null }, userId: { not: null } },
      _sum:   { totalCost: true, inputTokens: true, outputTokens: true },
      _count: true,
      orderBy: { _sum: { totalCost: 'desc' } },
    }),

    // Per-project within each team
    prisma.usageRecord.groupBy({
      by: ['teamId', 'projectId'],
      where: { timestamp: { gte: monthStart }, teamId: { not: null } },
      _sum:   { totalCost: true, inputTokens: true, outputTokens: true },
      _count: true,
      orderBy: { _sum: { totalCost: 'desc' } },
    }),

    // Provider mix per team
    prisma.usageRecord.groupBy({
      by: ['teamId', 'provider'],
      where: { timestamp: { gte: monthStart }, teamId: { not: null } },
      _sum: { totalCost: true },
    }),
  ])

  const totalSpend = byTeam.reduce((s, t) => s + (t._sum.totalCost ?? 0), 0)

  const teams = byTeam.map(row => {
    const teamId = row.teamId!
    const meta   = TEAM_META[teamId] ?? { displayName: teamId, color: '#7B96C9', devs: 1 }
    const mtdSpend    = row._sum.totalCost    ?? 0
    const mtdTokens   = (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0)
    const mtdRequests = row._count

    // Members for this team
    const members = byTeamUser
      .filter(r => r.teamId === teamId)
      .map(r => ({
        userId:      r.userId!,
        displayName: USER_NAMES[r.userId!] ?? r.userId!,
        cost:        r._sum.totalCost ?? 0,
        tokens:      (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
        requests:    r._count,
        pct:         mtdSpend > 0 ? Math.round(((r._sum.totalCost ?? 0) / mtdSpend) * 100) : 0,
      }))
      .sort((a, b) => b.cost - a.cost)

    // Projects for this team
    const projects = byTeamProject
      .filter(r => r.teamId === teamId)
      .map(r => ({
        projectId: r.projectId ?? 'unattributed',
        cost:      r._sum.totalCost ?? 0,
        tokens:    (r._sum.inputTokens ?? 0) + (r._sum.outputTokens ?? 0),
        requests:  r._count,
        pct:       mtdSpend > 0 ? Math.round(((r._sum.totalCost ?? 0) / mtdSpend) * 100) : 0,
      }))
      .sort((a, b) => b.cost - a.cost)

    // Provider mix for this team
    const teamProviders = byTeamProvider
      .filter(r => r.teamId === teamId)
      .map(r => ({ provider: r.provider, cost: r._sum.totalCost ?? 0 }))
      .sort((a, b) => b.cost - a.cost)

    return {
      id:            teamId,
      displayName:   meta.displayName,
      color:         meta.color,
      devs:          meta.devs,
      mtdSpend,
      mtdTokens,
      mtdRequests,
      avgCostPerDev: meta.devs > 0 ? Math.round((mtdSpend / meta.devs) * 100) / 100 : 0,
      spendPct:      totalSpend > 0 ? Math.round((mtdSpend / totalSpend) * 100) : 0,
      cacheTokens:   row._sum.cacheReadTokens ?? 0,
      members,
      projects,
      providers: teamProviders,
      topProject: projects[0]?.projectId ?? '—',
    }
  })

  const totalDevs = teams.reduce((s, t) => s + t.devs, 0)

  return NextResponse.json({
    summary: {
      totalTeams:    teams.length,
      totalSpend,
      totalDevs,
      avgCostPerDev: totalDevs > 0 ? Math.round((totalSpend / totalDevs) * 100) / 100 : 0,
      topTeam:       teams[0]?.displayName ?? '—',
    },
    teams,
  })
}
