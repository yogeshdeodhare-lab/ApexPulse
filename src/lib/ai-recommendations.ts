import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { computeOpportunities, type OptimizationOpportunity } from '@/lib/optimization-engine'
import { calculateCost } from '@/lib/cost-calculator'
import { getConfigNum } from '@/lib/config'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

// ── Deterministic action-payload assignment ──────────────────────────────────
// Claude never invents a config value — it only picks which candidates matter
// and writes the rationale. Every actionPayload is computed here, in code,
// from real numbers, so "Apply" can never write a hallucinated value.

const ROUTING_KEY: Record<string, string> = {
  'model-routing-anthropic-claude-opus-4-8':   'opt.routing.opus_threshold',
  'model-routing-anthropic-claude-sonnet-4-6': 'opt.routing.sonnet_threshold',
  'model-routing-openai-gpt-4o':               'opt.routing.gpt4o_threshold',
}

interface Candidate {
  sourceId:         string
  type:             string
  title:            string
  description:      string
  estimatedSavings: number
  confidence:       number
  actionType:       'config_write' | 'create_ticket' | 'manual'
  actionPayload:    Record<string, string> | null
}

async function buildCandidates(opportunities: OptimizationOpportunity[]): Promise<Candidate[]> {
  const routingKeys = Object.values(ROUTING_KEY)
  const currentValue = new Map(await Promise.all(routingKeys.map(async k => [k, await getConfigNum(k)] as const)))

  return opportunities.slice(0, 12).map(o => {
    if (o.type === 'model_routing') {
      const key = ROUTING_KEY[o.id]
      const current = key ? (currentValue.get(key) ?? 0) : 0
      return {
        sourceId: o.id, type: o.type, title: o.title, description: o.description,
        estimatedSavings: o.monthlySavings, confidence: o.confidence,
        actionType: 'config_write',
        actionPayload: key && current > 0 ? { key, value: String(Math.round(current * 1.3)) } : null,
      }
    }
    if (o.type === 'cache_strategy' || o.type === 'seat_roi') {
      return {
        sourceId: o.id, type: o.type, title: o.title, description: o.description,
        estimatedSavings: o.monthlySavings, confidence: o.confidence,
        actionType: 'create_ticket', actionPayload: null,
      }
    }
    return {
      sourceId: o.id, type: o.type, title: o.title, description: o.description,
      estimatedSavings: o.monthlySavings, confidence: o.confidence,
      actionType: 'manual', actionPayload: null,
    }
  })
}

async function findUnusedSeats(): Promise<Candidate[]> {
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000)

  const [seats, activeTool] = await Promise.all([
    prisma.seatAllocation.findMany({ where: { period } }),
    prisma.copilotEffectivenessSnapshot.groupBy({ by: ['codingTool'], where: { dateKey: { gte: thirtyDaysAgo } } }),
  ])
  const activeTools = new Set(activeTool.map(a => a.codingTool))

  return seats
    .filter(s => !activeTools.has(s.provider))
    .map(s => ({
      sourceId: `unused-seats-${s.provider}`, type: 'unused_seats',
      title: `${s.seats} ${s.provider} seats with zero recorded usage in 30 days`,
      description: `$${(s.seats * s.pricePerSeat).toFixed(2)}/mo paid for ${s.provider} seats with no effectiveness data — likely unassigned or unused licenses.`,
      estimatedSavings: Math.round(s.seats * s.pricePerSeat * 100) / 100,
      confidence: 70, actionType: 'create_ticket' as const, actionPayload: null,
    }))
}

async function dailySpendByProject(): Promise<{ date: string; projectId: string; cost: number }[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
  const records = await prisma.usageRecord.findMany({
    where: { timestamp: { gte: thirtyDaysAgo } },
    select: { timestamp: true, projectId: true, totalCost: true },
  })
  const map = new Map<string, number>()
  for (const r of records) {
    const date = r.timestamp.toISOString().slice(0, 10)
    const proj = r.projectId ?? 'unattributed'
    const k = `${date}|${proj}`
    map.set(k, (map.get(k) ?? 0) + r.totalCost)
  }
  return Array.from(map.entries()).map(([k, cost]) => {
    const [date, projectId] = k.split('|')
    return { date, projectId, cost: Math.round(cost * 100) / 100 }
  })
}

interface HaikuPick {
  sourceId:         string | null
  type:             string
  title:            string
  description:      string
  rationale:        string
  estimatedSavings: number
  confidence:       'high' | 'medium' | 'low'
}

interface HaikuResponse { picks: HaikuPick[]; anomalyNotes: string }

function extractJson(text: string): HaikuResponse {
  const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '')
  return JSON.parse(cleaned)
}

