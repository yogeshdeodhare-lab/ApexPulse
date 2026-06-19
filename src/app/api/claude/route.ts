import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { calculateCost } from '@/lib/cost-calculator'

export const dynamic = 'force-dynamic'

let client: Anthropic | null = null

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

export async function POST(req: NextRequest) {
  const anthropic = getClient()
  if (!anthropic) {
    return NextResponse.json(
      {
        error: 'ANTHROPIC_API_KEY not configured.',
        hint: 'Add ANTHROPIC_API_KEY=sk-ant-... to your .env.local file and restart the server.',
      },
      { status: 503 },
    )
  }

  const { prompt, model = 'claude-sonnet-4-6', systemPrompt } = await req.json()

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const startTime = Date.now()

  let response: Awaited<ReturnType<typeof anthropic.messages.create>>
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      ...(systemPrompt && { system: systemPrompt }),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Anthropic API error'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const latencyMs = Date.now() - startTime

  const usage = {
    model: response.model,
    inputTokens:      response.usage.input_tokens,
    outputTokens:     response.usage.output_tokens,
    cacheReadTokens:  (response.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens  ?? 0,
    cacheWriteTokens: (response.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
  }

  const cost = calculateCost(usage)

  await prisma.usageRecord.create({
    data: {
      ...usage,
      ...cost,
      source: 'demo',
      userId: 'demo-user',
      projectId: 'live-demo',
      prompt: prompt.slice(0, 500),
      latencyMs,
    },
  })

  const content = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  return NextResponse.json({
    content,
    model: response.model,
    usage,
    cost,
    latencyMs,
  })
}
