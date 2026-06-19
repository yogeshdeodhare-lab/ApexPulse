import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  CLAUDE_PRICING, OPENAI_PRICING, AZURE_PRICING, BEDROCK_PRICING,
  type ModelPricing,
} from '@/lib/pricing'
import { getConfigNum } from '@/lib/config'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

export type OptType = 'model_routing' | 'cache_strategy' | 'seat_roi' | 'provider_arbitrage' | 'token_efficiency'
export type Priority = 'critical' | 'high' | 'medium' | 'low'

export interface EffectivenessLink {
  tool:           string
  metric:         string
  value:          number
  benchmark:      number
  interpretation: string
}

export interface OptimizationOpportunity {
  id:               string
  type:             OptType
  priority:         Priority
  title:            string
  description:      string
  currentLabel:     string
  currentCost:      number
  targetLabel:      string
  targetCost:       number
  monthlySavings:   number
  annualSavings:    number
  confidence:       number
  calculationBasis: string
  recommendedAction:string
  dataPoints:       number
  effectiveness?:   EffectivenessLink
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function priority(savings: number): Priority {
  if (savings >= 200) return 'critical'
  if (savings >= 50)  return 'high'
  if (savings >= 15)  return 'medium'
  return 'low'
}

function r2(n: number) { return Math.round(n * 100) / 100 }

const PRICING_MAPS: Record<string, Record<string, ModelPricing>> = {
  anthropic: CLAUDE_PRICING,
  openai:    OPENAI_PRICING,
  azure:     AZURE_PRICING,
  bedrock:   BEDROCK_PRICING,
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const now            = new Date()
  const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo  = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30)
  const period         = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // ── Load runtime config (all thresholds are configurable via /api/config) ───
  const [
    opusThreshold, sonnetThreshold, gpt4oThreshold,
    cacheTargetHitRate, cacheMinTokens,
    valuePerLine, workingDays, acceptBench, survivalBench, roiTarget,
    arbMinSavings,
  ] = await Promise.all([
    getConfigNum('opt.routing.opus_threshold'),
    getConfigNum('opt.routing.sonnet_threshold'),
    getConfigNum('opt.routing.gpt4o_threshold'),
    getConfigNum('opt.cache.target_hit_rate'),
    getConfigNum('opt.cache.min_tokens'),
    getConfigNum('opt.seat.value_per_line'),
    getConfigNum('opt.seat.working_days'),
    getConfigNum('opt.seat.accept_benchmark'),
    getConfigNum('opt.seat.survival_benchmark'),
    getConfigNum('opt.seat.roi_target'),
    getConfigNum('opt.arb.min_savings'),
  ])

