/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { calculateCost } from '../src/lib/cost-calculator'

const prisma = new PrismaClient()

// ─── Config ────────────────────────────────────────────────────────────────────

const DAYS          = 30
const BUDGET_AMOUNT = 8000  // $8k monthly — realistic with multi-provider

const USERS = [
  { id: 'u-a-rao',   name: 'A. Rao',   team: 'platform' },
  { id: 'u-m-singh', name: 'M. Singh', team: 'platform' },
  { id: 'u-p-nair',  name: 'P. Nair',  team: 'modernization' },
  { id: 'u-k-iyer',  name: 'K. Iyer',  team: 'agentic' },
  { id: 'u-s-das',   name: 'S. Das',   team: 'modernization' },
  { id: 'u-r-bose',  name: 'R. Bose',  team: 'rag' },
]

const PROJECTS = ['legacy-modernization','agentic-poc','rag-search','platform-shared']

// ─── Anthropic session templates ───────────────────────────────────────────────

const CLAUDE_TEMPLATES = [
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'quick-question',
    input: [3_000, 10_000],    output: [500,  2_000],  cache: [5_000,  20_000],  weight: 8 },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'code-review',
    input: [20_000, 60_000],   output: [2_000, 6_000], cache: [40_000, 120_000], weight: 12 },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'refactor',
    input: [50_000, 120_000],  output: [5_000, 15_000],cache: [80_000, 200_000], weight: 10 },
  // Quick chats routed to Sonnet — anti-pattern, Haiku handles these equally well
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'quick-chat',
    input: [1_500, 5_500],     output: [200,  1_500],  cache: [2_000,  8_000],   weight: 9 },
  { provider: 'anthropic', model: 'claude-opus-4-8', label: 'architecture',
    input: [30_000, 80_000],   output: [3_000, 10_000],cache: [50_000, 120_000], weight: 4 },
  // Medium code reviews sent to Opus — Sonnet handles these at 80% lower cost
  { provider: 'anthropic', model: 'claude-opus-4-8', label: 'code-review',
    input: [8_000, 20_000],    output: [1_500, 5_000], cache: [15_000, 40_000],  weight: 5 },
  { provider: 'anthropic', model: 'claude-sonnet-4-6', label: 'codebase-analysis',
    input: [80_000, 200_000],  output: [8_000, 20_000],cache: [100_000,300_000], weight: 6 },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'debug',
    input: [8_000, 25_000],    output: [1_000, 4_000], cache: [10_000, 40_000],  weight: 5 },
]

// ─── Multi-provider session templates ─────────────────────────────────────────

const MP_TEMPLATES = [
  // OpenAI — balanced workloads
  { provider: 'openai', model: 'gpt-4o', label: 'code-review',
    input: [20_000, 60_000],  output: [2_000, 6_000], cache: [0, 0], weight: 8 },
  { provider: 'openai', model: 'gpt-4o-mini', label: 'quick',
    input: [3_000, 15_000],   output: [500, 3_000],   cache: [0, 0], weight: 15 },
  { provider: 'openai', model: 'o1', label: 'reasoning',
    input: [20_000, 60_000],  output: [5_000, 20_000],cache: [0, 0], weight: 2 },
  { provider: 'openai', model: 'o3-mini', label: 'balanced',
    input: [10_000, 40_000],  output: [2_000, 8_000], cache: [0, 0], weight: 5 },

  // Google Gemini — experimental + document processing
  { provider: 'google', model: 'gemini-2.0-flash', label: 'quick',
    input: [5_000, 20_000],   output: [500, 2_000],   cache: [0, 0], weight: 8 },
  { provider: 'google', model: 'gemini-1.5-pro', label: 'doc-analysis',
    input: [50_000, 150_000], output: [5_000, 15_000],cache: [0, 0], weight: 3 },
  { provider: 'google', model: 'gemini-1.5-flash', label: 'balanced',
    input: [10_000, 30_000],  output: [1_000, 4_000], cache: [0, 0], weight: 5 },

  // Azure OpenAI — enterprise compliance team
  { provider: 'azure', model: 'gpt-4o', label: 'code-review',
    input: [20_000, 60_000],  output: [2_000, 6_000], cache: [0, 0], weight: 10 },
  { provider: 'azure', model: 'gpt-4o-mini', label: 'quick',
    input: [3_000, 12_000],   output: [500, 2_000],   cache: [0, 0], weight: 12 },

  // AWS Bedrock — AWS-stack teams
  { provider: 'bedrock', model: 'claude-3-5-sonnet-20241022', label: 'code-review',
    input: [20_000, 80_000],  output: [2_000, 8_000], cache: [0, 0], weight: 6 },
  { provider: 'bedrock', model: 'claude-3-haiku-20240307', label: 'quick',
    input: [3_000, 15_000],   output: [500, 2_000],   cache: [0, 0], weight: 4 },
]

const CLAUDE_WEIGHTED  = CLAUDE_TEMPLATES.flatMap(t => Array.from({ length: t.weight }, () => t))
const MP_WEIGHTED      = MP_TEMPLATES.flatMap(t => Array.from({ length: t.weight }, () => t))

