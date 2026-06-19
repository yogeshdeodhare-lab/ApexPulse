'use client'

import { useEffect, useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ReferenceLine, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Panel, KpiCard, mono, fmtUSD } from '@/components/ui'

interface DayPoint  { date: string; spend: number; projected: boolean }
interface MonthForecast { month: string; projected: number; label: string }

interface ForecastData {
  avgDailyBurn:     number
  mtdActual:        number
  projectedMonthEnd:number
  budgetAmount:     number | null
  budgetRunwayDays: number | null
  regressionR2:     number
  confidenceBand:   number
  monthlyForecasts: MonthForecast[]
  series:           DayPoint[]
  generatedAt:      string
}

const CHART_TOOLTIP = {
  contentStyle: { background: '#13161f', border: '1px solid #272c3a', borderRadius: 8, fontSize: 11 },
  labelStyle:   { color: '#8a91a6', fontFamily: 'monospace' },
  itemStyle:    { color: '#e8eaf0' },
}

function RunwayGauge({ days, budget, mtd }: { days: number | null; budget: number | null; mtd: number }) {
  if (!budget || days === null) return null
  const pct  = Math.min(100, Math.round((mtd / budget) * 100))
  const color = pct >= 90 ? '#E24B4A' : pct >= 70 ? '#C98A20' : '#22A06B'
  return (
    <div className="mt-3">
      <div className="flex justify-between mb-1.5">
        <span className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.50)' }}>
          Budget runway
        </span>
        <span className={`${mono} text-[9.5px]`} style={{ color }}>
          {days > 0 ? `${days}d remaining` : 'Exhausted'}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(133,183,235,0.10)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color, opacity: 0.8 }}
        />
      </div>
      <div className={`flex justify-between mt-1 ${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
        <span>{fmtUSD(mtd)} spent</span>
        <span>{fmtUSD(budget)} budget</span>
      </div>
    </div>
  )
}

export default function ForecastPage() {
  const [data,    setData]    = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/forecast')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24" style={{ color: 'rgba(133,183,235,0.40)' }}>
      Running forecast model…
    </div>
  )
  if (error) return <div className="p-4 text-rose text-[13px]">{error}</div>
  if (!data)  return null

  const { avgDailyBurn, mtdActual, projectedMonthEnd, budgetAmount, budgetRunwayDays,
          regressionR2, confidenceBand, monthlyForecasts, series } = data

  // Split series for chart — historical solid, projected dashed area
  const chartData = series.map(p => ({
    date:      p.date.slice(5),   // MM-DD
    actual:    p.projected ? null : p.spend,
    projected: p.projected ? p.spend : null,
    band_hi:   p.projected ? Math.round((p.spend + confidenceBand) * 100) / 100 : null,
    band_lo:   p.projected ? Math.max(0, Math.round((p.spend - confidenceBand) * 100) / 100) : null,
  }))

  const overBudget = budgetAmount && projectedMonthEnd > budgetAmount
  const burnTrend  = regressionR2 >= 0.5 ? 'trending' : 'volatile'

  return (
    <div className="space-y-4 animate-slideUp">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Avg Daily Burn"
          value={fmtUSD(avgDailyBurn)}
          accent="#378ADD"
          sub="30-day average"
        />
        <KpiCard
          label="Projected Month-End"
          value={fmtUSD(projectedMonthEnd)}
          accent={overBudget ? '#E24B4A' : '#22A06B'}
          sub={overBudget ? '▲ over budget' : '✓ within budget'}
        />
        <KpiCard
          label="Budget Runway"
          value={budgetRunwayDays !== null ? `${budgetRunwayDays}d` : '—'}
          accent={budgetRunwayDays !== null && budgetRunwayDays < 10 ? '#E24B4A' : '#22A06B'}
          sub={budgetAmount ? `of $${budgetAmount.toLocaleString()} budget` : 'no budget set'}
        />
        <KpiCard
          label="Model Fit (R²)"
          value={`${Math.round(regressionR2 * 100)}%`}
          accent={regressionR2 >= 0.7 ? '#22A06B' : '#C98A20'}
          sub={burnTrend === 'trending' ? 'linear trend' : 'high variance'}
        />
      </div>

      {/* Trend chart */}
      <Panel
        title="Spend Trajectory"
        badge="90-DAY HISTORY + 60-DAY PROJECTION"
        sub={`Linear regression on 30-day window · R² ${Math.round(regressionR2 * 100)}% · ±$${confidenceBand}/day band`}
      >
        {budgetAmount && (
          <RunwayGauge days={budgetRunwayDays} budget={budgetAmount} mtd={mtdActual} />
        )}
        <div className="mt-4" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ left: -10, right: 0, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(133,183,235,0.07)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#5b6175', fontSize: 8, fontFamily: 'monospace' }}
                axisLine={false} tickLine={false}
                interval={14}
              />
              <YAxis
                tick={{ fill: '#5b6175', fontSize: 8, fontFamily: 'monospace' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `$${v}`}
              />
              <Tooltip
                {...CHART_TOOLTIP}
                formatter={(v: number, name: string) => [
                  v !== null ? `$${v.toFixed(2)}` : '—',
                  name === 'actual' ? 'Actual' : name === 'projected' ? 'Projected' : name,
                ]}
              />
              {/* Confidence band */}
              <Area dataKey="band_hi" stroke="none" fill="rgba(55,138,221,0.08)" name="Upper bound" />
              <Area dataKey="band_lo" stroke="none" fill="rgba(7,30,61,1)" name="Lower bound" />
              {/* Actual spend */}
              <Line
                type="monotone" dataKey="actual" name="actual"
                stroke="#2dd4bf" strokeWidth={1.8} dot={false}
                connectNulls={false}
              />
              {/* Projected spend */}
              <Line
                type="monotone" dataKey="projected" name="projected"
                stroke="#378ADD" strokeWidth={1.5} dot={false}
                strokeDasharray="5 3" connectNulls={false}
              />
              {/* Budget line */}
              {budgetAmount && (
                <ReferenceLine
                  y={budgetAmount / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
                  stroke="#E24B4A"
                  strokeDasharray="4 2"
                  strokeWidth={1}
                  label={{ value: 'budget/day', fill: '#E24B4A', fontSize: 8, fontFamily: 'monospace' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className={`flex gap-5 mt-3 ${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: '#2dd4bf' }} />
            Actual daily spend
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: '#378ADD', opacity: 0.7, borderTop: '1px dashed #378ADD' }} />
            Projected (linear regression)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-2 rounded" style={{ background: 'rgba(55,138,221,0.15)' }} />
            Confidence band ±${confidenceBand}/day
          </span>
        </div>
      </Panel>

      {/* 3-month outlook */}
      <Panel title="3-Month Outlook" badge="PROJECTED · LINEAR TREND">
        <div className="grid md:grid-cols-3 gap-3 mt-2">
          {monthlyForecasts.map((mf, i) => (
            <div
              key={mf.month}
              className="p-4 rounded-[12px]"
              style={{
                background: i === 0 ? 'rgba(55,138,221,0.08)' : 'rgba(133,183,235,0.04)',
                border: `1px solid ${i === 0 ? 'rgba(55,138,221,0.20)' : 'rgba(133,183,235,0.08)'}`,
              }}
            >
              <div className={`${mono} text-[9px] mb-2`} style={{ color: 'rgba(133,183,235,0.45)' }}>
                {mf.label.toUpperCase()}
              </div>
              <div className="text-[22px] font-bold mb-1" style={{ color: '#EBF4FF' }}>
                {fmtUSD(mf.projected)}
              </div>
              {budgetAmount && (
                <div className={`${mono} text-[9.5px]`} style={{ color: mf.projected > budgetAmount ? '#E24B4A' : '#22A06B' }}>
                  {mf.projected > budgetAmount
                    ? `▲ ${fmtUSD(mf.projected - budgetAmount)} over budget`
                    : `✓ ${fmtUSD(budgetAmount - mf.projected)} headroom`}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      {/* Methodology */}
      <Panel title="Forecast Methodology" sub="Transparent — check the math">
        <div className="grid md:grid-cols-3 gap-2 mt-2">
          {[
            { icon: '↗', title: 'Linear regression',   desc: `OLS on last 30 days of daily spend. R² = ${Math.round(regressionR2 * 100)}% — ${burnTrend === 'trending' ? 'strong linear signal' : 'high day-to-day variance, use with caution'}.` },
            { icon: '◈', title: 'Confidence band',     desc: `±$${confidenceBand}/day (1 standard deviation of recent daily spend). Widens when spend is volatile.` },
            { icon: '◫', title: 'Month-end projection', desc: `MTD actual ($${mtdActual.toFixed(0)}) + remaining days × avg daily burn ($${avgDailyBurn.toFixed(2)}).` },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="p-3 rounded-[10px]"
              style={{ background: 'rgba(133,183,235,0.04)', border: '1px solid rgba(133,183,235,0.08)' }}
            >
              <div className="text-[16px] mb-1.5" style={{ color: 'rgba(133,183,235,0.45)' }}>{icon}</div>
              <p className="text-[12px] font-medium mb-1" style={{ color: '#EBF4FF' }}>{title}</p>
              <p className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