  // ── Data fetches ─────────────────────────────────────────────────────────────
  const [byModel, byProject, byProvider, seatAllocations, effSnapshots,
         smallOpusTasks, smallSonnetTasks, smallGpt4oTasks] = await Promise.all([

    // Per-model aggregate (last 30 days)
    prisma.usageRecord.groupBy({
      by: ['provider', 'model'],
      where: { timestamp: { gte: thirtyDaysAgo } },
      _sum:   { totalCost: true, inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
      _count: true,
      orderBy: { _sum: { totalCost: 'desc' } },
    }),

    // Per-project cache analysis (MTD, Anthropic only — others don't support prompt caching)
    prisma.usageRecord.groupBy({
      by: ['projectId'],
      where: { timestamp: { gte: monthStart }, provider: 'anthropic' },
      _sum:   { totalCost: true, inputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
      _count: true,
    }),

    // Per-provider/model for arbitrage (last 30 days)
    prisma.usageRecord.groupBy({
      by: ['provider', 'model'],
      where: { timestamp: { gte: thirtyDaysAgo } },
      _sum:   { totalCost: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),

    prisma.seatAllocation.findMany({ where: { period } }),

    // Effectiveness per tool (last 30 days)
    prisma.copilotEffectivenessSnapshot.groupBy({
      by: ['codingTool'],
      where: { dateKey: { gte: thirtyDaysAgo } },
      _avg: {
        acceptanceRate: true, survivalRate: true, linesAccepted: true,
        bugTaggedIssues: true, avgPrMergeTimeHours: true, toolDailyCost: true,
      },
      _count: true,
    }),

    // CAT 1: Small tasks on Opus (inputTokens < opusThreshold — Sonnet handles these fine)
    prisma.usageRecord.aggregate({
      where: { timestamp: { gte: thirtyDaysAgo }, provider: 'anthropic', model: 'claude-opus-4-8', inputTokens: { lt: opusThreshold } },
      _sum:   { inputTokens: true, outputTokens: true, totalCost: true },
      _count: true,
    }),

    // CAT 1: Small tasks on Sonnet (inputTokens < sonnetThreshold — Haiku handles these fine)
    prisma.usageRecord.aggregate({
      where: { timestamp: { gte: thirtyDaysAgo }, provider: 'anthropic', model: 'claude-sonnet-4-6', inputTokens: { lt: sonnetThreshold } },
      _sum:   { inputTokens: true, outputTokens: true, totalCost: true },
      _count: true,
    }),

    // CAT 1: Small tasks on GPT-4o (inputTokens < gpt4oThreshold — gpt-4o-mini handles these fine)
    prisma.usageRecord.aggregate({
      where: { timestamp: { gte: thirtyDaysAgo }, provider: 'openai', model: 'gpt-4o', inputTokens: { lt: gpt4oThreshold } },
      _sum:   { inputTokens: true, outputTokens: true, totalCost: true },
      _count: true,
    }),
  ])

  const opportunities: OptimizationOpportunity[] = []

  // ────────────────────────────────────────────────────────────────────────────
  // CATEGORY 1 — MODEL ROUTING
  // Identify the subset of requests on expensive models that are small tasks.
  // Query filters inputTokens < threshold directly — not an average.
  // ────────────────────────────────────────────────────────────────────────────

  type SmallTaskSpec = {
    agg:           typeof smallOpusTasks
    srcModel:      string
    dstModel:      string
    srcProvider:   string
    thresholdK:    number
    srcLabel:      string
    dstLabel:      string
  }

  const smallTaskSpecs: SmallTaskSpec[] = [
    { agg: smallOpusTasks,   srcModel: 'claude-opus-4-8',   dstModel: 'claude-sonnet-4-6',          srcProvider: 'anthropic', thresholdK: opusThreshold   / 1000, srcLabel: 'Claude Opus 4.8',   dstLabel: 'Claude Sonnet 4.6' },
    { agg: smallSonnetTasks, srcModel: 'claude-sonnet-4-6', dstModel: 'claude-haiku-4-5-20251001',   srcProvider: 'anthropic', thresholdK: sonnetThreshold / 1000, srcLabel: 'Claude Sonnet 4.6', dstLabel: 'Claude Haiku 4.5'  },
    { agg: smallGpt4oTasks,  srcModel: 'gpt-4o',            dstModel: 'gpt-4o-mini',                 srcProvider: 'openai',    thresholdK: gpt4oThreshold  / 1000, srcLabel: 'GPT-4o',            dstLabel: 'GPT-4o mini'       },
  ]

  for (const spec of smallTaskSpecs) {
    const { agg } = spec
    const reqs    = agg._count
    if (reqs < 5) continue

    const totalIn  = agg._sum.inputTokens  ?? 0
    const totalOut = agg._sum.outputTokens ?? 0
    const currentCost = r2(agg._sum.totalCost ?? 0)

    const srcP = PRICING_MAPS[spec.srcProvider]?.[spec.srcModel]
    const dstP = PRICING_MAPS[spec.srcProvider]?.[spec.dstModel]
    if (!srcP || !dstP) continue

    const projectedCost  = r2((totalIn * dstP.input + totalOut * dstP.output) / 1_000_000)
    const monthlySavings = r2(currentCost - projectedCost)
    if (monthlySavings < 0.50) continue

    const avgIn  = Math.round(totalIn  / reqs / 1000)
    const avgOut = Math.round(totalOut / reqs / 1000)
    const pctCheaper = Math.round(((srcP.input - dstP.input) / srcP.input) * 100)

    opportunities.push({
      id:              `model-routing-${spec.srcProvider}-${spec.srcModel}`,
      type:            'model_routing',
      priority:        priority(monthlySavings),
      title:           `Route ${spec.srcLabel} short tasks → ${spec.dstLabel}`,
      description:     `${reqs} of your ${spec.srcLabel} requests had < ${spec.thresholdK}k input tokens — a task size ${spec.dstLabel} handles equally well at ${pctCheaper}% lower price.`,
      currentLabel:    `${spec.srcLabel} @ $${srcP.input}/M in · $${srcP.output}/M out`,
      currentCost,
      targetLabel:     `${spec.dstLabel} @ $${dstP.input}/M in · $${dstP.output}/M out`,
      targetCost:      projectedCost,
      monthlySavings,
      annualSavings:   r2(monthlySavings * 12),
      confidence:      reqs >= 50 ? 90 : reqs >= 20 ? 75 : 60,
      calculationBasis:
        `Filtered to ${reqs} requests where inputTokens < ${spec.thresholdK}k (small tasks). `
        + `Total: ${Math.round(totalIn/1000)}k in + ${Math.round(totalOut/1000)}k out tokens. `
        + `Current: $${srcP.input}/M × ${Math.round(totalIn/1000)}k + $${srcP.output}/M × ${Math.round(totalOut/1000)}k = $${currentCost}. `
        + `Target: $${dstP.input}/M × ${Math.round(totalIn/1000)}k + $${dstP.output}/M × ${Math.round(totalOut/1000)}k = $${projectedCost}. `
        + `Saving = $${monthlySavings}/mo on tasks averaging ${avgIn}k in / ${avgOut}k out tokens.`,
      recommendedAction:
        `Add pre-call token estimation. If estimatedInputTokens < ${spec.thresholdK * 1000}, route to ${spec.dstModel}. `
        + `Use tiktoken or a character-count heuristic (1 token ≈ 4 chars) for fast estimation.`,
      dataPoints: reqs,
    })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CATEGORY 2 — CACHE STRATEGY
  // Flag projects where cache hit rate < 50% or cacheWrite:cacheRead ratio < 1.5
  // (cache being written but not read back efficiently)
  // ────────────────────────────────────────────────────────────────────────────

  for (const row of byProject) {
    const inputTokens     = row._sum.inputTokens     ?? 0
    const cacheReadTokens = row._sum.cacheReadTokens ?? 0
    const cacheWriteTokens= row._sum.cacheWriteTokens?? 0
    const requests        = row._count

    if (inputTokens + cacheReadTokens < cacheMinTokens) continue

    const totalEligible = inputTokens + cacheReadTokens
    const hitRate       = totalEligible > 0 ? cacheReadTokens / totalEligible : 0
    const reuseRatio    = cacheWriteTokens > 0 ? cacheReadTokens / cacheWriteTokens : 99

    // Signal A: low hit rate (configurable target, default 65%)
    const lowHitRate = hitRate < cacheTargetHitRate
    // Signal B: low reuse ratio — writing cache that isn't being reused across sessions
    const lowReuse   = reuseRatio < 1.5 && cacheWriteTokens > 200_000

    if (!lowHitRate && !lowReuse) continue

    const sonnetP       = CLAUDE_PRICING['claude-sonnet-4-6']
    const extraReads    = Math.max(0, (cacheTargetHitRate - hitRate) * totalEligible)
    const savingPerTok  = (sonnetP.input - sonnetP.cacheRead) / 1_000_000
    const hitRateSaving = r2(extraReads * savingPerTok)

    // Reuse saving: each cacheRead avoided re-paying input price
    const reuseSaving   = lowReuse
      ? r2((cacheWriteTokens * 1.5 - cacheReadTokens) * savingPerTok)
      : 0

    const monthlySavings = r2(Math.max(hitRateSaving, reuseSaving))
    if (monthlySavings < 1) continue

    const hitRatePct   = Math.round(hitRate * 100)
    const projectLabel = row.projectId ?? 'unattributed'
    const signal       = lowReuse && !lowHitRate ? 'cache-reuse' : 'hit-rate'

    opportunities.push({
      id:              `cache-${projectLabel}`,
      type:            'cache_strategy',
      priority:        priority(monthlySavings),
      title:           signal === 'cache-reuse'
        ? `"${projectLabel}" writes cache but reuse ratio is only ${r2(reuseRatio)}×`
        : `"${projectLabel}" cache hit rate ${hitRatePct}% — below ${Math.round(cacheTargetHitRate * 100)}% target`,
      description:     signal === 'cache-reuse'
        ? `${Math.round(cacheWriteTokens/1000)}k tokens written to cache but only ${Math.round(cacheReadTokens/1000)}k read back (${r2(reuseRatio)}× reuse). Target ≥ 1.5× to justify write cost.`
        : `${hitRatePct}% of tokens served from cache vs ${Math.round(cacheTargetHitRate * 100)}% target. ${Math.round(cacheWriteTokens/1000)}k cache-write tokens are set up but not being reused cross-session.`,
      currentLabel:    signal === 'cache-reuse'
        ? `${r2(reuseRatio)}× cache reuse ratio`
        : `${hitRatePct}% cache hit rate`,
      currentCost:     r2(row._sum.totalCost ?? 0),
      targetLabel:     signal === 'cache-reuse' ? '≥ 1.5× reuse ratio' : `${Math.round(cacheTargetHitRate * 100)}% cache hit rate`,
      targetCost:      r2((row._sum.totalCost ?? 0) - monthlySavings),
      monthlySavings,
      annualSavings:   r2(monthlySavings * 12),
      confidence:      requests >= 100 ? 80 : 65,
      calculationBasis:
        `Project "${projectLabel}" MTD (Anthropic): ${Math.round(inputTokens/1000)}k input + ${Math.round(cacheReadTokens/1000)}k cache-read tokens. `
        + `Hit rate: ${Math.round(cacheReadTokens/1000)}k / ${Math.round(totalEligible/1000)}k = ${hitRatePct}%. `
        + (lowHitRate
          ? `Extra reads at ${Math.round(cacheTargetHitRate*100)}% target: ${Math.round(extraReads/1000)}k tokens × ($${sonnetP.input} − $${sonnetP.cacheRead}) / 1M = $${hitRateSaving} saving.`
          : `Cache writes: ${Math.round(cacheWriteTokens/1000)}k. At 1.5× reuse, extra reads = ${Math.round(cacheWriteTokens*0.5/1000)}k × saving/tok = $${reuseSaving}.`),
      recommendedAction:
        'Use persistent cache blocks: put static context (system prompt, schema, docs) in a separately-identified cache block and reuse the same block ID across requests in a session. '
        + 'Avoid recreating context on every call — pass the cache ID, not the content.',
      dataPoints: requests,
    })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CATEGORY 3 — SEAT ROI
  // Cross-reference seat spend vs effectiveness metrics.
  // ROI = (total monthly lines accepted × $0.05 value) / monthly seat spend
  // Note: linesAccepted in DB is already the TOTAL across all users for that day.
  // ────────────────────────────────────────────────────────────────────────────

  const BUSINESS_VALUE_PER_LINE = valuePerLine   // configurable via opt.seat.value_per_line
  const WORKING_DAYS            = workingDays    // configurable via opt.seat.working_days

  const TOOL_NAMES: Record<string, string> = {
    github_copilot: 'GitHub Copilot', cursor: 'Cursor', windsurf: 'Windsurf',
    claude_code: 'Claude Code', cline: 'Cline', roo_code: 'Roo Code',
  }

  for (const seat of seatAllocations) {
    const effRow = effSnapshots.find(e => e.codingTool === seat.provider)
    if (!effRow) continue

    const avgAccept   = effRow._avg.acceptanceRate  ?? 0
    const avgSurvival = effRow._avg.survivalRate    ?? 0
    const avgLinesDay = effRow._avg.linesAccepted   ?? 0
    const avgBugs     = effRow._avg.bugTaggedIssues ?? 0
    const dataPoints  = effRow._count

    const monthlySeatCost  = seat.seats * seat.pricePerSeat
    // linesAccepted is already total for all users of this tool — do NOT multiply by seats
    const monthlyLinesValue= r2(avgLinesDay * WORKING_DAYS * BUSINESS_VALUE_PER_LINE)
    const roi              = monthlySeatCost > 0 ? monthlyLinesValue / monthlySeatCost : 0

    const ACCEPT_BENCH  = acceptBench    // configurable via opt.seat.accept_benchmark
    const SURVIVE_BENCH = survivalBench  // configurable via opt.seat.survival_benchmark
    const BUG_BENCH     = 2.0

    const issues: string[] = []
    if (avgAccept < ACCEPT_BENCH)  issues.push(`low acceptance (${r2(avgAccept)}% vs ${ACCEPT_BENCH}% bench)`)
    if (avgSurvival < SURVIVE_BENCH) issues.push(`low survival (${r2(avgSurvival)}% vs ${SURVIVE_BENCH}% bench)`)
    if (avgBugs > BUG_BENCH)       issues.push(`high bug rate (${r2(avgBugs)} vs ${BUG_BENCH} bench)`)

    if (issues.length === 0 && roi >= roiTarget) continue   // performing well on all fronts

    const toolLabel = TOOL_NAMES[seat.provider] ?? seat.provider

    // Estimate seat reduction if low acceptance → ~15% are non-adopters
    const lowAdoptPct  = avgAccept < 25 ? 0.20 : avgAccept < ACCEPT_BENCH ? 0.15 : 0
    const seatSavings  = r2(monthlySeatCost * lowAdoptPct)

    // Primary effectiveness signal
    const effLink: EffectivenessLink =
      avgAccept < ACCEPT_BENCH
        ? { tool: toolLabel, metric: 'Acceptance Rate', value: r2(avgAccept), benchmark: ACCEPT_BENCH,
            interpretation: `${toolLabel} suggestions accepted ${r2(avgAccept)}% of the time — developers are rejecting most AI completions. Low acceptance typically means poor context fit or irrelevant suggestions.` }
      : avgBugs > BUG_BENCH
        ? { tool: toolLabel, metric: 'Bug Rate', value: r2(avgBugs), benchmark: BUG_BENCH,
            interpretation: `${r2(avgBugs)} bug-tagged issues per 1k AI lines vs ${BUG_BENCH} benchmark — AI-generated code introducing more defects than average.` }
        : { tool: toolLabel, metric: 'Code Survival Rate', value: r2(avgSurvival), benchmark: SURVIVE_BENCH,
            interpretation: `Only ${r2(avgSurvival)}% of AI code survives code review (benchmark ${SURVIVE_BENCH}%). High rework is eroding productivity gains.` }

    opportunities.push({
      id:              `seat-roi-${seat.provider}`,
      type:            'seat_roi',
      priority:        priority(seatSavings > 0 ? seatSavings : roi < 0.5 ? 80 : 30),
      title:           `${toolLabel}: ROI ${r2(roi)}× on ${seat.seats} seats @ $${seat.pricePerSeat}/seat`,
      description:     `Monthly seat cost $${monthlySeatCost}. Code value generated: ~$${monthlyLinesValue} (${Math.round(avgLinesDay)} lines/day × ${WORKING_DAYS} days × $${BUSINESS_VALUE_PER_LINE}/line). Issues: ${issues.join(', ') || `ROI below ${roiTarget}× target`}.`,
      currentLabel:    `${seat.seats} seats × $${seat.pricePerSeat} = $${monthlySeatCost}/mo`,
      currentCost:     monthlySeatCost,
      targetLabel:     lowAdoptPct > 0
        ? `Remove ~${Math.round(seat.seats * lowAdoptPct)} non-adopter seats → $${r2(monthlySeatCost - seatSavings)}/mo`
        : `Improve adoption / switch tool`,
      targetCost:      r2(monthlySeatCost - seatSavings),
      monthlySavings:  seatSavings,
      annualSavings:   r2(seatSavings * 12),
      confidence:      dataPoints >= 15 ? 82 : 62,
      calculationBasis:
        `Seat cost: ${seat.seats} × $${seat.pricePerSeat} = $${monthlySeatCost}/mo. `
        + `Code value: ${Math.round(avgLinesDay)} lines/day (total across all users) × ${WORKING_DAYS} days × $${BUSINESS_VALUE_PER_LINE}/line = $${monthlyLinesValue}/mo. `
        + `ROI = $${monthlyLinesValue} ÷ $${monthlySeatCost} = ${r2(roi)}× (target ≥ ${roiTarget}×). `
        + (lowAdoptPct > 0
          ? `Acceptance ${r2(avgAccept)}% < ${ACCEPT_BENCH}% → ~${Math.round(lowAdoptPct*100)}% of seats are low-adopters → removing ${Math.round(seat.seats*lowAdoptPct)} seats saves $${seatSavings}/mo.`
          : `No clear seat reduction — focus on improving adoption.`),
      recommendedAction:
        lowAdoptPct > 0
          ? `Audit usage logs: identify users with < 5 suggestions/day over the past 30 days. Offer targeted onboarding or reclaim unused seats.`
          : issues.includes('high bug rate')
          ? `Enable AI code review gate: require human review for all AI-suggested blocks in high-criticality paths. Run 30-day before/after bug count comparison.`
          : `Run a 1-sprint A/B test: assign one team to an alternative tool, compare acceptance rate and PR merge time.`,
      dataPoints,
      effectiveness: effLink,
    })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CATEGORY 4 — PROVIDER ARBITRAGE
  // Azure and Bedrock charge more for the same models available elsewhere cheaper.
  // ────────────────────────────────────────────────────────────────────────────

  const ARBITRAGE: Record<string, { cheaperProvider: string; cheaperModel: string; note: string }> = {
    'azure:gpt-4o':     { cheaperProvider: 'openai',    cheaperModel: 'gpt-4o',                  note: 'Azure OpenAI charges ~10% premium over OpenAI direct for the same model' },
    'azure:gpt-4o-mini':{ cheaperProvider: 'openai',    cheaperModel: 'gpt-4o-mini',              note: 'Azure OpenAI charges ~13% premium over OpenAI direct for the same model' },
    'bedrock:claude-3-5-sonnet-20241022': { cheaperProvider: 'anthropic', cheaperModel: 'claude-sonnet-4-6', note: 'Bedrock adds infrastructure margin over Anthropic direct API; also gains access to newer Sonnet 4.6' },
    'bedrock:claude-3-haiku-20240307':    { cheaperProvider: 'anthropic', cheaperModel: 'claude-haiku-4-5-20251001', note: 'Bedrock Haiku 3 is older; Anthropic direct offers Haiku 4.5 at similar price with better performance' },
  }

  for (const row of byProvider) {
    const key = `${row.provider}:${row.model}`
    const arb = ARBITRAGE[key]
    if (!arb) continue

    const totalIn  = row._sum.inputTokens  ?? 0
    const totalOut = row._sum.outputTokens ?? 0
    const currentCost = r2(row._sum.totalCost ?? 0)
    const requests    = row._count

    if (totalIn < 10_000) continue   // trivial volume

    const srcP = PRICING_MAPS[row.provider]?.[row.model]
    const dstP = PRICING_MAPS[arb.cheaperProvider]?.[arb.cheaperModel]
    if (!srcP || !dstP) continue

    const projectedCost  = r2((totalIn * dstP.input + totalOut * dstP.output) / 1_000_000)
    const monthlySavings = r2(currentCost - projectedCost)
    if (monthlySavings < arbMinSavings) continue

    const pctCheaper = Math.round(((srcP.input - dstP.input) / srcP.input) * 100)

    opportunities.push({
      id:              `arbitrage-${key}`,
      type:            'provider_arbitrage',
      priority:        priority(monthlySavings),
      title:           `${row.model} via ${row.provider.toUpperCase()} → ${arb.cheaperProvider} saves ${pctCheaper > 0 ? pctCheaper + '%' : 'and upgrades model'}`,
      description:     `${arb.note}. ${requests} calls this period. Same capability, lower price.`,
      currentLabel:    `${row.provider.toUpperCase()} / ${row.model} @ $${srcP.input}/M in`,
      currentCost,
      targetLabel:     `${arb.cheaperProvider} / ${arb.cheaperModel} @ $${dstP.input}/M in`,
      targetCost:      projectedCost,
      monthlySavings,
      annualSavings:   r2(monthlySavings * 12),
      confidence:      90,
      calculationBasis:
        `${Math.round(totalIn/1000)}k input + ${Math.round(totalOut/1000)}k output tokens over 30 days across ${requests} requests. `
        + `${row.provider.toUpperCase()}: $${srcP.input}/M in × ${Math.round(totalIn/1000)}k + $${srcP.output}/M out × ${Math.round(totalOut/1000)}k = $${currentCost}. `
        + `${arb.cheaperProvider}: $${dstP.input}/M in × ${Math.round(totalIn/1000)}k + $${dstP.output}/M out × ${Math.round(totalOut/1000)}k = $${projectedCost}. `
        + `Monthly saving = $${monthlySavings} (${pctCheaper > 0 ? pctCheaper+'% cheaper' : 'same cost, newer model'}).`,
      recommendedAction:
        `Replace ${row.provider} credentials with ${arb.cheaperProvider} API key. Update base URL to ${arb.cheaperProvider} direct endpoint. Model ID may change — use "${arb.cheaperModel}".`,
      dataPoints: requests,
    })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CATEGORY 5 — TOKEN EFFICIENCY
  // 5a: Verbose output on expensive models (high output/input ratio)
  // 5b: Cache write without sufficient read-back (already partly in cache strategy,
  //     here we flag at per-model level)
  // ────────────────────────────────────────────────────────────────────────────

  for (const row of byModel) {
    const totalIn  = row._sum.inputTokens  ?? 0
    const totalOut = row._sum.outputTokens ?? 0
    const cacheW   = row._sum.cacheWriteTokens ?? 0
    const cacheR   = row._sum.cacheReadTokens  ?? 0
    const requests = row._count

    if (requests < 20 || totalIn < 100_000) continue

    const pricing = PRICING_MAPS[row.provider]?.[row.model]
    if (!pricing) continue

    // 5a: Verbose output — only flag flagship/balanced models with expensive output
    const outputRatio  = totalIn > 0 ? totalOut / totalIn : 0
    if (outputRatio >= 0.3 && pricing.output >= 4.00) {
      // 20% output reduction via max_tokens / concise prompts
      const reducibleOut = totalOut * 0.20
      const outputSaving = r2(reducibleOut * pricing.output / 1_000_000)

      if (outputSaving >= 1.00) {
        const currentCost = r2(row._sum.totalCost ?? 0)
        opportunities.push({
          id:              `token-verbose-${row.provider}-${row.model}`,
          type:            'token_efficiency',
          priority:        priority(outputSaving),
          title:           `${pricing.displayName} output tokens are ${r2(outputRatio * 100)}% of input — verbose responses`,
          description:     `${Math.round(totalOut/1000)}k output tokens vs ${Math.round(totalIn/1000)}k input. Output costs $${pricing.output}/M — 20% reduction via max_tokens or concise prompts saves $${outputSaving}/mo.`,
          currentLabel:    `${Math.round(totalOut/1000)}k output (ratio ${r2(outputRatio)}×) @ $${pricing.output}/M`,
          currentCost,
          targetLabel:     `${Math.round(totalOut*0.80/1000)}k output (20% reduction)`,
          targetCost:      r2(currentCost - outputSaving),
          monthlySavings:  outputSaving,
          annualSavings:   r2(outputSaving * 12),
          confidence:      70,
          calculationBasis:
            `Output tokens: ${Math.round(totalOut/1000)}k @ $${pricing.output}/M = $${r2(totalOut*pricing.output/1_000_000)}/mo. `
            + `Output/input ratio: ${r2(outputRatio)}×. `
            + `20% reduction = ${Math.round(reducibleOut/1000)}k tokens × $${pricing.output}/M = $${outputSaving} saving. `
            + `Achievable via: "Answer concisely", structured JSON output, or max_tokens cap.`,
          recommendedAction:
            'Set max_tokens to the minimum needed for each task type. Add "Be concise, reply in under 300 words" to system prompts for summarization/Q&A tasks. Use structured JSON schemas to prevent verbose preambles.',
          dataPoints: requests,
        })
      }
    }

    // 5b: Cache write with low reuse (< 1.5× ratio) — per model
    if (cacheW >= 300_000 && pricing.cacheWrite > 0) {
      const reuseRatio = cacheW > 0 ? cacheR / cacheW : 0
      if (reuseRatio < 1.5 && reuseRatio >= 0) {
        // Each 1× of reuse we're missing costs: cacheW * (cacheWritePrice - 0) — but we already paid for the write
        // The opportunity is: if we got 2× reuse instead of current ratio, we'd save on input cost
        const missedReads  = cacheW * (1.5 - reuseRatio)
        const savingPerTok = (pricing.input - pricing.cacheRead) / 1_000_000
        const cacheSaving  = r2(missedReads * savingPerTok)

        if (cacheSaving >= 1.00) {
          const currentCost = r2(row._sum.totalCost ?? 0)
          opportunities.push({
            id:              `token-reuse-${row.provider}-${row.model}`,
            type:            'token_efficiency',
            priority:        priority(cacheSaving),
            title:           `${pricing.displayName} cache reuse only ${r2(reuseRatio)}× — prompts not shared across sessions`,
            description:     `${Math.round(cacheW/1000)}k tokens written to cache but only ${Math.round(cacheR/1000)}k read back. Target ≥ 1.5× reuse to justify the $${pricing.cacheWrite}/M write cost.`,
            currentLabel:    `${r2(reuseRatio)}× reuse (${Math.round(cacheW/1000)}k write / ${Math.round(cacheR/1000)}k read)`,
            currentCost,
            targetLabel:     `1.5× reuse ratio (${Math.round(cacheW*1.5/1000)}k reads per write)`,
            targetCost:      r2(currentCost - cacheSaving),
            monthlySavings:  cacheSaving,
            annualSavings:   r2(cacheSaving * 12),
            confidence:      requests >= 50 ? 78 : 60,
            calculationBasis:
              `Cache writes: ${Math.round(cacheW/1000)}k tokens @ $${pricing.cacheWrite}/M. Cache reads: ${Math.round(cacheR/1000)}k (reuse: ${r2(reuseRatio)}×). `
              + `At 1.5× reuse: ${Math.round(cacheW*1.5/1000)}k reads needed. Gap: ${Math.round(missedReads/1000)}k tokens. `
              + `Each missed read costs (input − cacheRead)/M = ($${pricing.input} − $${pricing.cacheRead})/M = $${savingPerTok.toFixed(4)}/tok. `
              + `Saving = ${Math.round(missedReads/1000)}k × $${savingPerTok.toFixed(4)} = $${cacheSaving}/mo.`,
            recommendedAction:
              'Assign stable session IDs to user conversations. Use the same cached system-prompt block for all turns in a conversation. '
              + 'Avoid re-sending context on every call — pass only the new user message once context is cached.',
            dataPoints: requests,
          })
        }
      }
    }
  }

  // ── Sort and summarise ────────────────────────────────────────────────────

  const sorted = opportunities.sort((a, b) => b.monthlySavings - a.monthlySavings)

  const totalMonthlySavings = r2(sorted.reduce((s, o) => s + o.monthlySavings, 0))
  const byCategory: Record<OptType, number> = {
    model_routing: 0, cache_strategy: 0, seat_roi: 0, provider_arbitrage: 0, token_efficiency: 0,
  }
  for (const o of sorted) byCategory[o.type] = r2((byCategory[o.type] ?? 0) + o.monthlySavings)

  return NextResponse.json({
    generatedAt:         new Date().toISOString(),
    totalOpportunities:  sorted.length,
    totalMonthlySavings,
    totalAnnualSavings:  r2(totalMonthlySavings * 12),
    byCategory,
    opportunities:       sorted,
  })
}
