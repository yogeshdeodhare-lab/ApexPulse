'use client'

import { useEffect, useState } from 'react'
import { KpiCard, Panel, Note, SrcBadge, mono, fmtUSD } from '@/components/ui'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolEffectiveness {
  id: string; name: string; init: string; color: string; billing: string
  devs: number; monthlyCost: number; attributionConfidence: 1 | 2 | 3
  acceptanceRate: number | null; linesDay: number
  survivalRate: number | null; bugDensity: number | null
  avgPrMergeTimeHours: number | null; reviewCommentsPerPr: number | null
  productivityIndex: number | null; totalPrs: number
  costPer1k: number; roi: number
}

interface EffectivenessSummary {
  totalTools: number; avgAcceptanceRate: number; totalLinesDay: number
  weightedRoi: number; avgCostPer1k: number; avgSurvivalRate: number
}

interface EffectivenessData {
  summary: EffectivenessSummary
  tools: ToolEffectiveness[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function srcLabel(c: 1 | 2 | 3): 'API' | 'GIT' | 'STAT' {
  return c === 1 ? 'API' : c === 2 ? 'GIT' : 'STAT'
}

function roiColor(roi: number) {
  if (roi >= 4) return '#34d399'
  if (roi >= 3) return '#fbbf24'
  return '#fb7185'
}

function survivalColor(r: number | null) {
  if (r == null) return 'var(--muted)'
  if (r >= 93)  return '#34d399'
  if (r >= 88)  return '#fbbf24'
  return '#fb7185'
}

// ─── Quality comparison chart (AI vs Baseline) ────────────────────────────────

function QualityChart({ tools }: { tools: ToolEffectiveness[] }) {
  if (!tools.length) return null

  const aiSurvival = tools.filter(t => t.survivalRate).reduce((s, t) => s + (t.survivalRate ?? 0), 0) / tools.filter(t => t.survivalRate).length
  const aiMerge    = tools.filter(t => t.avgPrMergeTimeHours).reduce((s, t) => s + (t.avgPrMergeTimeHours ?? 0), 0) / tools.filter(t => t.avgPrMergeTimeHours).length / 24
  const aiComments = tools.filter(t => t.reviewCommentsPerPr).reduce((s, t) => s + (t.reviewCommentsPerPr ?? 0), 0) / tools.filter(t => t.reviewCommentsPerPr).length
  const aiBugDensity = tools.filter(t => t.bugDensity).reduce((s, t) => s + (t.bugDensity ?? 0), 0) / tools.filter(t => t.bugDensity).length

  const metrics = [
    { label: 'Bug density (per 1k lines)', ai: aiBugDensity, base: 3.4, unit: '', note: `${Math.round((1 - aiBugDensity / 3.4) * 100)}% fewer bugs`, low: true },
    { label: 'PR merge time', ai: aiMerge, base: 2.4, unit: 'd', note: `${Math.round((1 - aiMerge / 2.4) * 100)}% faster`, low: true },
    { label: 'Review comments / PR', ai: aiComments, base: 1.8, unit: '', note: `${Math.round((1 - aiComments / 1.8) * 100)}% fewer iterations`, low: true },
    { label: 'Code survival rate', ai: aiSurvival, base: 82, unit: '%', note: `${(aiSurvival - 82).toFixed(1)}pts above baseline`, low: false },
  ]

  const maxVal = 4

  return (
    <div className="space-y-4 mt-2">
      {metrics.map(m => {
        const aiW  = Math.min((m.ai  / maxVal) * 100, 100)
        const basW = Math.min((m.base / maxVal) * 100, 100)
        const aiC  = m.low ? '#34d399' : '#2dd4bf'
        return (
          <div key={m.label}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[11.5px] font-medium">{m.label}</span>
              <span className={`${mono} text-[10px] text-cyan`}>{m.note}</span>
            </div>
            <div className="mb-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`${mono} text-[9px] text-muted w-10`}>AI</span>
                <div className="flex-1 h-2.5 bg-panel2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${aiW}%`, background: aiC }} />
                </div>
                <span className="text-[11px] font-semibold w-12 text-right" style={{ color: aiC }}>
                  {m.ai.toFixed(m.unit === '%' ? 0 : 1)}{m.unit}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`${mono} text-[9px] text-dim w-10`}>BASE</span>
                <div className="flex-1 h-2.5 bg-panel2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full opacity-50" style={{ width: `${basW}%`, background: '#5b6175' }} />
                </div>
                <span className={`${mono} text-[11px] text-muted w-12 text-right`}>{m.base}{m.unit}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ROI chart ────────────────────────────────────────────────────────────────

function RoiChart({ tools }: { tools: ToolEffectiveness[] }) {
  const sorted = [...tools].sort((a, b) => b.roi - a.roi)
  const maxRoi = Math.max(...sorted.map(t => t.roi), 1) * 1.1

  return (
    <div className="space-y-3 mt-2">
      {sorted.map(t => (
        <div key={t.id}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-[5px] grid place-items-center text-[9px] font-bold shrink-0"
                style={{ background: t.color, color: '#0c0e14' }}>{t.init}</div>
              <span className="text-[12px] font-medium">{t.name}</span>
              <SrcBadge src={srcLabel(t.attributionConfidence)} />
            </div>
            <span className={`${mono} text-[14px] font-bold`} style={{ color: roiColor(t.roi) }}>
              {t.roi.toFixed(1)}×
            </span>
          </div>
          <div className="h-2 bg-panel2 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(t.roi / maxRoi) * 100}%`, background: roiColor(t.roi), opacity: 0.8 }} />
          </div>
          <div className={`flex justify-between ${mono} text-[9.5px] text-dim`}>
            <span>{fmtUSD(t.monthlyCost / 1000, 1)}k/mo · ${t.costPer1k}/1k lines</span>
            <span>{t.devs} devs · {t.linesDay.toLocaleString()} lines/day</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EffectivenessPage() {
  const [data,    setData]    = useState<EffectivenessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/effectiveness')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return <div className="flex items-center justify-center py-24 text-muted text-[13px]">Loading effectiveness data…</div>
  if (error)   return <div className="text-rose p-4">{error}</div>
  if (!data || !data.tools.length) {
    return (
      <Note icon="ℹ" accent="var(--blue)">
        No effectiveness data yet. Run <code className={`${mono} text-[11px] bg-panel px-1.5 py-0.5 rounded`}>npm run db:setup</code> to seed demo data.
      </Note>
    )
  }

  const { summary, tools } = data

  return (
    <div className="animate-fadeIn space-y-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Avg Acceptance Rate" value={summary.avgAcceptanceRate} unit="%" accent="var(--cyan)"
          delta="▲ 4pts vs last month" deltaGood />
        <KpiCard label="AI Lines / Day" value={summary.totalLinesDay.toLocaleString()} accent="var(--green)"
          delta="across all tools" deltaGood />
        <KpiCard label="Weighted ROI" value={summary.weightedRoi.toFixed(1)} unit="×" accent="var(--violet)"
          delta="▲ 0.3× vs last month" deltaGood />
        <KpiCard label="Cost / 1k Lines" value={`$${summary.avgCostPer1k}`} accent="var(--amber)"
          delta="▼ 8% (improved)" deltaGood />
        <KpiCard label="Avg Survival Rate" value={summary.avgSurvivalRate} unit="%" accent="var(--blue)"
          delta="▲ 2pts vs last month" deltaGood />
      </div>

      {/* Tool table */}
      <Panel title="Tool effectiveness comparison" badge={`${tools.length} CODING TOOLS · MTD · SORTED BY ROI`}>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                {['Tool','Billing','Devs','Accept rate','Lines/day','Survival','Bug density','Monthly cost','Cost/1k','ROI','Source'].map(h => (
                  <th key={h} className={`${mono} text-[9px] text-muted tracking-[.07em] uppercase text-left py-2 px-2 border-b border-line whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tools.map(t => (
                <tr key={t.id} className="border-b border-line/50 last:border-none hover:bg-panel2/40 transition-colors">
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-[5px] grid place-items-center text-[9px] font-bold shrink-0"
                        style={{ background: t.color, color: '#0c0e14' }}>{t.init}</div>
                      <span className="font-medium whitespace-nowrap">{t.name}</span>
                    </div>
                  </td>
                  <td className={`${mono} px-2 text-muted text-[10px] whitespace-nowrap`}>{t.billing}</td>
                  <td className={`${mono} text-right px-2 text-muted`}>{t.devs}</td>
                  <td className="text-right px-2">
                    {t.acceptanceRate != null
                      ? <span className="font-bold" style={{ color: t.color }}>{t.acceptanceRate}%</span>
                      : <span className={`${mono} text-muted text-[10px]`}>— STAT</span>}
                  </td>
                  <td className={`${mono} text-right px-2 text-muted`}>{t.linesDay.toLocaleString()}</td>
                  <td className="text-right px-2">
                    <span style={{ color: survivalColor(t.survivalRate) }}>
                      {t.survivalRate != null ? `${t.survivalRate}%` : '—'}
                    </span>
                  </td>
                  <td className="text-right px-2">
                    <span style={{ color: t.bugDensity != null && t.bugDensity <= 2 ? '#34d399' : '#fbbf24' }}>
                      {t.bugDensity != null ? `${t.bugDensity.toFixed(1)}/1k` : '—'}
                    </span>
                  </td>
                  <td className={`${mono} text-right px-2 text-muted`}>{fmtUSD(t.monthlyCost / 1000, 1)}k</td>
                  <td className={`${mono} text-right px-2 text-muted`}>${t.costPer1k}</td>
                  <td className="text-right px-2">
                    <span className="font-bold" style={{ color: roiColor(t.roi) }}>{t.roi.toFixed(1)}×</span>
                  </td>
                  <td className="px-2"><SrcBadge src={srcLabel(t.attributionConfidence)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`flex gap-4 mt-3 pt-3 border-t border-line ${mono} text-[10px] text-muted`}>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: 'rgba(52,211,153,.15)', color: '#34d399' }}>API</span>
            Authoritative vendor API
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: 'rgba(251,191,36,.12)', color: '#fbbf24' }}>GIT</span>
            Git-inferred (±15% margin)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold" style={{ background: 'rgba(138,145,166,.12)', color: '#8a91a6' }}>STAT</span>
            Statistical estimate
          </span>
        </div>
      </Panel>

      {/* Quality + ROI */}
      <div className="grid lg:grid-cols-2 gap-3">
        <Panel title="AI vs baseline code quality" badge="ALL TOOLS COMBINED · MTD">
          <QualityChart tools={tools} />
        </Panel>
        <Panel title="ROI breakdown by tool" badge="VALUE GENERATED vs COST">
          <RoiChart tools={tools} />
        </Panel>
      </div>

      {/* Attribution note */}
      <Note icon="ℹ" accent="var(--blue)">
        <b>Attribution methodology:</b> GitHub Copilot, Cline, and Roo Code metrics sourced from authoritative vendor APIs.
        Cursor and Claude Code effectiveness is <b>git-inferred</b> via commit co-author trailers, branch naming patterns,
        and line-diff attribution — carrying an estimated <b>±15% margin</b>.
        Windsurf uses a statistical estimate based on seat assignment ratios.
        Confidence levels are shown as <b>API · GIT · STAT</b> badges.
      </Note>
    </div>
  )
}
