'use client'

import { useEffect, useState } from 'react'
import { KpiCard, Panel, Note, mono, fmtUSD, fmtTokens } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Member {
  userId: string; displayName: string
  cost: number; tokens: number; requests: number; pct: number
}
interface Project {
  projectId: string; cost: number; tokens: number; requests: number; pct: number
}
interface ProviderSlice { provider: string; cost: number }

interface Team {
  id: string; displayName: string; color: string
  devs: number; mtdSpend: number; mtdTokens: number; mtdRequests: number
  avgCostPerDev: number; spendPct: number; cacheTokens: number
  members: Member[]; projects: Project[]; providers: ProviderSlice[]
  topProject: string
}

interface TeamsSummary {
  totalTeams: number; totalSpend: number; totalDevs: number
  avgCostPerDev: number; topTeam: string
}

interface TeamsData { summary: TeamsSummary; teams: Team[] }

// ── Spend bar ─────────────────────────────────────────────────────────────────

function SpendBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(133,183,235,0.08)' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.max(pct, 2)}%`, background: color, opacity: 0.85 }}
      />
    </div>
  )
}

// ── Provider mini-badges ──────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: '#2dd4bf', openai: '#34d399', google: '#4ade80',
  azure: '#818cf8', bedrock: '#f472b6',
}
const PROVIDER_INIT: Record<string, string> = {
  anthropic: 'AC', openai: 'OA', google: 'GG', azure: 'AZ', bedrock: 'AB',
}

function ProviderMiniChips({ providers }: { providers: ProviderSlice[] }) {
  const total = providers.reduce((s, p) => s + p.cost, 0)
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {providers.slice(0, 3).map(p => (
        <span
          key={p.provider}
          className={`${mono} text-[8.5px] px-1.5 py-0.5 rounded`}
          style={{
            background: `${PROVIDER_COLORS[p.provider] ?? '#7B96C9'}18`,
            color: PROVIDER_COLORS[p.provider] ?? '#7B96C9',
            border: `1px solid ${PROVIDER_COLORS[p.provider] ?? '#7B96C9'}28`,
          }}
          title={`${p.provider}: ${fmtUSD(p.cost)}`}
        >
          {PROVIDER_INIT[p.provider] ?? p.provider.slice(0, 2).toUpperCase()}
          {' '}{total > 0 ? Math.round((p.cost / total) * 100) : 0}%
        </span>
      ))}
    </div>
  )
}

// ── Team card (expandable) ────────────────────────────────────────────────────

