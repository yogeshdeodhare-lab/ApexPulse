'use client'

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { KpiCard, Panel, Note, StatusBadge, mono, fmtUSD, fmtTokens, getBarColor } from '@/components/ui'

interface ModelMixEntry {
  model: string; displayName: string; tier: string; color: string
  cost: number; tokens: number; requests: number; pct: number
}
interface ProviderMixEntry {
  provider: string; name: string; color: string
  cost: number; tokens: number; requests: number; pct: number
}
interface ProjectEntry {
  projectId: string; cost: number; tokens: number; requests: number; cacheTokens: number
}
interface BudgetStatus {
  amount: number; consumed: number; remaining: number; utilizationPct: number
}
export interface DashboardStats {
  mtdSpend: number; mtdTokens: number; mtdRequests: number
  cacheHitRate: number; avgCostPerRequest: number; cacheSavings: number
  dailyTrend: { date: string; billable: number; cached: number }[]
  modelMix: ModelMixEntry[]
  providerMix: ProviderMixEntry[]
  projectBreakdown: ProjectEntry[]
  budget: BudgetStatus | null
}

const CHART_TOOLTIP = {
  contentStyle: { background: '#13161f', border: '1px solid #272c3a', borderRadius: 8, fontSize: 12 },
  labelStyle:   { color: '#8a91a6', fontFamily: 'monospace' },
  itemStyle:    { color: '#e8eaf0' },
}

function TokenTrendChart({ data }: { data: DashboardStats['dailyTrend'] }) {
  return (
    <ResponsiveContainer width="100%" height={130}>
      <BarChart data={data} barGap={2} barCategoryGap="28%">
        <XAxis dataKey="date" tick={{ fill: '#5b6175', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip {...CHART_TOOLTIP} formatter={(v: number) => [`${v.toFixed(2)}M`, '']} />
        <Bar dataKey="billable" name="billable" fill="url(#billGrad)" radius={[3,3,0,0]} />
        <Bar dataKey="cached"   name="cached"   fill="url(#cacheGrad)" radius={[3,3,0,0]} />
        <defs>
          <linearGradient id="billGrad"  x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2dd4bf" /><stop offset="100%" stopColor="rgba(45,212,191,.2)" />
          </linearGradient>
          <linearGradient id="cacheGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#a78bfa" /><stop offset="100%" stopColor="rgba(167,139,250,.15)" />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  )
}

function ProviderMixDonut({ data }: { data: ProviderMixEntry[] }) {
  if (!data.length) return null
  return (
    <div className="flex items-center gap-5 flex-wrap mt-3">
      <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
        <PieChart width={110} height={110}>
          <Pie data={data} dataKey="pct" cx={50} cy={50} innerRadius={30} outerRadius={52} paddingAngle={2}>
            {data.map((p, i) => <Cell key={i} fill={p.color} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <b className="text-[17px] font-semibold">{data.length}</b>
          <span className={`${mono} text-[9px] text-muted`}>PROVIDERS</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-[130px]">
        {data.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="w-[9px] h-[9px] rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="flex-1">{p.name}</span>
            <span className={`${mono} text-muted`}>{p.pct}%</span>
            <span className={`${mono} text-dim text-[10px]`}>{fmtUSD(p.cost)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function OverviewPage({ stats }: { stats: DashboardStats }) {
  const b = stats.budget
  const providerMix = stats.providerMix ?? []
  const anomaly = stats.modelMix.find(m => m.tier === 'flagship' && m.pct > 40)

  return (
    <div className="animate-fadeIn space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="MTD Spend" value={fmtUSD(stats.mtdSpend)} accent="var(--cyan)"
          delta={b ? `${b.utilizationPct}% of $${(b.amount / 1000).toFixed(0)}k budget` : undefined}
          deltaGood={!b || b.utilizationPct < 80} />
        <KpiCard label="MTD Tokens" value={fmtTokens(stats.mtdTokens)} accent="var(--blue)"
          delta={`${stats.mtdRequests.toLocaleString()} requests`} deltaGood />
        <KpiCard label="Cache Hit Rate" value={stats.cacheHitRate} unit="%" accent="var(--violet)"
          delta={`~${fmtUSD(stats.cacheSavings)} saved`} deltaGood />
        <KpiCard label="Cost / Request" value={fmtUSD(stats.avgCostPerRequest, 4)} accent="var(--green)" />
      </div>

      {/* Budget bar if exists */}
      {b && (
        <div className="bg-panel border border-line rounded-[13px] px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className={`${mono} text-[10px] text-muted tracking-[.05em] uppercase`}>Monthly Budget</span>
            <StatusBadge pct={b.utilizationPct} />
          </div>
          <div className="h-2.5 bg-panel2 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(b.utilizationPct, 100)}%`, background: getBarColor(b.utilizationPct) }} />
          </div>
          <div className={`flex justify-between ${mono} text-[10px] text-dim mt-1.5`}>
            <span>{fmtUSD(b.consumed)} consumed</span>
            <span>{fmtUSD(b.remaining)} remaining</span>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3">
        <Panel title="Token consumption" badge="LAST 14 DAYS" sub="billable (input+output) vs cached · M tokens">
          <TokenTrendChart data={stats.dailyTrend} />
          <div className={`flex gap-4 mt-2 ${mono} text-[10.5px] text-muted`}>
            <span className="flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-sm inline-block" style={{ background: '#2dd4bf' }} />billable
            </span>
            <span className="flex items-center gap-1.5">
              <i className="w-2 h-2 rounded-sm inline-block" style={{ background: '#a78bfa' }} />cached (90% cheaper)
            </span>
          </div>
        </Panel>

        <Panel title="Provider mix" badge="BY SPEND" sub="API billing distribution">
          <ProviderMixDonut data={providerMix} />
          {anomaly && (
            <Note icon="⚠" accent="var(--amber)">
              <b>Routing anomaly:</b> {anomaly.displayName} drives {anomaly.pct}% of spend.
              Est. <b>{fmtUSD(anomaly.cost * 0.55)}/mo</b> savings routing simpler tasks to Haiku.
            </Note>
          )}
        </Panel>
      </div>

      {/* Project table */}
      <Panel title="Spend by project" badge="MTD">
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12.5px] border-collapse">
            <thead>
              <tr>
                {['Project', 'Tokens', 'Requests', 'Cache hit', 'MTD Cost'].map(h => (
                  <th key={h} className={`${mono} text-[10px] text-muted tracking-[.07em] uppercase text-left py-2 px-2 border-b border-line`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.projectBreakdown.map((p, i) => {
                const allInput  = p.tokens / 2 + p.cacheTokens
                const cacheRate = allInput > 0 ? Math.round((p.cacheTokens / allInput) * 100) : 0
                return (
                  <tr key={i} className="border-b border-line/50 last:border-none hover:bg-panel2/40 transition-colors">
                    <td className="py-2.5 px-2 font-medium">{p.projectId}</td>
                    <td className={`${mono} text-right px-2 text-muted`}>{fmtTokens(p.tokens)}</td>
                    <td className={`${mono} text-right px-2 text-muted`}>{p.requests.toLocaleString()}</td>
                    <td className={`${mono} text-right px-2 text-violet`}>{cacheRate}%</td>
                    <td className={`${mono} text-right px-2 text-cyan font-medium`}>{fmtUSD(p.cost)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}
