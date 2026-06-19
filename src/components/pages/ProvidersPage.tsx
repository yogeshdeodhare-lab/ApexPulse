'use client'

import { useEffect, useState } from 'react'
import { KpiCard, Panel, Note, mono, fmtUSD, fmtTokens } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModelBreakdown {
  id: string; name: string; color: string
  cost: number; tokens: number; requests: number; pct: number
}

interface TokenProvider {
  id: string; name: string; color: string
  mtdSpend: number; mtdTokens: number; mtdRequests: number
  topModel: string; models: ModelBreakdown[]
}

interface SeatProvider {
  id: string; name: string; color: string
  seats: number; pricePerSeat: number; mtdSpend: number; period: string
}

interface ProvidersData {
  tokenProviders: TokenProvider[]
  seatProviders:  SeatProvider[]
  totalMtdSpend:  number
  totalTokenSpend:number
  totalSeatSpend: number
  totalSeats:     number
}

// ── Provider initials badge ───────────────────────────────────────────────────

const PROVIDER_INIT: Record<string, string> = {
  anthropic: 'AC', openai: 'OA', google: 'GG', azure: 'AZ', bedrock: 'AB',
  github_copilot: 'GH', cursor: 'CR', windsurf: 'WS',
}

function InitBadge({ id, color, size = 36 }: { id: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-[8px] grid place-items-center text-[11px] font-bold shrink-0"
      style={{ width: size, height: size, background: color, color: '#0c0e14' }}
    >
      {PROVIDER_INIT[id] ?? id.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── Model mini-bars inside a provider card ────────────────────────────────────

function ModelBars({ models }: { models: ModelBreakdown[] }) {
  const top = models.slice(0, 4)
  return (
    <div className="space-y-1.5 mt-3">
      {top.map(m => (
        <div key={m.id}>
          <div className="flex justify-between items-baseline mb-0.5">
            <span className={`${mono} text-[9.5px] text-muted`}>{m.name}</span>
            <span className={`${mono} text-[9.5px] text-dim`}>{m.pct}%</span>
          </div>
          <div className="h-1.5 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Token provider card ───────────────────────────────────────────────────────

function TokenProviderCard({ p }: { p: TokenProvider }) {
  return (
    <div className="bg-panel border border-line rounded-[13px] p-4 flex flex-col gap-2 hover:border-line/80 transition-colors">
      <div className="flex items-center gap-3">
        <InitBadge id={p.id} color={p.color} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{p.name}</div>
          <div className={`${mono} text-[10px] text-muted`}>API · token billing</div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green/10 border border-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse2" />
          <span className={`${mono} text-[9px] text-green`}>active</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-line">
        <div>
          <div className="text-[11px] font-bold" style={{ color: p.color }}>{fmtUSD(p.mtdSpend)}</div>
          <div className={`${mono} text-[9px] text-dim`}>MTD spend</div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-muted">{fmtTokens(p.mtdTokens)}</div>
          <div className={`${mono} text-[9px] text-dim`}>tokens</div>
        </div>
        <div>
          <div className="text-[11px] font-bold text-muted">{p.mtdRequests.toLocaleString()}</div>
          <div className={`${mono} text-[9px] text-dim`}>requests</div>
        </div>
      </div>

      {p.models.length > 0 && (
        <div className="pt-1">
          <div className={`${mono} text-[9px] text-dim mb-1`}>MODEL MIX · MTD</div>
          <ModelBars models={p.models} />
        </div>
      )}
    </div>
  )
}

// ── Seat provider card ────────────────────────────────────────────────────────

function SeatProviderCard({ p }: { p: SeatProvider }) {
  const costPerDev = p.pricePerSeat
  return (
    <div className="bg-panel border border-line rounded-[13px] p-4 hover:border-line/80 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <InitBadge id={p.id} color={p.color} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold truncate">{p.name}</div>
          <div className={`${mono} text-[10px] text-muted`}>Seat · ${costPerDev}/dev/mo</div>
        </div>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green/10 border border-green/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse2" />
          <span className={`${mono} text-[9px] text-green`}>active</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-line">
        <div>
          <div className="text-[13px] font-bold" style={{ color: p.color }}>{fmtUSD(p.mtdSpend)}</div>
          <div className={`${mono} text-[9px] text-dim`}>monthly cost</div>
        </div>
        <div>
          <div className="text-[13px] font-bold text-muted">{p.seats}</div>
          <div className={`${mono} text-[9px] text-dim`}>seats</div>
        </div>
        <div>
          <div className="text-[13px] font-bold text-muted">${p.pricePerSeat}</div>
          <div className={`${mono} text-[9px] text-dim`}>per seat</div>
        </div>
      </div>
    </div>
  )
}

// ── Provider comparison table ─────────────────────────────────────────────────

function ComparisonTable({ token, seat }: { token: TokenProvider[]; seat: SeatProvider[] }) {
  const totalSpend = [...token.map(p => p.mtdSpend), ...seat.map(p => p.mtdSpend)]
    .reduce((s, c) => s + c, 0)

  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr>
            {['Provider','Type','Models / Seats','MTD Spend','Tokens / Users','Requests','Share'].map(h => (
              <th key={h} className={`${mono} text-[9px] text-muted tracking-[.07em] uppercase text-left py-2 px-2 border-b border-line whitespace-nowrap`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.map(p => (
            <tr key={p.id} className="border-b border-line/50 last:border-none hover:bg-panel2/40 transition-colors">
              <td className="py-2.5 px-2">
                <div className="flex items-center gap-2">
                  <InitBadge id={p.id} color={p.color} size={22} />
                  <span className="font-medium">{p.name}</span>
                </div>
              </td>
              <td className="px-2"><span className={`${mono} text-[9.5px] px-1.5 py-0.5 rounded bg-blue/10 text-blue border border-blue/20`}>API</span></td>
              <td className={`${mono} text-right px-2 text-muted`}>{p.models.length}</td>
              <td className={`${mono} text-right px-2 font-bold`} style={{ color: p.color }}>{fmtUSD(p.mtdSpend)}</td>
              <td className={`${mono} text-right px-2 text-muted`}>{fmtTokens(p.mtdTokens)}</td>
              <td className={`${mono} text-right px-2 text-muted`}>{p.mtdRequests.toLocaleString()}</td>
              <td className={`${mono} text-right px-2 text-dim`}>
                {totalSpend > 0 ? Math.round((p.mtdSpend / totalSpend) * 100) : 0}%
              </td>
            </tr>
          ))}
          {seat.map(p => (
            <tr key={p.id} className="border-b border-line/50 last:border-none hover:bg-panel2/40 transition-colors">
              <td className="py-2.5 px-2">
                <div className="flex items-center gap-2">
                  <InitBadge id={p.id} color={p.color} size={22} />
                  <span className="font-medium">{p.name}</span>
                </div>
              </td>
              <td className="px-2"><span className={`${mono} text-[9.5px] px-1.5 py-0.5 rounded bg-violet/10 text-violet border border-violet/20`}>SEAT</span></td>
              <td className={`${mono} text-right px-2 text-muted`}>{p.seats} seats</td>
              <td className={`${mono} text-right px-2 font-bold`} style={{ color: p.color }}>{fmtUSD(p.mtdSpend)}</td>
              <td className={`${mono} text-right px-2 text-dim`}>—</td>
              <td className={`${mono} text-right px-2 text-dim`}>—</td>
              <td className={`${mono} text-right px-2 text-dim`}>
                {totalSpend > 0 ? Math.round((p.mtdSpend / totalSpend) * 100) : 0}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const [data,    setData]    = useState<ProvidersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/providers')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-24 text-muted text-[13px]">Loading provider data…</div>
  if (error)   return <div className="text-rose p-4">{error}</div>
  if (!data) return null

  const { tokenProviders, seatProviders, totalMtdSpend, totalTokenSpend, totalSeatSpend, totalSeats } = data

  return (
    <div className="animate-fadeIn space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total MTD Spend" value={fmtUSD(totalMtdSpend)} accent="var(--cyan)"
          delta={`API + seat billing`} deltaGood />
        <KpiCard label="API Providers" value={tokenProviders.length} accent="var(--blue)"
          delta={`${fmtUSD(totalTokenSpend)} token spend`} deltaGood />
        <KpiCard label="Seat Providers" value={seatProviders.length} accent="var(--violet)"
          delta={`${fmtUSD(totalSeatSpend)} seat spend`} deltaGood />
        <KpiCard label="Total Dev Seats" value={totalSeats.toLocaleString()} accent="var(--green)"
          delta="across coding tools" deltaGood />
      </div>

      {/* Token providers grid */}
      {tokenProviders.length > 0 && (
        <Panel title="API providers" badge={`${tokenProviders.length} ACTIVE · TOKEN BILLING`}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {tokenProviders.map(p => <TokenProviderCard key={p.id} p={p} />)}
          </div>
        </Panel>
      )}

      {/* Seat providers */}
      {seatProviders.length > 0 && (
        <Panel title="Seat-based providers" badge={`${seatProviders.length} ACTIVE · FLAT MONTHLY`}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {seatProviders.map(p => <SeatProviderCard key={p.id} p={p} />)}
          </div>
        </Panel>
      )}

      {/* Comparison table */}
      <Panel title="Provider summary" badge="MTD · ALL BILLING TYPES">
        <ComparisonTable token={tokenProviders} seat={seatProviders} />
      </Panel>

      {/* Note */}
      <Note icon="ℹ" accent="var(--blue)">
        <b>Seat billing</b> (GitHub Copilot, Cursor, Windsurf) is a flat monthly cost based on active seats — not metered by token usage.
        <b> API billing</b> (Anthropic, OpenAI, Google, Azure, Bedrock) is metered per token at the rates shown on each provider's pricing page.
        All figures reflect the <b>current billing month</b>.
      </Note>
    </div>
  )
}
