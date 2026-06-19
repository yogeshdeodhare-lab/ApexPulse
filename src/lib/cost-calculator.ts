import { getProviderModelPricing } from './pricing'

export interface TokenUsage {
  model:             string
  provider?:         string
  inputTokens:       number
  outputTokens:      number
  cacheReadTokens?:  number
  cacheWriteTokens?: number
}

export interface CostBreakdown {
  inputCost:     number
  outputCost:    number
  cacheReadCost: number
  cacheWriteCost:number
  totalCost:     number
}

export function calculateCost(usage: TokenUsage): CostBreakdown {
  const p   = getProviderModelPricing(usage.provider ?? 'anthropic', usage.model)
  const per = (price: number) => price / 1_000_000

  const inputCost      = usage.inputTokens              * per(p.input)
  const outputCost     = usage.outputTokens              * per(p.output)
  const cacheReadCost  = (usage.cacheReadTokens  ?? 0)  * per(p.cacheRead)
  const cacheWriteCost = (usage.cacheWriteTokens ?? 0)  * per(p.cacheWrite)

  return {
    inputCost:      round6(inputCost),
    outputCost:     round6(outputCost),
    cacheReadCost:  round6(cacheReadCost),
    cacheWriteCost: round6(cacheWriteCost),
    totalCost:      round6(inputCost + outputCost + cacheReadCost + cacheWriteCost),
  }
}

function round6(n: number) {
  return Math.round(n * 1_000_000) / 1_000_000
}
