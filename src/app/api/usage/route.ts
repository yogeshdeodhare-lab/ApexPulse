import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calculateCost } from '@/lib/cost-calculator'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit    = Math.min(Number(searchParams.get('limit')    ?? 50), 200)
  const model    = searchParams.get('model')    ?? undefined
  const provider = searchParams.get('provider') ?? undefined
  const project  = searchParams.get('project')  ?? undefined
  const userId   = searchParams.get('userId')   ?? undefined

  const records = await prisma.usageRecord.findMany({
    where: {
      ...(provider && { provider }),
      ...(model    && { model }),
      ...(project  && { projectId: project }),
      ...(userId   && { userId }),
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const {
    provider         = 'anthropic',
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens  = 0,
    cacheWriteTokens = 0,
    userId,
    teamId,
    projectId,
    prompt,
    latencyMs,
  } = body

  if (!model || inputTokens == null || outputTokens == null) {
    return NextResponse.json(
      { error: 'model, inputTokens, and outputTokens are required' },
      { status: 400 },
    )
  }

  const cost = calculateCost({ provider, model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens })

  const record = await prisma.usageRecord.create({
    data: {
      provider,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      ...cost,
      userId,
      teamId,
      projectId,
      prompt: prompt ? String(prompt).slice(0, 500) : undefined,
      latencyMs,
      source: 'api',
    },
  })

  return NextResponse.json(record, { status: 201 })
}
