'use client'

import { useEffect, useState } from 'react'
import { KpiCard, Panel, mono, fmtUSD } from '@/components/ui'
import type { OptimizationOpportunity, OptType, Priority } from '@/app/api/optimization/route'

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<OptType, { label: string; icon: string; color: string; bg: string }> = {
  model_routing:      { label: 'Model Routing',       icon: '⇄', color: '#378ADD', bg: 'rgba(55,138,221,0.12)' },
  cache_strategy:     { label: 'Cache Strategy',      icon: '⚡', color: '#22A06B', bg: 'rgba(34,160,107,0.12)' },
  seat_roi:           { label: 'Seat ROI',            icon: '💺', color: '#C98A20', bg: 'rgba(201,138,32,0.12)' },
  provider_arbitrage: { label: 'Provider Arbitrage',  icon: '⇌', color: '#7C3AED', bg: 'rgba(124,58,237,0.12)' },
  token_efficiency:   { label: 'Token Efficiency',    icon: '◈', color: '#F472B6', bg: 'rgba(244,114,182,0.12)' },
}

const PRIORITY_CFG: Record<Priority, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRITICAL', color: '#E24B4A', bg: 'rgba(226,75,74,0.12)' },
  high:     { label: 'HIGH',     color: '#C98A20', bg: 'rgba(201,138,32,0.12)' },
  medium:   { label: 'MEDIUM',   color: '#378ADD', bg: 'rgba(55,138,221,0.10)' },
  low:      { label: 'LOW',      color: 'rgba(133,183,235,0.40)', bg: 'rgba(133,183,235,0.06)' },
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: OptType }) {
  const cfg = TYPE_CFG[type]
  return (
    <span className={`${mono} text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CFG[priority]
  return (
    <span className={`${mono} text-[9px] font-bold px-2 py-0.5 rounded-full`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
      {cfg.label}
    </span>
  )
}

// ── Savings bar ───────────────────────────────────────────────────────────────

function SavingsBar({ current, target }: { current: number; target: number }) {
  const pct = current > 0 ? Math.round((target / current) * 100) : 100
  return (
    <div className="flex items-center gap-3 mt-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(133,183,235,0.12)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#22A06B,#378ADD)' }} />
      </div>
      <span className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>
        {pct}% of current
      </span>
    </div>
  )
}

// ── Effectiveness link ────────────────────────────────────────────────────────

function EffectivenessLink({ eff }: { eff: NonNullable<OptimizationOpportunity['effectiveness']> }) {
  const isAboveBench = eff.value > eff.benchmark
  const good = eff.metric === 'Bug Rate' ? !isAboveBench : isAboveBench
  return (
    <div className="mt-3 rounded-[9px] p-2.5"
      style={{ background: 'rgba(201,138,32,0.07)', border: '1px solid rgba(201,138,32,0.18)' }}>
      <div className={`${mono} text-[9px] font-bold mb-1`} style={{ color: '#C98A20' }}>
        ⟳ EFFECTIVENESS LINK · {eff.tool}
      </div>
      <div className="flex items-center gap-4">
        <div>
          <div className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.45)' }}>{eff.metric}</div>
          <div className="text-[16px] font-bold" style={{ color: good ? '#E24B4A' : '#22A06B' }}>
            {eff.value}%
          </div>
          <div className={`${mono} text-[8px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
            benchmark {eff.benchmark}%
          </div>
        </div>
        <div className="flex-1 text-[10px] leading-relaxed" style={{ color: 'rgba(235,244,255,0.55)' }}>
          {eff.interpretation}
        </div>
      </div>
    </div>
  )
}

// ── Opportunity card ──────────────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: OptimizationOpportunity }) {
  const [showCalc, setShowCalc] = useState(false)

  return (
    <div className="rounded-[14px] overflow-hidden" style={{
      background: 'rgba(13,40,69,0.80)',
      border: '1px solid rgba(133,183,235,0.13)',
      backdropFilter: 'blur(10px)',
    }}>
      {/* Top accent by type */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg,${TYPE_CFG[opp.type].color}88 0%,transparent 80%)` }} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-2 flex-wrap mb-2">
          <TypeBadge type={opp.type} />
          <PriorityBadge priority={opp.priority} />
          <span className={`${mono} text-[9px] ml-auto`} style={{ color: 'rgba(133,183,235,0.30)' }}>
            {opp.dataPoints} data pts · {opp.confidence}% confidence
          </span>
        </div>

        <h3 className="text-[13px] font-semibold mb-1" style={{ color: '#EBF4FF' }}>{opp.title}</h3>
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'rgba(235,244,255,0.55)' }}>
          {opp.description}
        </p>

        {/* Before → After cost comparison */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3 rounded-[10px] mb-3"
          style={{ background: 'rgba(7,30,61,0.60)', border: '1px solid rgba(133,183,235,0.08)' }}>
          {/* Current */}
          <div>
            <div className={`${mono} text-[8.5px] mb-1`} style={{ color: 'rgba(133,183,235,0.35)' }}>CURRENT</div>
            <div className={`${mono} text-[9px] mb-0.5`} style={{ color: 'rgba(235,244,255,0.50)' }}>{opp.currentLabel}</div>
            <div className="text-[18px] font-bold" style={{ color: '#E24B4A' }}>
              {fmtUSD(opp.currentCost)}<span className="text-[11px] font-normal">/mo</span>
            </div>
          </div>

          <div className="text-[20px] font-light" style={{ color: 'rgba(133,183,235,0.25)' }}>→</div>

          {/* Target */}
          <div className="text-right">
            <div className={`${mono} text-[8.5px] mb-1`} style={{ color: 'rgba(133,183,235,0.35)' }}>TARGET</div>
            <div className={`${mono} text-[9px] mb-0.5`} style={{ color: 'rgba(235,244,255,0.50)' }}>{opp.targetLabel}</div>
            <div className="text-[18px] font-bold" style={{ color: '#22A06B' }}>
              {fmtUSD(opp.targetCost)}<span className="text-[11px] font-normal">/mo</span>
            </div>
          </div>
        </div>

        {/* Savings callout */}
        <div className="flex items-center gap-3 mb-3 p-2.5 rounded-[9px]"
          style={{ background: 'rgba(34,160,107,0.08)', border: '1px solid rgba(34,160,107,0.20)' }}>
          <span className="text-[22px] font-bold" style={{ color: '#22A06B' }}>
            {fmtUSD(opp.monthlySavings)}
          </span>
          <div>
            <div className={`${mono} text-[10px] font-bold`} style={{ color: '#22A06B' }}>
              saved per month
            </div>
            <div className={`${mono} text-[9px]`} style={{ color: 'rgba(34,160,107,0.65)' }}>
              {fmtUSD(opp.annualSavings)} / year
            </div>
          </div>
        </div>

        <SavingsBar current={opp.currentCost} target={opp.targetCost} />

        {/* Effectiveness link (seat ROI only) */}
        {opp.effectiveness && <EffectivenessLink eff={opp.effectiveness} />}

        {/* Recommended action */}
        <div className="mt-3 p-2.5 rounded-[9px]" style={{ background: 'rgba(55,138,221,0.06)', border: '1px solid rgba(55,138,221,0.14)' }}>
          <div className={`${mono} text-[9px] font-bold mb-1`} style={{ color: '#378ADD' }}>⟶ ACTION</div>
          <div className="text-[11px]" style={{ color: 'rgba(235,244,255,0.65)' }}>{opp.recommendedAction}</div>
        </div>

        {/* Calculation basis (collapsible) */}
        <button
          onClick={() => setShowCalc(v => !v)}
          className={`${mono} text-[9px] mt-3 flex items-center gap-1 transition-colors`}
          style={{ color: showCalc ? '#378ADD' : 'rgba(133,183,235,0.35)' }}>
          {showCalc ? '▾' : '▸'} CALCULATION BASIS
        </button>
        {showCalc && (
          <div className={`${mono} text-[10px] mt-2 p-3 rounded-[8px] leading-relaxed`}
            style={{ background: 'rgba(7,30,61,0.50)', color: 'rgba(133,183,235,0.60)', border: '1px solid rgba(133,183,235,0.08)' }}>
            {opp.calculationBasis}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Category summary strip ────────────────────────────────────────────────────

function CategoryStrip({ byCategory, active, onSelect }: {
  byCategory: Record<string, number>
  active: string
  onSelect: (t: string) => void
}) {
  const all = ['all', ...Object.keys(TYPE_CFG)]
  return (
    <div className="flex gap-2 flex-wrap">
      {all.map(key => {
        const isActive = active === key
        const cfg      = key === 'all' ? null : TYPE_CFG[key as OptType]
        const savings  = key === 'all'
          ? Object.values(byCategory).reduce((a, b) => a + b, 0)
          : (byCategory[key] ?? 0)
        return (
          <button key={key} onClick={() => onSelect(key)}
            className={`${mono} text-[9.5px] font-semibold px-3 py-1.5 rounded-full transition-all`}
            style={isActive
              ? { background: cfg ? cfg.bg : 'rgba(55,138,221,0.15)', color: cfg ? cfg.color : '#378ADD', border: `1px solid ${cfg ? cfg.color : '#378ADD'}40` }
              : { background: 'rgba(255,255,255,0.03)', color: 'rgba(133,183,235,0.40)', border: '1px solid rgba(133,183,235,0.10)' }
            }>
            {cfg ? `${cfg.icon} ${cfg.label}` : 'All'}{savings > 0 ? ` · ${fmtUSD(savings)}` : ''}
          </button>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

interface OptData {
  generatedAt:         string
  totalOpportunities:  number
  totalMonthlySavings: number
  totalAnnualSavings:  number
  byCategory:          Record<OptType, number>
  opportunities:       OptimizationOpportunity[]
}

export default function OptimizationPage() {
  const [data,   setData]   = useState<OptData | null>(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/optimization')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
  }, [])

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24" style={{ color: 'rgba(133,183,235,0.40)' }}>
        <span className={`${mono} text-[12px]`}>Analysing cost patterns…</span>
      </div>
    )
  }

  const visible = filter === 'all'
    ? data.opportunities
    : data.opportunities.filter(o => o.type === filter)

  const criticalCount = data.opportunities.filter(o => o.priority === 'critical' || o.priority === 'high').length

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Monthly Savings"
          value={fmtUSD(data.totalMonthlySavings)}
          accent="#22A06B"
          sub={`${fmtUSD(data.totalAnnualSavings)}/year if actioned`}
        />
        <KpiCard
          label="Opportunities"
          value={data.totalOpportunities}
          unit="found"
          accent="#378ADD"
          sub={`${criticalCount} critical or high priority`}
        />
        <KpiCard
          label="Top Category"
          value={
            Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])[0]
              ? TYPE_CFG[Object.entries(data.byCategory).sort((a, b) => b[1] - a[1])[0][0] as OptType]?.label ?? '—'
              : '—'
          }
          accent="#C98A20"
          sub="highest combined savings"
        />
        <KpiCard
          label="Data Freshness"
          value="30"
          unit="days"
          accent="#85B7EB"
          sub={`Generated ${new Date(data.generatedAt).toLocaleTimeString()}`}
        />
      </div>

      {/* Category filter */}
      <Panel title="Optimization Opportunities" badge={`${data.totalOpportunities} IDENTIFIED`}
        sub="Ranked by monthly savings · click a category to filter · expand 'CALCULATION BASIS' for full formula">
        <div className="mt-3 mb-4">
          <CategoryStrip byCategory={data.byCategory} active={filter} onSelect={setFilter} />
        </div>

        {visible.length === 0 ? (
          <div className={`${mono} text-[11px] py-8 text-center`} style={{ color: 'rgba(133,183,235,0.30)' }}>
            No opportunities in this category with current data volume.
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map(opp => <OpportunityCard key={opp.id} opp={opp} />)}
          </div>
        )}
      </Panel>

      {/* Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Panel title="Category Guide" sub="What each optimization type targets">
          <div className="space-y-2 mt-2">
            {Object.entries(TYPE_CFG).map(([key, cfg]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="text-[14px] leading-none mt-0.5">{cfg.icon}</span>
                <div>
                  <div className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</div>
                  <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                    {key === 'model_routing'      && 'Expensive model on small tasks → downgrade to cheaper tier'}
                    {key === 'cache_strategy'     && 'Low prompt cache hit rate → better session/context reuse'}
                    {key === 'seat_roi'           && 'Seat cost vs accepted lines value × acceptance/survival rates'}
                    {key === 'provider_arbitrage' && 'Same model available cheaper via different provider endpoint'}
                    {key === 'token_efficiency'   && 'Cache write waste or verbose output → concise prompts + max_tokens'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Confidence & Calculation Basis" sub="How savings estimates are computed">
          <div className={`${mono} text-[10px] space-y-2 mt-2`} style={{ color: 'rgba(133,183,235,0.50)' }}>
            <p>All savings are computed from <strong style={{ color: '#85B7EB' }}>actual usage records</strong> in the database — not estimates or benchmarks.</p>
            <p><strong style={{ color: '#85B7EB' }}>Model routing:</strong> (srcRate − dstRate) / 1M × avgTokens × monthlyRequests</p>
            <p><strong style={{ color: '#85B7EB' }}>Cache strategy:</strong> extraCacheReads × (inputRate − cacheReadRate) / 1M</p>
            <p><strong style={{ color: '#85B7EB' }}>Seat ROI:</strong> (avgLinesDay × 22 days × $0.05/line) ÷ (seats × pricePerSeat) — linesAccepted is total across all users</p>
            <p><strong style={{ color: '#85B7EB' }}>Provider arbitrage:</strong> (higherRate − lowerRate) / 1M × observed token volume</p>
            <p><strong style={{ color: '#85B7EB' }}>Token efficiency:</strong> 20% output reduction or 3× cache reuse, discounted 40%</p>
            <p className="pt-1" style={{ color: 'rgba(133,183,235,0.30)' }}>Verify pricing at provider pages. Confidence reflects data volume (≥50 requests = high confidence).</p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
