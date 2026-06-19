import { prisma } from '@/lib/db'

// ── Typed config keys with descriptions and defaults ─────────────────────────

export const CONFIG_SCHEMA: Record<string, { default: string; description: string; category: string }> = {
  // Budget
  'budget.warn_pct':                { default: '80',    description: 'Budget utilisation % that triggers warning alert',          category: 'budget' },
  'budget.critical_pct':            { default: '95',    description: 'Budget utilisation % that triggers critical alert',         category: 'budget' },

  // Optimization — model routing
  'opt.routing.opus_threshold':     { default: '15000', description: 'Max input tokens for Opus→Sonnet routing suggestion',       category: 'optimization' },
  'opt.routing.sonnet_threshold':   { default: '6000',  description: 'Max input tokens for Sonnet→Haiku routing suggestion',      category: 'optimization' },
  'opt.routing.gpt4o_threshold':    { default: '6000',  description: 'Max input tokens for GPT-4o→GPT-4o-mini routing',          category: 'optimization' },

  // Optimization — cache strategy
  'opt.cache.target_hit_rate':      { default: '0.65',  description: 'Cache hit rate below which a strategy opportunity is flagged', category: 'optimization' },
  'opt.cache.min_tokens':           { default: '500000', description: 'Minimum monthly input tokens to consider for cache analysis',  category: 'optimization' },

  // Optimization — seat ROI
  'opt.seat.value_per_line':        { default: '0.05',  description: 'Business value per AI-accepted code line (USD)',            category: 'optimization' },
  'opt.seat.working_days':          { default: '22',    description: 'Working days per month used in seat ROI calculation',       category: 'optimization' },
  'opt.seat.accept_benchmark':      { default: '35',    description: 'Minimum acceptable acceptance rate % for a coding tool',   category: 'optimization' },
  'opt.seat.survival_benchmark':    { default: '92',    description: 'Minimum acceptable survival rate % for a coding tool',     category: 'optimization' },
  'opt.seat.roi_target':            { default: '1.5',   description: 'Minimum ROI multiple before a seat is considered efficient', category: 'optimization' },

  // Optimization — arbitrage
  'opt.arb.min_savings':            { default: '0.10',  description: 'Minimum monthly USD saving to surface a provider arbitrage opportunity', category: 'optimization' },

  // App
  'app.rate_limit_rpm':             { default: '120',   description: 'API rate limit — requests per minute per IP',              category: 'app' },
  'app.max_export_rows':            { default: '50000', description: 'Maximum rows returned by /api/export',                     category: 'app' },
  'app.session_timeout_hours':      { default: '24',    description: 'JWT session lifetime in hours',                            category: 'app' },
  'app.allowed_origins':            { default: '',      description: 'Comma-separated extra CORS origins (empty = same-origin)', category: 'app' },
}

// ── In-memory cache (per process, 60 s TTL) ──────────────────────────────────

let _cache: Record<string, string> | null = null
let _cacheExpiry = 0
const CACHE_TTL_MS = 60_000

async function warm(): Promise<Record<string, string>> {
  if (_cache && Date.now() < _cacheExpiry) return _cache
  try {
    const rows = await prisma.appConfig.findMany()
    _cache = Object.fromEntries(rows.map(r => [r.key, r.value]))
    _cacheExpiry = Date.now() + CACHE_TTL_MS
  } catch {
    // DB unavailable — fall back to empty, use defaults
    _cache = {}
    _cacheExpiry = Date.now() + 5_000
  }
  return _cache
}

export function invalidateCache() {
  _cache = null
  _cacheExpiry = 0
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getConfig(key: string): Promise<string> {
  const cache = await warm()
  return cache[key] ?? CONFIG_SCHEMA[key]?.default ?? ''
}

export async function getConfigNum(key: string): Promise<number> {
  return parseFloat(await getConfig(key))
}

export async function getConfigBool(key: string): Promise<boolean> {
  const v = await getConfig(key)
  return v === 'true' || v === '1'
}

export async function setConfig(key: string, value: string, updatedBy?: string): Promise<void> {
  await prisma.appConfig.upsert({
    where:  { key },
    create: { key, value, description: CONFIG_SCHEMA[key]?.description, updatedBy },
    update: { value, updatedBy },
  })
  invalidateCache()
}

export async function getAllConfig(): Promise<Record<string, { value: string; default: string; description: string; category: string; isOverridden: boolean }>> {
  const cache = await warm()
  return Object.fromEntries(
    Object.entries(CONFIG_SCHEMA).map(([key, meta]) => [
      key,
      {
        value:       cache[key] ?? meta.default,
        default:     meta.default,
        description: meta.description,
        category:    meta.category,
        isOverridden: key in cache,
      },
    ])
  )
}
