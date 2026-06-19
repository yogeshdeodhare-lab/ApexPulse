import { NextResponse } from 'next/server'
import { prisma }       from '@/lib/db'

export const dynamic = 'force-dynamic'

interface DayPoint { date: string; spend: number; projected: boolean }

// Simple ordinary least-squares linear regression
function linReg(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  const n   = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 }
  const sx  = points.reduce((s, p) => s + p.x, 0)
  const sy  = points.reduce((s, p) => s + p.y, 0)
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0)
  const sx2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sx2 - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n, r2: 0 }
  const slope     = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  const yMean     = sy / n
  const ssTot     = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0)
  const ssRes     = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0)
  const r2        = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot)
  return { slope, intercept, r2 }
}

export async function GET() {
  const now     = new Date()
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day0    = new Date(today); day0.setDate(today.getDate() - 89) // 90-day window
  const period  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysInMonth = monthEnd.getDate()
  const dayOfMonth  = now.getDate()

  // Pull daily spend for last 90 days
  const raw = await prisma.usageRecord.groupBy({
    by:    ['timestamp'],
    where: { timestamp: { gte: day0 } },
    _sum:  { totalCost: true },
  })

  // Aggregate by calendar date
  const byDate = new Map<string, number>()
  for (const r of raw) {
    const d   = r.timestamp
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    byDate.set(key, (byDate.get(key) ?? 0) + (r._sum.totalCost ?? 0))
  }

  // Build ordered historical series (day index 0 = 90 days ago)
  const historical: DayPoint[] = []
  for (let i = 0; i < 90; i++) {
    const d   = new Date(day0); d.setDate(day0.getDate() + i)
    if (d > today) break
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    historical.push({
      date:      key,
      spend:     Math.round((byDate.get(key) ?? 0) * 100) / 100,
      projected: false,
    })
  }

  // Regression on last 30 days (more responsive to recent trend)
  const recent = historical.slice(-30)
  const regPoints = recent.map((p, i) => ({ x: i, y: p.spend }))
  const { slope, intercept, r2 } = linReg(regPoints)

  // Daily burn rate (30-day average, ignoring zeros for weekends)
  const nonZero     = recent.filter(p => p.spend > 0)
  const avgDailyBurn = nonZero.length > 0 ? nonZero.reduce((s, p) => s + p.spend, 0) / nonZero.length : 0

  // Project next 60 days
  const projected: DayPoint[] = []
  for (let i = 1; i <= 60; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const x   = recent.length + i - 1
    const spend = Math.max(0, Math.round((slope * x + intercept) * 100) / 100)
    projected.push({ date: key, spend, projected: true })
  }

  // MTD and month-end projection
  const mtdActual  = historical
    .filter(p => p.date >= `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`)
    .reduce((s, p) => s + p.spend, 0)
  const remainingDays      = daysInMonth - dayOfMonth
  const projectedMonthEnd  = Math.round((mtdActual + remainingDays * avgDailyBurn) * 100) / 100

  // Budget runway
  const budget = await prisma.budget.findUnique({ where: { period } })
  const remaining = budget ? Math.max(0, budget.amount - mtdActual) : null
  const budgetRunwayDays = remaining !== null && avgDailyBurn > 0
    ? Math.round(remaining / avgDailyBurn)
    : null

  // Projected spend per month for next 3 months
  const monthlyForecasts: { month: string; projected: number; label: string }[] = []
  for (let m = 0; m < 3; m++) {
    const d = new Date(now.getFullYear(), now.getMonth() + m + 1, 1)
    const label = d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    const key   = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    monthlyForecasts.push({
      month:     key,
      projected: Math.round(avgDailyBurn * 30 * (1 + m * 0.05) * 100) / 100, // slight trend
      label,
    })
  }

  // Confidence band (±1 stdev of daily spend)
  const stdev = nonZero.length > 1
    ? Math.sqrt(nonZero.reduce((s, p) => s + (p.spend - avgDailyBurn) ** 2, 0) / (nonZero.length - 1))
    : avgDailyBurn * 0.15

  return NextResponse.json({
    avgDailyBurn:     Math.round(avgDailyBurn * 100) / 100,
    mtdActual:        Math.round(mtdActual * 100) / 100,
    projectedMonthEnd,
    budgetAmount:     budget?.amount ?? null,
    budgetRunwayDays,
    regressionR2:     Math.round(r2 * 100) / 100,
    confidenceBand:   Math.round(stdev * 100) / 100,
    monthlyForecasts,
    series:           [...historical, ...projected],
    generatedAt:      now.toISOString(),
  })
}