function TeamCard({ team, maxSpend }: { team: Team; maxSpend: number }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-[14px] overflow-hidden card-lift"
      style={{
        background: 'rgba(13,40,69,0.78)',
        border: '1px solid rgba(133,183,235,0.14)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {/* Top accent line */}
      <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${team.color} 0%, transparent 70%)` }} />

      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Team avatar */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[12px] font-bold flex-shrink-0"
            style={{ background: `${team.color}22`, color: team.color, border: `1px solid ${team.color}35` }}
          >
            {team.displayName.slice(0, 2).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>{team.displayName}</span>
              <span
                className={`${mono} text-[9px] px-1.5 py-0.5 rounded-full`}
                style={{ background: `${team.color}18`, color: team.color, border: `1px solid ${team.color}30` }}
              >
                {team.devs} {team.devs === 1 ? 'dev' : 'devs'}
              </span>
            </div>
            <div className="mt-1">
              <ProviderMiniChips providers={team.providers} />
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-[16px] font-semibold" style={{ color: team.color }}>{fmtUSD(team.mtdSpend)}</div>
            <div className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>MTD</div>
          </div>
        </div>

        {/* Spend bar relative to team with max spend */}
        <div className="mt-3">
          <SpendBar pct={(team.mtdSpend / maxSpend) * 100} color={team.color} />
          <div className={`flex justify-between ${mono} text-[9.5px] mt-1`} style={{ color: 'rgba(133,183,235,0.45)' }}>
            <span>{fmtTokens(team.mtdTokens)} tokens · {team.mtdRequests.toLocaleString()} req</span>
            <span>{team.spendPct}% of total · ${team.avgCostPerDev.toFixed(0)}/dev</span>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          className={`${mono} text-[9.5px] mt-3 flex items-center gap-1.5 transition-colors`}
          style={{ color: expanded ? team.color : 'rgba(133,183,235,0.45)' }}
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span>{expanded ? 'Hide' : 'Show'} member & project breakdown</span>
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4"
          style={{ borderTop: '1px solid rgba(133,183,235,0.08)' }}
        >
          <div className="grid md:grid-cols-2 gap-4 pt-3">
            {/* Members table */}
            <div>
              <div className={`${mono} text-[9px] tracking-[.12em] uppercase mb-2`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                MEMBER ATTRIBUTION
              </div>
              <div className="space-y-2">
                {team.members.map(m => (
                  <div key={m.userId}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                          style={{ background: `${team.color}20`, color: team.color }}
                        >
                          {m.displayName.split(' ')[0][0]}
                        </div>
                        <span className="text-[11.5px]" style={{ color: '#EBF4FF' }}>{m.displayName}</span>
                      </div>
                      <div className="text-right">
                        <div className={`${mono} text-[11px] font-medium`} style={{ color: team.color }}>{fmtUSD(m.cost)}</div>
                        <div className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>{m.pct}%</div>
                      </div>
                    </div>
                    <SpendBar pct={m.pct} color={team.color} />
                  </div>
                ))}
              </div>
            </div>

            {/* Projects table */}
            <div>
              <div className={`${mono} text-[9px] tracking-[.12em] uppercase mb-2`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                PROJECT BREAKDOWN
              </div>
              <div className="space-y-2">
                {team.projects.map(p => (
                  <div key={p.projectId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`${mono} text-[10.5px]`} style={{ color: 'rgba(235,244,255,0.75)' }}>
                        {p.projectId}
                      </span>
                      <div className="text-right">
                        <span className={`${mono} text-[11px] font-medium`} style={{ color: '#85B7EB' }}>
                          {fmtUSD(p.cost)}
                        </span>
                        <span className={`${mono} text-[9px] ml-2`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                          {p.requests.toLocaleString()} req
                        </span>
                      </div>
                    </div>
                    <SpendBar pct={p.pct} color="#378ADD" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cross-team comparison chart ───────────────────────────────────────────────

function ComparisonChart({ teams }: { teams: Team[] }) {
  const maxSpend = Math.max(...teams.map(t => t.mtdSpend))

  return (
    <div className="space-y-3 mt-2">
      {teams.map(t => (
        <div key={t.id}>
          <div className="flex items-center gap-3 mb-1.5">
            <div
              className="w-6 h-6 rounded-[6px] grid place-items-center text-[9px] font-bold shrink-0"
              style={{ background: `${t.color}22`, color: t.color, border: `1px solid ${t.color}35` }}
            >
              {t.displayName.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[12px] font-medium flex-1" style={{ color: '#EBF4FF' }}>{t.displayName}</span>
            <span className={`${mono} text-[12px] font-semibold`} style={{ color: t.color }}>{fmtUSD(t.mtdSpend)}</span>
            <span className={`${mono} text-[10px] w-8 text-right`} style={{ color: 'rgba(133,183,235,0.45)' }}>{t.spendPct}%</span>
          </div>
          {/* Stacked bar: show provider breakdown within spend */}
          <div className="h-3 rounded-full overflow-hidden flex" style={{ background: 'rgba(133,183,235,0.06)' }}>
            {t.providers.map((p, i) => {
              const w = maxSpend > 0 ? (p.cost / maxSpend) * 100 : 0
              return (
                <div
                  key={p.provider}
                  className="h-full transition-all duration-700"
                  style={{
                    width: `${w}%`,
                    background: PROVIDER_COLORS[p.provider] ?? '#7B96C9',
                    opacity: 0.75 - i * 0.12,
                  }}
                  title={`${p.provider}: ${fmtUSD(p.cost)}`}
                />
              )
            })}
          </div>
          <div className={`flex justify-between ${mono} text-[9px] mt-1`} style={{ color: 'rgba(133,183,235,0.35)' }}>
            <span>{t.devs} devs · {fmtTokens(t.mtdTokens)} tokens</span>
            <span>${t.avgCostPerDev.toFixed(0)}/dev · top: {t.topProject}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Cross-team table ──────────────────────────────────────────────────────────

function TeamTable({ teams }: { teams: Team[] }) {
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-[12px] border-collapse">
        <thead>
          <tr>
            {['Team','Devs','MTD Spend','Tokens','Requests','Cache','$/Dev','Top Project','Share'].map(h => (
              <th
                key={h}
                className={`${mono} text-[9px] tracking-[.08em] uppercase text-left py-2 px-2 whitespace-nowrap`}
                style={{ color: 'rgba(133,183,235,0.45)', borderBottom: '1px solid rgba(133,183,235,0.10)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map(t => {
            const cacheRate = t.mtdTokens > 0 ? Math.round((t.cacheTokens / (t.mtdTokens + t.cacheTokens)) * 100) : 0
            return (
              <tr
                key={t.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid rgba(133,183,235,0.06)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(55,138,221,0.04)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded-[5px] flex items-center justify-center text-[8px] font-bold"
                      style={{ background: `${t.color}22`, color: t.color }}
                    >
                      {t.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-medium" style={{ color: '#EBF4FF' }}>{t.displayName}</span>
                  </div>
                </td>
                <td className={`${mono} text-right px-2`} style={{ color: 'rgba(133,183,235,0.60)' }}>{t.devs}</td>
                <td className={`${mono} text-right px-2 font-semibold`} style={{ color: t.color }}>{fmtUSD(t.mtdSpend)}</td>
                <td className={`${mono} text-right px-2`} style={{ color: 'rgba(133,183,235,0.60)' }}>{fmtTokens(t.mtdTokens)}</td>
                <td className={`${mono} text-right px-2`} style={{ color: 'rgba(133,183,235,0.60)' }}>{t.mtdRequests.toLocaleString()}</td>
                <td className={`${mono} text-right px-2`} style={{ color: '#7B96C9' }}>{cacheRate}%</td>
                <td className={`${mono} text-right px-2`} style={{ color: 'rgba(133,183,235,0.60)' }}>${t.avgCostPerDev.toFixed(0)}</td>
                <td className={`${mono} px-2 text-[10.5px]`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                  {t.topProject}
                </td>
                <td className="px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(133,183,235,0.08)', minWidth: 40 }}>
                      <div className="h-full rounded-full" style={{ width: `${t.spendPct}%`, background: t.color, opacity: 0.8 }} />
                    </div>
                    <span className={`${mono} text-[10px]`} style={{ color: t.color }}>{t.spendPct}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const [data,    setData]    = useState<TeamsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/teams')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24" style={{ color: 'rgba(133,183,235,0.50)' }}>
      Loading team attribution data…
    </div>
  )
  if (error) return <div className="text-rose p-4">{error}</div>
  if (!data || !data.teams.length) return (
    <Note icon="ℹ" accent="#378ADD">
      No team data yet. Run <code className={`${mono} text-[11px] px-1.5 py-0.5 rounded`} style={{ background: 'rgba(55,138,221,0.1)' }}>npm run db:setup</code> to seed demo data.
    </Note>
  )

  const { summary, teams } = data
  const maxSpend = Math.max(...teams.map(t => t.mtdSpend))

  return (
    <div className="animate-slideUp space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total MTD Spend" value={fmtUSD(summary.totalSpend)} accent="#378ADD"
          delta={`${summary.totalTeams} active teams`} deltaGood />
        <KpiCard label="Active Devs" value={summary.totalDevs} accent="#85B7EB"
          delta="across all teams" deltaGood />
        <KpiCard label="Avg Cost / Dev" value={fmtUSD(summary.avgCostPerDev)} accent="#22A06B"
          delta="this month" deltaGood />
        <KpiCard label="Top Team" value={summary.topTeam} accent="#C98A20"
          delta="highest MTD spend" />
      </div>

      {/* Cross-team comparison + summary table */}
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-3">
        <Panel title="Spend comparison" badge="MTD · BY PROVIDER · STACKED">
          <ComparisonChart teams={teams} />
          <div className={`flex gap-3 mt-3 pt-2 flex-wrap`} style={{ borderTop: '1px solid rgba(133,183,235,0.08)' }}>
            {Object.entries(PROVIDER_COLORS).map(([id, color]) => (
              <span key={id} className={`flex items-center gap-1.5 ${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </span>
            ))}
          </div>
        </Panel>

        <Panel title="Team summary" badge="MTD · ALL TEAMS">
          <TeamTable teams={teams} />
        </Panel>
      </div>

      {/* Individual team cards */}
      <div className={`${mono} text-[9px] tracking-[.12em] uppercase px-1`} style={{ color: 'rgba(133,183,235,0.35)' }}>
        TEAM ATTRIBUTION CARDS · CLICK TO EXPAND MEMBERS & PROJECTS
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {teams.map(t => <TeamCard key={t.id} team={t} maxSpend={maxSpend} />)}
      </div>

      {/* Attribution note */}
      <Note icon="ℹ" accent="#378ADD">
        <b>Attribution methodology:</b> Spend is attributed by <code className={`${mono} text-[10.5px] px-1`} style={{ background: 'rgba(55,138,221,0.1)', borderRadius: 4 }}>teamId</code> recorded at call time.
        Multi-provider API costs (Anthropic, OpenAI, Google, Azure, Bedrock) are summed together.
        Seat costs for GitHub Copilot, Cursor, and Windsurf are tracked separately on the Providers page
        and are not included in per-team token attribution.
      </Note>
    </div>
  )
}
