'use client'

import { useState } from 'react'
import { KpiCard, Panel, Note, StatusBadge, mono, fmtUSD, getBarColor } from '@/components/ui'
import type { DashboardStats } from './OverviewPage'

export default function BudgetPage({
  budget, onSave,
}: { budget: DashboardStats['budget']; onSave: (amount: number) => void }) {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(amount)
    if (!n || n <= 0) return
    setSaving(true)
    await fetch('/api/budget', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: n }),
    })
    setSaving(false)
    setAmount('')
    onSave(n)
  }

  const pct = budget?.utilizationPct ?? 0
  const barColor = getBarColor(pct)

  const STATE_LABELS: Record<string, { label: string; color: string; desc: string }> = {
    ACTIVE:   { label: 'Active',   color: '#34d399', desc: '< 70% consumed' },
    WARNING:  { label: 'Warning',  color: '#fbbf24', desc: '70–80%' },
    ELEVATED: { label: 'Elevated', color: '#fb923c', desc: '80–90%' },
    CRITICAL: { label: 'Critical', color: '#fb7185', desc: '90–100%' },
    EXCEEDED: { label: 'Exceeded', color: '#fb7185', desc: '> 100%' },
  }

  function currentState() {
    if (pct >= 100) return 'EXCEEDED'
    if (pct >= 90)  return 'CRITICAL'
    if (pct >= 80)  return 'ELEVATED'
    if (pct >= 70)  return 'WARNING'
    return 'ACTIVE'
  }
  const state = currentState()

  return (
    <div className="animate-fadeIn space-y-4">
      {budget ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label="Budget (MTD)"  value={fmtUSD(budget.amount)}    accent="var(--blue)" />
            <KpiCard label="Consumed"      value={fmtUSD(budget.consumed)}  accent={barColor} />
            <KpiCard label="Remaining"     value={fmtUSD(budget.remaining)} accent="var(--green)" />
          </div>

          <Panel title="Budget utilisation" badge={`${pct}% · ${state}`}>
            <div className="mt-2 h-4 bg-panel2 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
            </div>
            <div className={`flex justify-between ${mono} text-[10px] text-dim mt-1.5`}>
              <span>$0</span><span>{fmtUSD(budget.amount)}</span>
            </div>
            {pct >= 70 && (
              <Note icon={pct >= 100 ? '✗' : '⚠'} accent={pct >= 100 ? 'var(--rose)' : 'var(--amber)'}>
                {pct >= 100
                  ? <><b>Budget exceeded.</b> Consider raising the limit or routing simpler tasks to Haiku 4.5.</>
                  : <><b>{pct}% consumed.</b> Projected EOM: {fmtUSD(budget.consumed / new Date().getDate() * 30)}.</>
                }
              </Note>
            )}
          </Panel>

          {/* Budget state machine */}
          <Panel title="Budget state machine" sub="automatic threshold transitions">
            <div className="flex items-center gap-0 mt-3 flex-wrap">
              {Object.entries(STATE_LABELS).map(([k, v], i, arr) => (
                <div key={k} className="flex items-center">
                  <div className={`flex flex-col items-center px-4 py-2 rounded-lg border transition-all ${
                    state === k ? 'border-current' : 'border-line opacity-50'
                  }`} style={{ color: v.color, borderColor: state === k ? v.color : undefined,
                    background: state === k ? v.color + '18' : undefined }}>
                    <span className="text-[12px] font-semibold">{v.label}</span>
                    <span className={`${mono} text-[9.5px] opacity-70 mt-0.5`}>{v.desc}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="text-dim mx-1">→</span>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <Note icon="ℹ" accent="var(--blue)">No budget set for this month. Add one below to enable tracking and alerts.</Note>
      )}

      <Panel title="Set monthly budget" sub="applies to the current calendar month">
        <form onSubmit={handleSave} className="flex items-end gap-3 mt-3">
          <div className="flex-1">
            <label className={`${mono} text-[10px] text-muted block mb-1.5 tracking-[.05em]`}>AMOUNT (USD)</label>
            <div className="flex items-center bg-panel2 border border-line rounded-lg px-3 py-2.5 gap-2 focus-within:border-cyan transition-colors">
              <span className="text-muted text-[14px]">$</span>
              <input
                type="number" min="1" step="50" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="2000"
                className="bg-transparent outline-none flex-1 text-[14px]"
              />
            </div>
          </div>
          <button
            type="submit" disabled={saving || !amount}
            className="px-5 py-2.5 rounded-lg bg-cyan text-bg font-semibold text-[13px] disabled:opacity-40 hover:bg-cyan/90 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
        <div className={`mt-3 ${mono} text-[10px] text-dim space-y-1`}>
          <p>Alerts fire at 70% · 80% · 90% · 100%</p>
          <p>Hard enforcement (block / throttle) requires the full gateway stack.</p>
        </div>
      </Panel>
    </div>
  )
}