// ─── Helpers ───────────────────────────────────────────────────────────────────

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T             { return arr[Math.floor(Math.random() * arr.length)] }
function randBetween([min, max]: number[]) { return randInt(min, max) }
function jitter(base: number, pctRange = 0.08): number {
  return base * (1 + (Math.random() - 0.5) * pctRange * 2)
}

function dayMultiplier(dow: number): number {
  return [0.3, 1.0, 1.1, 1.2, 1.1, 1.0, 0.3][dow]
}

// ─── Coding tools config ───────────────────────────────────────────────────────

const CODING_TOOLS = [
  { id: 'github_copilot', baseAccept: 31,   baseLinesDay: 2840, baseSurvival: 94, baseBugs: 1.8, basePrHours: 18, basePrComments: 1.2, basePrs: 14, baseCost: 280, confidence: 1 },
  { id: 'cursor',         baseAccept: 28,   baseLinesDay: 1840, baseSurvival: 91, baseBugs: 2.1, basePrHours: 22, basePrComments: 1.5, basePrs: 9,  baseCost: 107, confidence: 2 },
  { id: 'claude_code',    baseAccept: 62,   baseLinesDay: 1240, baseSurvival: 96, baseBugs: 1.4, basePrHours: 16, basePrComments: 1.0, basePrs: 8,  baseCost: 427, confidence: 2 },
  { id: 'windsurf',       baseAccept: null, baseLinesDay: 980,  baseSurvival: 89, baseBugs: 2.4, basePrHours: 24, basePrComments: 1.8, basePrs: 6,  baseCost: 80,  confidence: 3 },
  { id: 'cline',          baseAccept: 19,   baseLinesDay: 520,  baseSurvival: 86, baseBugs: 2.8, basePrHours: 28, basePrComments: 2.1, basePrs: 4,  baseCost: 207, confidence: 1 },
  { id: 'roo_code',       baseAccept: 35,   baseLinesDay: 680,  baseSurvival: 92, baseBugs: 2.0, basePrHours: 20, basePrComments: 1.3, basePrs: 5,  baseCost: 60,  confidence: 1 },
]

// ─── Seat providers ────────────────────────────────────────────────────────────

