// AI provider pricing — USD per 1M tokens
// Verify current rates at each provider's pricing page

export interface ModelPricing {
  displayName: string
  shortName:   string
  tier:        'fast' | 'balanced' | 'flagship'
  color:       string
  input:       number   // per 1M input tokens
  output:      number   // per 1M output tokens
  cacheRead:   number   // per 1M cache-read tokens (0 = not supported)
  cacheWrite:  number   // per 1M cache-write tokens (0 = not supported)
}

export interface ProviderInfo {
  name:        string
  color:       string
  billingType: 'token' | 'seat'
  models:      string[]
}

// ── Anthropic Claude ───────────────────────────────────────────────────────

export const CLAUDE_PRICING: Record<string, ModelPricing> = {
  'claude-haiku-4-5-20251001': {
    displayName: 'Claude Haiku 4.5', shortName: 'Haiku 4.5', tier: 'fast', color: '#2dd4bf',
    input: 0.80, output: 4.00, cacheRead: 0.08, cacheWrite: 1.00,
  },
  'claude-sonnet-4-6': {
    displayName: 'Claude Sonnet 4.6', shortName: 'Sonnet 4.6', tier: 'balanced', color: '#60a5fa',
    input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75,
  },
  'claude-opus-4-8': {
    displayName: 'Claude Opus 4.8', shortName: 'Opus 4.8', tier: 'flagship', color: '#fb7185',
    input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75,
  },
}

// ── OpenAI ─────────────────────────────────────────────────────────────────

export const OPENAI_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': {
    displayName: 'GPT-4o', shortName: 'GPT-4o', tier: 'flagship', color: '#34d399',
    input: 2.50, output: 10.00, cacheRead: 1.25, cacheWrite: 0,
  },
  'gpt-4o-mini': {
    displayName: 'GPT-4o mini', shortName: '4o-mini', tier: 'fast', color: '#6ee7b7',
    input: 0.15, output: 0.60, cacheRead: 0.075, cacheWrite: 0,
  },
  'o1': {
    displayName: 'o1', shortName: 'o1', tier: 'flagship', color: '#f59e0b',
    input: 15.00, output: 60.00, cacheRead: 7.50, cacheWrite: 0,
  },
  'o3-mini': {
    displayName: 'o3-mini', shortName: 'o3-mini', tier: 'balanced', color: '#fbbf24',
    input: 1.10, output: 4.40, cacheRead: 0.55, cacheWrite: 0,
  },
}

// ── Google Gemini ──────────────────────────────────────────────────────────

export const GOOGLE_PRICING: Record<string, ModelPricing> = {
  'gemini-2.0-flash': {
    displayName: 'Gemini 2.0 Flash', shortName: '2.0 Flash', tier: 'fast', color: '#4ade80',
    input: 0.10, output: 0.40, cacheRead: 0.025, cacheWrite: 0,
  },
  'gemini-1.5-pro': {
    displayName: 'Gemini 1.5 Pro', shortName: '1.5 Pro', tier: 'flagship', color: '#22c55e',
    input: 1.25, output: 5.00, cacheRead: 0.3125, cacheWrite: 0,
  },
  'gemini-1.5-flash': {
    displayName: 'Gemini 1.5 Flash', shortName: '1.5 Flash', tier: 'balanced', color: '#86efac',
    input: 0.075, output: 0.30, cacheRead: 0.01875, cacheWrite: 0,
  },
}

// ── Azure OpenAI ───────────────────────────────────────────────────────────

export const AZURE_PRICING: Record<string, ModelPricing> = {
  'gpt-4o': {
    displayName: 'Azure GPT-4o', shortName: 'AZ GPT-4o', tier: 'flagship', color: '#818cf8',
    input: 2.75, output: 11.00, cacheRead: 0, cacheWrite: 0,
  },
  'gpt-4o-mini': {
    displayName: 'Azure GPT-4o mini', shortName: 'AZ 4o-mini', tier: 'fast', color: '#a5b4fc',
    input: 0.17, output: 0.68, cacheRead: 0, cacheWrite: 0,
  },
}

// ── AWS Bedrock ────────────────────────────────────────────────────────────

export const BEDROCK_PRICING: Record<string, ModelPricing> = {
  'claude-3-5-sonnet-20241022': {
    displayName: 'Claude 3.5 Sonnet (Bedrock)', shortName: 'BR Sonnet', tier: 'balanced', color: '#f472b6',
    input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 0,
  },
  'claude-3-haiku-20240307': {
    displayName: 'Claude 3 Haiku (Bedrock)', shortName: 'BR Haiku', tier: 'fast', color: '#f9a8d4',
    input: 0.25, output: 1.25, cacheRead: 0.03, cacheWrite: 0,
  },
}

// ── Provider catalog ───────────────────────────────────────────────────────

export const PROVIDER_CATALOG: Record<string, ProviderInfo> = {
  anthropic: { name: 'Anthropic Claude', color: '#2dd4bf', billingType: 'token', models: Object.keys(CLAUDE_PRICING) },
  openai:    { name: 'OpenAI',           color: '#34d399', billingType: 'token', models: Object.keys(OPENAI_PRICING) },
  google:    { name: 'Google Gemini',    color: '#4ade80', billingType: 'token', models: Object.keys(GOOGLE_PRICING) },
  azure:     { name: 'Azure OpenAI',     color: '#818cf8', billingType: 'token', models: Object.keys(AZURE_PRICING) },
  bedrock:   { name: 'AWS Bedrock',      color: '#f472b6', billingType: 'token', models: Object.keys(BEDROCK_PRICING) },
}

export const SEAT_PROVIDERS: Record<string, { name: string; color: string; pricePerSeat: number }> = {
  github_copilot: { name: 'GitHub Copilot', color: '#e2e8f0', pricePerSeat: 19 },
  cursor:         { name: 'Cursor',          color: '#f472b6', pricePerSeat: 20 },
  windsurf:       { name: 'Windsurf',        color: '#38bdf8', pricePerSeat: 15 },
}

// ── Lookup helpers ─────────────────────────────────────────────────────────

export const PROVIDER_TABLES: Record<string, Record<string, ModelPricing>> = {
  anthropic: CLAUDE_PRICING,
  openai:    OPENAI_PRICING,
  google:    GOOGLE_PRICING,
  azure:     AZURE_PRICING,
  bedrock:   BEDROCK_PRICING,
}

const CLAUDE_ALIASES: Record<string, string> = {
  'claude-haiku-4-5':         'claude-haiku-4-5-20251001',
  'claude-3-5-haiku-20241022':'claude-haiku-4-5-20251001',
}

export function getProviderModelPricing(provider: string, modelId: string): ModelPricing {
  const table = PROVIDER_TABLES[provider] ?? CLAUDE_PRICING
  const key   = CLAUDE_ALIASES[modelId] ?? modelId
  return table[key] ?? CLAUDE_PRICING['claude-sonnet-4-6']
}

export function getAnyModelPricing(modelId: string): ModelPricing {
  const key = CLAUDE_ALIASES[modelId] ?? modelId
  for (const table of Object.values(PROVIDER_TABLES)) {
    if (table[key]) return table[key]
  }
  return CLAUDE_PRICING['claude-sonnet-4-6']
}

// Backward-compat — Anthropic-only callers
export function getModelPricing(modelId: string): ModelPricing {
  return getProviderModelPricing('anthropic', modelId)
}

export const DEMO_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 — fastest, cheapest' },
  { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6 — best value' },
  { id: 'claude-opus-4-8',           label: 'Opus 4.8 — most capable' },
]
