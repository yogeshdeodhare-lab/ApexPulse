import { NextResponse } from 'next/server'
import { computeOpportunities } from '@/lib/optimization-engine'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await computeOpportunities()
  return NextResponse.json(result)
}