export async function runAnalysis(): Promise<{ candidatesIn: number; picked: number; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { candidatesIn: 0, picked: 0, error: 'ANTHROPIC_API_KEY not configured' }

  const result = await computeOpportunities()
  const [candidates, unusedSeats, spendTable] = await Promise.all([
    buildCandidates(result.opportunities),
    findUnusedSeats(),
    dailySpendByProject(),
  ])
  const allCandidates = [...candidates, ...unusedSeats]

  const prompt = `You are a FinOps analyst reviewing pre-computed cost-saving candidates and a daily spend table for an AI platform.

CANDIDATES (each savings figure is already verified — do not recompute or change the numbers):
${JSON.stringify(allCandidates, null, 2)}

DAILY SPEND BY PROJECT, last 30 days (date, projectId, cost in USD):
${JSON.stringify(spendTable)}

Tasks:
1. Pick the 3-5 most impactful candidates from CANDIDATES by sourceId. For each, write a one-sentence "rationale" explaining the business impact in plain language. Keep "title", "description", "estimatedSavings" EXACTLY as given in the candidate — do not alter them.
2. Separately, scan the daily spend table for genuine anomalies: a project/day (or sustained run of days) that spikes or drifts well above that project's own trailing baseline in the same window. Only report real outliers, not normal day-to-day noise. For each anomaly found (0-2 of these), invent a new recommendation with sourceId: null, type: "spend_anomaly", your own title/description, an estimatedSavings figure representing the avoidable overspend if the anomaly is addressed, and a rationale.
3. Assign each pick a confidence: "high", "medium", or "low".

Respond with ONLY this JSON shape, no markdown fences, no commentary:
{"picks": [{"sourceId": string|null, "type": string, "title": string, "description": string, "rationale": string, "estimatedSavings": number, "confidence": "high"|"medium"|"low"}], "anomalyNotes": string}`

  const anthropic = new Anthropic({ apiKey })
  const start = Date.now()
  let response
  try {
    response = await anthropic.messages.create({
      model: HAIKU_MODEL, max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (e) {
    return { candidatesIn: allCandidates.length, picked: 0, error: e instanceof Error ? e.message : 'Anthropic API error' }
  }
  const latencyMs = Date.now() - start

  const usage = {
    model: response.model,
    inputTokens:  response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
  const cost = calculateCost(usage)
  void prisma.usageRecord.create({
    data: { ...usage, ...cost, source: 'ai-optimization', userId: 'ai-optimization-engine', projectId: 'platform-internal', latencyMs },
  }).catch(() => {})

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    return { candidatesIn: allCandidates.length, picked: 0, error: 'No text in Claude response' }
  }

  let parsed: HaikuResponse
  try {
    parsed = extractJson(textBlock.text)
  } catch {
    return { candidatesIn: allCandidates.length, picked: 0, error: 'Could not parse Claude JSON response' }
  }

  const now = new Date()
  let picked = 0

  for (const pick of parsed.picks ?? []) {
    const candidate = allCandidates.find(c => c.sourceId === pick.sourceId)

    // Respect the 30-day dismissal cooldown
    const existing = await prisma.recommendation.findFirst({
      where: { OR: [{ sourceId: pick.sourceId ?? undefined }, { title: pick.title }] },
      orderBy: { createdAt: 'desc' },
    })
    if (existing?.dismissedUntil && existing.dismissedUntil > now) continue
    if (existing?.status === 'active') continue // already surfaced, don't duplicate

    await prisma.recommendation.create({
      data: {
        type:             pick.type,
        title:            pick.title,
        description:      pick.description,
        rationale:        pick.rationale,
        estimatedSavings: candidate?.estimatedSavings ?? pick.estimatedSavings,
        confidence:       pick.confidence,
        actionType:       candidate?.actionType ?? 'manual',
        actionPayload:    candidate?.actionPayload ? JSON.stringify(candidate.actionPayload) : null,
        sourceId:         pick.sourceId,
      },
    })
    picked++
  }

  // Expire active recommendations whose underlying issue no longer appears
  const currentSourceIds = new Set(allCandidates.map(c => c.sourceId))
  const activeRecs = await prisma.recommendation.findMany({ where: { status: 'active', sourceId: { not: null } } })
  for (const rec of activeRecs) {
    if (rec.sourceId && !currentSourceIds.has(rec.sourceId)) {
      await prisma.recommendation.update({ where: { id: rec.id }, data: { status: 'expired' } })
    }
  }

  await prisma.recommendationRun.create({
    data: { model: HAIKU_MODEL, candidatesIn: allCandidates.length, picked, rawNotes: parsed.anomalyNotes ?? null },
  })

  return { candidatesIn: allCandidates.length, picked }
}

export async function getLatestRun() {
  return prisma.recommendationRun.findFirst({ orderBy: { runAt: 'desc' } })
}

// Platform-wide spend-delta proxy: average daily spend in the 7 days before the
// recommendation was applied vs. a stable post-adoption window (days 23-30
// after). Not a precise per-recommendation attribution — labeled as such in the UI.
export async function measureRoi(): Promise<void> {
  const now = new Date()
  const due = await prisma.recommendation.findMany({
    where: { status: 'applied', roiMeasuredAt: null, appliedAt: { lte: new Date(now.getTime() - 30 * 86_400_000) } },
  })

  for (const rec of due) {
    const appliedAt = rec.appliedAt!
    const [before, after] = await Promise.all([
      prisma.usageRecord.aggregate({
        where: { timestamp: { gte: new Date(appliedAt.getTime() - 7 * 86_400_000), lt: appliedAt } },
        _sum: { totalCost: true },
      }),
      prisma.usageRecord.aggregate({
        where: { timestamp: { gte: new Date(appliedAt.getTime() + 23 * 86_400_000), lt: new Date(appliedAt.getTime() + 30 * 86_400_000) } },
        _sum: { totalCost: true },
      }),
    ])
    const beforeDaily = (before._sum.totalCost ?? 0) / 7
    const afterDaily  = (after._sum.totalCost ?? 0) / 7
    const actualMonthlySavings = Math.round((beforeDaily - afterDaily) * 30 * 100) / 100

    await prisma.recommendation.update({
      where: { id: rec.id },
      data: { roiActualSavings: actualMonthlySavings, roiMeasuredAt: now },
    })
  }
}