const SEAT_PROVIDERS = [
  { provider: 'github_copilot', seats: 210, pricePerSeat: 19 },
  { provider: 'cursor',         seats: 80,  pricePerSeat: 20 },
  { provider: 'windsurf',       seats: 60,  pricePerSeat: 15 },
]

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding AI FinOps demo data (multi-provider)…')

  // ── Auth users ──────────────────────────────────────────────────────────────
  // Four test accounts — one per RBAC role.
  // Passwords are bcrypt-hashed (cost 12). Change all passwords before production.
  const TEST_USERS = [
    { email: 'admin@example.com',   name: 'Alice Chen',    role: 'admin',   password: 'Admin@Pulse1'   },
    { email: 'finance@example.com', name: 'Ben Wallace',   role: 'finance', password: 'Finance@Pulse1' },
    { email: 'manager@example.com', name: 'Priya Rajan',   role: 'manager', password: 'Manager@Pulse1' },
    { email: 'viewer@example.com',  name: 'Dan Ho',        role: 'viewer',  password: 'Viewer@Pulse1'  },
  ]

  for (const u of TEST_USERS) {
    const passwordHash = await hash(u.password, 12)
    await prisma.user.upsert({
      where:  { email: u.email },
      update: { name: u.name, role: u.role, active: true, passwordHash },
      create: { email: u.email, name: u.name, role: u.role, active: true, passwordHash },
    })
  }
  console.log(`👤  ${TEST_USERS.length} auth users (admin / finance / manager / viewer)`)

  // Clear all existing usage data
  await prisma.usageRecord.deleteMany()
  await prisma.budget.deleteMany()
  await prisma.copilotEffectivenessSnapshot.deleteMany()
  await prisma.seatAllocation.deleteMany()

  const now       = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStart= new Date(now.getFullYear(), now.getMonth(), 1)

  const records: any[] = []

  for (let day = DAYS - 1; day >= 0; day--) {
    const date = new Date(now)
    date.setDate(date.getDate() - day)
    date.setHours(0, 0, 0, 0)

    const dow      = date.getDay()
    const mult     = dayMultiplier(dow)

    // ── Anthropic sessions ────────────────────────────────────────────────
    const claudeSessions = Math.round(45 * mult)
    for (let s = 0; s < claudeSessions; s++) {
      const tmpl = pick(CLAUDE_WEIGHTED)
      const user = pick(USERS)

      let projectId = 'platform-shared'
      if (user.team === 'modernization') projectId = pick(['legacy-modernization','platform-shared'])
      else if (user.team === 'agentic')  projectId = 'agentic-poc'
      else if (user.team === 'rag')      projectId = 'rag-search'

      const inputTokens      = randBetween(tmpl.input)
      const outputTokens     = randBetween(tmpl.output)
      const cacheReadTokens  = randBetween(tmpl.cache)
      const cacheWriteTokens = Math.round(inputTokens * 0.15)

      const sessionTime = new Date(date)
      sessionTime.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59))

      const cost = calculateCost({ provider: 'anthropic', model: tmpl.model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens })

      records.push({
        provider: 'anthropic',
        model: tmpl.model,
        timestamp: sessionTime,
        inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
        ...cost,
        userId: user.id, teamId: user.team, projectId,
        latencyMs: randInt(400, 8000), source: 'seed',
      })
    }

    // ── Multi-provider sessions ───────────────────────────────────────────
    const mpSessions = Math.round(22 * mult)
    for (let s = 0; s < mpSessions; s++) {
      const tmpl = pick(MP_WEIGHTED)
      const user = pick(USERS)

      const inputTokens  = randBetween(tmpl.input)
      const outputTokens = randBetween(tmpl.output)
      // Non-Claude providers generally don't use Anthropic-style prompt caching
      const cacheReadTokens  = 0
      const cacheWriteTokens = 0

      const sessionTime = new Date(date)
      sessionTime.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59))

      const cost = calculateCost({ provider: tmpl.provider, model: tmpl.model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens })

      records.push({
        provider: tmpl.provider,
        model: tmpl.model,
        timestamp: sessionTime,
        inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0,
        ...cost,
        userId: user.id, teamId: user.team, projectId: pick(PROJECTS),
        latencyMs: randInt(300, 6000), source: 'seed',
      })
    }
  }

  // Batch insert usage records
  const BATCH = 200
  for (let i = 0; i < records.length; i += BATCH) {
    await prisma.usageRecord.createMany({ data: records.slice(i, i + BATCH) })
  }

  // ── Budget ────────────────────────────────────────────────────────────────
  const mtdRecords = records.filter(r => r.timestamp >= monthStart)
  const mtdSpend   = mtdRecords.reduce((sum, r) => sum + (r.totalCost ?? 0), 0)

  await prisma.budget.create({ data: { period: thisMonth, amount: BUDGET_AMOUNT } })

  // ── Seat allocations ───────────────────────────────────────────────────────
  for (const sp of SEAT_PROVIDERS) {
    await prisma.seatAllocation.create({
      data: { period: thisMonth, provider: sp.provider, seats: sp.seats, pricePerSeat: sp.pricePerSeat },
    })
  }

  // ── Coding effectiveness snapshots ─────────────────────────────────────────
  const effRecords: any[] = []
  for (let day = DAYS - 1; day >= 0; day--) {
    const date = new Date(now)
    date.setDate(date.getDate() - day)
    date.setHours(0, 0, 0, 0)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue  // skip weekends

    for (const tool of CODING_TOOLS) {
      const shown      = Math.round(jitter(tool.baseLinesDay * 1.4))
      const accepted   = Math.round(tool.baseAccept != null ? shown * (tool.baseAccept / 100) * jitter(1, 0.05) : shown * 0.28)
      const acceptRate = tool.baseAccept != null ? Math.round(jitter(tool.baseAccept, 0.06) * 10) / 10 : null

      effRecords.push({
        dateKey:              date,
        codingTool:           tool.id,
        teamId:               null,
        suggestionsShown:     shown,
        suggestionsAccepted:  accepted,
        linesShown:           shown,
        linesAccepted:        Math.round(jitter(tool.baseLinesDay)),
        acceptanceRate:       acceptRate,
        survivalRate:         Math.round(jitter(tool.baseSurvival, 0.04) * 10) / 10,
        bugTaggedIssues:      Math.round(jitter(tool.baseBugs, 0.10) * 10) / 10,
        avgPrMergeTimeHours:  Math.round(jitter(tool.basePrHours, 0.10) * 10) / 10,
        reviewCommentsPerPr:  Math.round(jitter(tool.basePrComments, 0.10) * 10) / 10,
        aiAssistedPrs:        Math.round(jitter(tool.basePrs, 0.15)),
        productivityIndex:    Math.round(jitter(68, 0.12) * 10) / 10,
        attributionConfidence:tool.confidence,
        toolDailyCost:        Math.round(jitter(tool.baseCost, 0.05) * 100) / 100,
      })
    }
  }

  const EFF_BATCH = 100
  for (let i = 0; i < effRecords.length; i += EFF_BATCH) {
    await prisma.copilotEffectivenessSnapshot.createMany({ data: effRecords.slice(i, i + EFF_BATCH) })
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const seatMonthly = SEAT_PROVIDERS.reduce((s, p) => s + p.seats * p.pricePerSeat, 0)
  console.log(`✅  ${records.length} usage records (Anthropic + multi-provider)`)
  console.log(`💺  ${SEAT_PROVIDERS.length} seat providers — $${seatMonthly}/mo`)
  console.log(`📊  ${effRecords.length} effectiveness snapshots`)
  console.log(`💰  Token MTD spend: $${mtdSpend.toFixed(2)} / $${BUDGET_AMOUNT} budget`)
  console.log(`🗓   Period: ${thisMonth}`)
  console.log('\nRun: npm run dev  →  open the app at your configured domain')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
