'use client'

import { useState, useEffect, useCallback } from 'react'
import { mono } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

type ActionType = 'notify_slack' | 'notify_webhook' | 'config_write' | 'log_only'

interface RuleAction {
  type:     ActionType
  message?: string
  key?:     string
  value?:   string
}

interface ActionResult { type: string; ok: boolean; error?: string }

interface RuleExecution {
  id:       string
  ruleId:   string
  firedAt:  string
  spendPct: number
  actions:  string // JSON ActionResult[]
  success:  boolean
  error:    string | null
}

interface BudgetRule {
  id:               string
  name:             string
  triggerPct:       number
  actions:          string // JSON RuleAction[]
  active:           boolean
  cooldownHours:    number
  lastFiredAt:      string | null
  createdAt:        string
  recentExecutions: RuleExecution[]
}

interface ProjectBudget {
  id:                string
  projectId:         string
  monthlyCapDollars: number
  alertPct:          number
  hardStop:          boolean
  active:            boolean
  mtdSpend:          number
  utilPct:           number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CONFIG_PRESETS = [
  { label: 'Switch model → Haiku (cheapest)',  key: 'model_routing.default_model', value: 'claude-haiku-4-5-20251001' },
  { label: 'Switch model → Sonnet (balanced)', key: 'model_routing.default_model', value: 'claude-sonnet-4-6' },
  { label: 'Enable prompt cache',              key: 'model_routing.enable_cache',  value: 'true' },
  { label: 'Lower max tokens → 500',           key: 'model_routing.max_tokens',    value: '500' },
  { label: 'Raise alert threshold → 85%',      key: 'budget.alert_threshold_pct', value: '85' },
  { label: 'Custom config key…',               key: '',                            value: '' },
]

const ACTION_LABELS: Record<ActionType, string> = {
  notify_slack:   'Notify Slack',
  notify_webhook: 'Notify Webhook',
  config_write:   'Write Config',
  log_only:       'Log Only',
}

const ACTION_DESC: Record<ActionType, string> = {
  notify_slack:   'Posts a message to your Slack webhook',
  notify_webhook: 'POSTs to your alert webhook URL',
  config_write:   'Updates an AppConfig key in the database',
  log_only:       'Records the event in the audit trail',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)       return 'just now'
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function fmt$(n: number) { return `$${n.toFixed(2)}` }

// ── Empty Action builder default ──────────────────────────────────────────────

function blankAction(): RuleAction { return { type: 'log_only' } }

// ── Rule Modal ────────────────────────────────────────────────────────────────

interface RuleModalProps {
  rule:     BudgetRule | null // null = create
  onClose:  () => void
  onSaved:  () => void
}

function RuleModal({ rule, onClose, onSaved }: RuleModalProps) {
  const [name,          setName]         = useState(rule?.name ?? '')
  const [triggerPct,    setTriggerPct]   = useState(rule?.triggerPct ?? 80)
  const [cooldownHours, setCooldown]     = useState(rule?.cooldownHours ?? 4)
  const [active,        setActive]       = useState(rule?.active ?? true)
  const [actions,       setActions]      = useState<RuleAction[]>(
    rule ? JSON.parse(rule.actions) : [blankAction()]
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  function updateAction(i: number, patch: Partial<RuleAction>) {
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }

  function applyPreset(i: number, presetIdx: number) {
    const p = CONFIG_PRESETS[presetIdx]
    updateAction(i, { type: 'config_write', key: p.key, value: p.value })
  }

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    if (triggerPct < 1 || triggerPct > 100) { setErr('Trigger must be 1–100'); return }
    if (actions.length === 0) { setErr('Add at least one action'); return }

    setSaving(true)
    setErr('')
    try {
      const method = rule ? 'PUT' : 'POST'
      const body   = rule
        ? { id: rule.id, name, triggerPct, actions: JSON.stringify(actions), cooldownHours, active }
        : { name, triggerPct, actions: JSON.stringify(actions), cooldownHours, active }

      const res = await fetch('/api/budget-rules', {
        method,
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setErr(d.error ?? 'Save failed')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,15,36,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-[14px] overflow-hidden flex flex-col"
        style={{
          background:  '#071e3d',
          border:      '1px solid rgba(133,183,235,0.18)',
          boxShadow:   '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight:   '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: '#EBF4FF' }}>
              {rule ? 'Edit Rule' : 'New Budget Rule'}
            </div>
            <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.45)' }}>
              IF spend ≥ threshold THEN execute actions
            </div>
          </div>
          <button onClick={onClose} className="text-[16px] opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#85B7EB' }}>✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Name */}
          <div>
            <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>Rule Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. High-Spend Auto-Scale"
              className="w-full rounded-[8px] px-3 py-2 text-[13px]"
              style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF', outline: 'none' }}
            />
          </div>

          {/* Trigger + Cooldown row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>
                Trigger when ≥ <span style={{ color: '#85B7EB' }}>{triggerPct}%</span> spent
              </label>
              <input
                type="range" min={1} max={100} value={triggerPct}
                onChange={e => setTriggerPct(Number(e.target.value))}
                className="w-full accent-blue-400"
              />
              <div className="flex justify-between mt-1">
                {[50, 75, 85, 90, 95, 100].map(v => (
                  <button
                    key={v}
                    onClick={() => setTriggerPct(v)}
                    className={`${mono} text-[9px] px-1.5 py-0.5 rounded transition-colors`}
                    style={{
                      background: triggerPct === v ? 'rgba(55,138,221,0.25)' : 'rgba(55,138,221,0.08)',
                      color:      triggerPct === v ? '#85B7EB' : 'rgba(133,183,235,0.45)',
                      border:     `1px solid ${triggerPct === v ? 'rgba(133,183,235,0.3)' : 'rgba(133,183,235,0.12)'}`,
                    }}
                  >
                    {v}%
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>Cooldown (re-fire)</label>
              <select
                value={cooldownHours}
                onChange={e => setCooldown(Number(e.target.value))}
                className="w-full rounded-[8px] px-3 py-2 text-[13px]"
                style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF', outline: 'none' }}
              >
                {[1, 2, 4, 8, 12, 24].map(h => (
                  <option key={h} value={h}>{h}h</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={`${mono} text-[10px] uppercase tracking-wider`} style={{ color: 'rgba(133,183,235,0.55)' }}>Actions</label>
              <button
                onClick={() => setActions(prev => [...prev, blankAction()])}
                className={`${mono} text-[10px] px-2.5 py-1 rounded-[6px] transition-colors`}
                style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.2)', color: '#85B7EB' }}
              >
                + Add action
              </button>
            </div>

            <div className="space-y-3">
              {actions.map((action, i) => (
                <div
                  key={i}
                  className="rounded-[10px] p-3 space-y-2"
                  style={{ background: 'rgba(55,138,221,0.06)', border: '1px solid rgba(133,183,235,0.12)' }}
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={action.type}
                      onChange={e => updateAction(i, { type: e.target.value as ActionType, message: undefined, key: undefined, value: undefined })}
                      className="flex-1 rounded-[7px] px-2.5 py-1.5 text-[12px]"
                      style={{ background: 'rgba(55,138,221,0.1)', border: '1px solid rgba(133,183,235,0.2)', color: '#EBF4FF', outline: 'none' }}
                    >
                      {(Object.keys(ACTION_LABELS) as ActionType[]).map(t => (
                        <option key={t} value={t}>{ACTION_LABELS[t]}</option>
                      ))}
                    </select>
                    {actions.length > 1 && (
                      <button
                        onClick={() => setActions(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-[12px] opacity-40 hover:opacity-70 transition-opacity flex-shrink-0"
                        style={{ color: '#E24B4A' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                    {ACTION_DESC[action.type]}
                  </div>

                  {(action.type === 'notify_slack' || action.type === 'notify_webhook') && (
                    <input
                      value={action.message ?? ''}
                      onChange={e => updateAction(i, { message: e.target.value || undefined })}
                      placeholder="Custom message (optional) — use {{pct}} for spend %"
                      className="w-full rounded-[7px] px-2.5 py-1.5 text-[12px]"
                      style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.16)', color: '#EBF4FF', outline: 'none' }}
                    />
                  )}

                  {action.type === 'config_write' && (
                    <div className="space-y-1.5">
                      <select
                        value={CONFIG_PRESETS.findIndex(p => p.key === action.key && p.value === action.value)}
                        onChange={e => applyPreset(i, Number(e.target.value))}
                        className="w-full rounded-[7px] px-2.5 py-1.5 text-[12px]"
                        style={{ background: 'rgba(55,138,221,0.10)', border: '1px solid rgba(133,183,235,0.2)', color: '#EBF4FF', outline: 'none' }}
                      >
                        <option value={-1}>— choose a preset —</option>
                        {CONFIG_PRESETS.map((p, pi) => (
                          <option key={pi} value={pi}>{p.label}</option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={action.key ?? ''}
                          onChange={e => updateAction(i, { key: e.target.value })}
                          placeholder="Config key"
                          className="rounded-[7px] px-2.5 py-1.5 text-[12px]"
                          style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.16)', color: '#EBF4FF', outline: 'none' }}
                        />
                        <input
                          value={action.value ?? ''}
                          onChange={e => updateAction(i, { value: e.target.value })}
                          placeholder="New value"
                          className="rounded-[7px] px-2.5 py-1.5 text-[12px]"
                          style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.16)', color: '#EBF4FF', outline: 'none' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActive(v => !v)}
              className="relative w-10 h-6 rounded-full transition-colors duration-200"
              style={{ background: active ? '#185FA5' : 'rgba(55,138,221,0.15)', border: '1px solid rgba(133,183,235,0.2)' }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full transition-transform duration-200"
                style={{ background: active ? '#85B7EB' : 'rgba(133,183,235,0.4)', transform: active ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </button>
            <span className="text-[12.5px]" style={{ color: active ? '#EBF4FF' : 'rgba(133,183,235,0.45)' }}>
              {active ? 'Rule active — will evaluate on next poll' : 'Rule disabled'}
            </span>
          </div>

          {err && (
            <div className={`${mono} text-[11px] rounded-[7px] px-3 py-2`} style={{ background: 'rgba(226,75,74,0.12)', color: '#F28B82', border: '1px solid rgba(226,75,74,0.25)' }}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(133,183,235,0.10)' }}>
          <button
            onClick={onClose}
            className={`${mono} text-[11.5px] px-4 py-2 rounded-[8px] transition-colors`}
            style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.16)', color: 'rgba(133,183,235,0.7)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${mono} text-[11.5px] px-5 py-2 rounded-[8px] font-semibold transition-colors`}
            style={{ background: saving ? 'rgba(55,138,221,0.2)' : '#185FA5', color: '#EBF4FF', border: '1px solid rgba(133,183,235,0.2)' }}
          >
            {saving ? 'Saving…' : rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Project Budget Modal ───────────────────────────────────────────────────────

interface PBModalProps {
  pb:      ProjectBudget | null
  onClose: () => void
  onSaved: () => void
}

function PBModal({ pb, onClose, onSaved }: PBModalProps) {
  const [projectId, setProjectId] = useState(pb?.projectId ?? '')
  const [cap,       setCap]       = useState(String(pb?.monthlyCapDollars ?? ''))
  const [alertPct,  setAlertPct]  = useState(pb?.alertPct ?? 80)
  const [hardStop,  setHardStop]  = useState(pb?.hardStop ?? false)
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState('')

  async function handleSave() {
    if (!projectId.trim()) { setErr('Project ID required'); return }
    if (!cap || isNaN(Number(cap)) || Number(cap) <= 0) { setErr('Valid cap required'); return }

    setSaving(true)
    setErr('')
    try {
      const method = pb ? 'PUT' : 'POST'
      const body   = pb
        ? { id: pb.id, monthlyCapDollars: Number(cap), alertPct, hardStop }
        : { projectId, monthlyCapDollars: Number(cap), alertPct, hardStop }

      const res = await fetch('/api/project-budgets', {
        method,
        headers: { 'content-type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setErr(d.error ?? 'Save failed')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,15,36,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-[14px] overflow-hidden"
        style={{ background: '#071e3d', border: '1px solid rgba(133,183,235,0.18)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
          <div className="text-[14px] font-semibold" style={{ color: '#EBF4FF' }}>
            {pb ? 'Edit Project Budget' : 'New Project Budget'}
          </div>
          <button onClick={onClose} className="text-[16px] opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#85B7EB' }}>✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>Project ID</label>
            <input
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              disabled={!!pb}
              placeholder="e.g. infra-prod"
              className="w-full rounded-[8px] px-3 py-2 text-[13px]"
              style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF', outline: 'none', opacity: pb ? 0.6 : 1 }}
            />
          </div>
          <div>
            <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>Monthly Cap ($)</label>
            <input
              type="number" value={cap} onChange={e => setCap(e.target.value)} min={1} step={10}
              className="w-full rounded-[8px] px-3 py-2 text-[13px]"
              style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF', outline: 'none' }}
            />
          </div>
          <div>
            <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>
              Alert at <span style={{ color: '#85B7EB' }}>{alertPct}%</span>
            </label>
            <input
              type="range" min={50} max={99} value={alertPct}
              onChange={e => setAlertPct(Number(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={hardStop} onChange={e => setHardStop(e.target.checked)} className="accent-blue-400" />
            <span className="text-[12.5px]" style={{ color: '#EBF4FF' }}>Hard stop — block new requests when cap exceeded</span>
          </label>

          {err && (
            <div className={`${mono} text-[11px] rounded-[7px] px-3 py-2`} style={{ background: 'rgba(226,75,74,0.12)', color: '#F28B82', border: '1px solid rgba(226,75,74,0.25)' }}>
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: '1px solid rgba(133,183,235,0.10)' }}>
          <button
            onClick={onClose}
            className={`${mono} text-[11.5px] px-4 py-2 rounded-[8px] transition-colors`}
            style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.16)', color: 'rgba(133,183,235,0.7)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${mono} text-[11.5px] px-5 py-2 rounded-[8px] font-semibold transition-colors`}
            style={{ background: saving ? 'rgba(55,138,221,0.2)' : '#185FA5', color: '#EBF4FF', border: '1px solid rgba(133,183,235,0.2)' }}
          >
            {saving ? 'Saving…' : pb ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      className="rounded-[12px] p-4"
      style={{
        background: accent ? 'rgba(55,138,221,0.12)' : 'rgba(55,138,221,0.07)',
        border:     `1px solid ${accent ? 'rgba(133,183,235,0.25)' : 'rgba(133,183,235,0.13)'}`,
      }}
    >
      <div className={`${mono} text-[9px] uppercase tracking-[0.13em] mb-1.5`} style={{ color: 'rgba(133,183,235,0.50)' }}>{label}</div>
      <div className="text-[22px] font-bold leading-none mb-1" style={{ color: accent ? '#85B7EB' : '#EBF4FF' }}>{value}</div>
      {sub && <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>{sub}</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BudgetRulesPage() {
  const [rules,       setRules]       = useState<BudgetRule[]>([])
  const [executions,  setExecutions]  = useState<RuleExecution[]>([])
  const [projectBudgets, setPB]       = useState<ProjectBudget[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editRule,    setEditRule]    = useState<BudgetRule | null | undefined>(undefined) // undefined = closed
  const [editPB,      setEditPB]      = useState<ProjectBudget | null | undefined>(undefined)
  const [evalResult,  setEvalResult]  = useState<{ spendPct: number; fired: number } | null>(null)
  const [evaluating,  setEvaluating]  = useState(false)

  const load = useCallback(async () => {
    const [rRes, pbRes] = await Promise.all([
      fetch('/api/budget-rules').then(r => r.json()),
      fetch('/api/project-budgets').then(r => r.json()),
    ])
    if (Array.isArray(rRes.rules)) setRules(rRes.rules)
    if (Array.isArray(rRes.executions)) setExecutions(rRes.executions)
    if (Array.isArray(pbRes)) setPB(pbRes)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(rule: BudgetRule) {
    await fetch('/api/budget-rules', {
      method:  'PUT',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ id: rule.id, active: !rule.active }),
    })
    load()
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this rule?')) return
    await fetch(`/api/budget-rules?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function deletePB(id: string) {
    if (!confirm('Remove this project budget?')) return
    await fetch(`/api/project-budgets?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function evaluateNow() {
    setEvaluating(true)
    setEvalResult(null)
    try {
      const r = await fetch('/api/budget-rules/evaluate', { method: 'POST' })
      const d = await r.json()
      setEvalResult({ spendPct: d.spendPct ?? 0, fired: d.fired ?? 0 })
      load()
    } finally {
      setEvaluating(false)
    }
  }

  const activeCount  = rules.filter(r => r.active).length
  const firedToday   = executions.filter(e => Date.now() - new Date(e.firedAt).getTime() < 86_400_000).length
  const lastFiredAt  = executions[0]?.firedAt ?? null

  return (
    <div className="space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Rules"    value={String(activeCount)}               sub={`${rules.length} total`} accent />
        <KpiCard label="Fired Today"     value={String(firedToday)}                sub="executions in last 24h" />
        <KpiCard label="Last Execution"  value={relTime(lastFiredAt)}              sub={lastFiredAt ? new Date(lastFiredAt).toLocaleTimeString() : 'No executions yet'} />
        <KpiCard label="Project Budgets" value={String(projectBudgets.length)}     sub={`${projectBudgets.filter(p => p.utilPct >= p.alertPct).length} over alert threshold`} />
      </div>

      {/* Evaluate banner */}
      {evalResult && (
        <div
          className={`rounded-[10px] px-4 py-3 flex items-center gap-3 ${mono} text-[12px]`}
          style={{
            background: evalResult.fired > 0 ? 'rgba(248,161,0,0.10)' : 'rgba(34,160,107,0.10)',
            border:     `1px solid ${evalResult.fired > 0 ? 'rgba(248,161,0,0.3)' : 'rgba(34,160,107,0.3)'}`,
            color:      evalResult.fired > 0 ? '#F8A100' : '#22A06B',
          }}
        >
          {evalResult.fired > 0
            ? `⚡ ${evalResult.fired} rule${evalResult.fired > 1 ? 's' : ''} fired at ${evalResult.spendPct}% spend`
            : `✓ Evaluated at ${evalResult.spendPct}% spend — no rules met their threshold`}
          <button onClick={() => setEvalResult(null)} className="ml-auto opacity-50 hover:opacity-80">✕</button>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Rules panel (2/3) */}
        <div
          className="xl:col-span-2 rounded-[14px] overflow-hidden"
          style={{ background: 'rgba(55,138,221,0.05)', border: '1px solid rgba(133,183,235,0.13)' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>Automation Rules</div>
              <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                IF budget % ≥ threshold THEN execute actions
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={evaluateNow}
                disabled={evaluating}
                className={`${mono} text-[10.5px] px-3 py-1.5 rounded-[7px] transition-colors`}
                style={{ background: 'rgba(248,161,0,0.12)', border: '1px solid rgba(248,161,0,0.25)', color: evaluating ? 'rgba(248,161,0,0.5)' : '#F8A100' }}
              >
                {evaluating ? '…evaluating' : '⚡ Evaluate Now'}
              </button>
              <button
                onClick={() => setEditRule(null)}
                className={`${mono} text-[10.5px] px-3 py-1.5 rounded-[7px] transition-colors`}
                style={{ background: 'rgba(55,138,221,0.15)', border: '1px solid rgba(133,183,235,0.22)', color: '#85B7EB' }}
              >
                + Add Rule
              </button>
            </div>
          </div>

          {loading && (
            <div className={`${mono} text-[11px] text-center py-8`} style={{ color: 'rgba(133,183,235,0.40)' }}>Loading…</div>
          )}

          {!loading && rules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="text-[28px]" style={{ filter: 'grayscale(0.3)' }}>⚡</div>
              <div className="text-[13px] font-medium" style={{ color: 'rgba(133,183,235,0.6)' }}>No automation rules yet</div>
              <div className={`${mono} text-[10px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                Create rules to automatically react when budget thresholds are hit
              </div>
              <button
                onClick={() => setEditRule(null)}
                className={`${mono} text-[11px] mt-2 px-4 py-2 rounded-[8px]`}
                style={{ background: '#185FA5', color: '#EBF4FF', border: '1px solid rgba(133,183,235,0.2)' }}
              >
                Create first rule →
              </button>
            </div>
          )}

          <div className="divide-y" style={{ borderColor: 'rgba(133,183,235,0.07)' }}>
            {rules.map(rule => {
              const parsedActions: RuleAction[] = (() => { try { return JSON.parse(rule.actions) } catch { return [] } })()
              return (
                <div key={rule.id} className="px-4 py-3.5 group">
                  <div className="flex items-start gap-3">
                    {/* Active toggle */}
                    <button
                      onClick={() => toggleActive(rule)}
                      className="mt-0.5 relative w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200"
                      style={{ background: rule.active ? '#185FA5' : 'rgba(55,138,221,0.15)', border: '1px solid rgba(133,183,235,0.2)' }}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
                        style={{ background: rule.active ? '#85B7EB' : 'rgba(133,183,235,0.35)', transform: rule.active ? 'translateX(17px)' : 'translateX(2px)' }}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: rule.active ? '#EBF4FF' : 'rgba(133,183,235,0.45)' }}>
                          {rule.name}
                        </span>
                        <span
                          className={`${mono} text-[9.5px] px-2 py-0.5 rounded-full`}
                          style={{
                            background: rule.active ? 'rgba(55,138,221,0.15)' : 'rgba(55,138,221,0.07)',
                            color:      rule.active ? '#85B7EB' : 'rgba(133,183,235,0.35)',
                            border:     '1px solid rgba(133,183,235,0.15)',
                          }}
                        >
                          {rule.active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <div className={`${mono} text-[10.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                        IF spend ≥ <span style={{ color: '#85B7EB' }}>{rule.triggerPct}%</span>
                        {' · '}cooldown {rule.cooldownHours}h
                        {' · '}last fired {relTime(rule.lastFiredAt)}
                      </div>

                      {/* Action chips */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {parsedActions.map((a, i) => (
                          <span
                            key={i}
                            className={`${mono} text-[9px] px-2 py-0.5 rounded-[5px]`}
                            style={{ background: 'rgba(55,138,221,0.10)', border: '1px solid rgba(133,183,235,0.15)', color: '#85B7EB' }}
                          >
                            {ACTION_LABELS[a.type] ?? a.type}
                            {a.type === 'config_write' && a.key ? `: ${a.key}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => setEditRule(rule)}
                        className={`${mono} text-[10px] px-2.5 py-1 rounded-[6px] transition-colors`}
                        style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.18)', color: '#85B7EB' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteRule(rule.id)}
                        className={`${mono} text-[10px] px-2.5 py-1 rounded-[6px] transition-colors`}
                        style={{ background: 'rgba(226,75,74,0.10)', border: '1px solid rgba(226,75,74,0.20)', color: '#F28B82' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Executions panel (1/3) */}
        <div
          className="rounded-[14px] overflow-hidden"
          style={{ background: 'rgba(55,138,221,0.05)', border: '1px solid rgba(133,183,235,0.13)' }}
        >
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
            <div className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>Recent Executions</div>
            <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>last 20 rule firings</div>
          </div>

          {executions.length === 0 ? (
            <div className={`${mono} text-[10.5px] text-center py-8`} style={{ color: 'rgba(133,183,235,0.35)' }}>
              No executions yet — rules will log here when they fire
            </div>
          ) : (
            <div className="divide-y overflow-y-auto" style={{ borderColor: 'rgba(133,183,235,0.07)', maxHeight: 380 }}>
              {executions.map(e => {
                const rName = rules.find(r => r.id === e.ruleId)?.name ?? 'Rule'
                const aLog: ActionResult[] = (() => { try { return JSON.parse(e.actions) } catch { return [] } })()
                return (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span style={{ color: e.success ? '#22A06B' : '#F28B82' }}>{e.success ? '✓' : '✕'}</span>
                      <span className="text-[11.5px] font-medium truncate" style={{ color: '#EBF4FF' }}>{rName}</span>
                      <span className={`${mono} text-[9px] ml-auto flex-shrink-0`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                        {relTime(e.firedAt)}
                      </span>
                    </div>
                    <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                      Spend: {e.spendPct.toFixed(1)}%
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {aLog.map((a, i) => (
                        <span
                          key={i}
                          className={`${mono} text-[8.5px] px-1.5 py-0.5 rounded`}
                          style={{
                            background: a.ok ? 'rgba(34,160,107,0.10)' : 'rgba(226,75,74,0.10)',
                            color:      a.ok ? '#22A06B' : '#F28B82',
                            border:     `1px solid ${a.ok ? 'rgba(34,160,107,0.2)' : 'rgba(226,75,74,0.2)'}`,
                          }}
                        >
                          {a.type.replace('_', ' ')}{a.ok ? ' ✓' : ' ✕'}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Project Budgets */}
      <div
        className="rounded-[14px] overflow-hidden"
        style={{ background: 'rgba(55,138,221,0.05)', border: '1px solid rgba(133,183,235,0.13)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>Project Budgets</div>
            <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>
              Per-project monthly caps with alert thresholds
            </div>
          </div>
          <button
            onClick={() => setEditPB(null)}
            className={`${mono} text-[10.5px] px-3 py-1.5 rounded-[7px] transition-colors`}
            style={{ background: 'rgba(55,138,221,0.15)', border: '1px solid rgba(133,183,235,0.22)', color: '#85B7EB' }}
          >
            + Add Cap
          </button>
        </div>

        {projectBudgets.length === 0 ? (
          <div className={`${mono} text-[10.5px] text-center py-6`} style={{ color: 'rgba(133,183,235,0.35)' }}>
            No project budgets configured — add per-project monthly caps here
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
                  {['Project', 'Monthly Cap', 'MTD Spend', 'Utilisation', 'Alert At', 'Hard Stop', ''].map(h => (
                    <th
                      key={h}
                      className={`${mono} text-left text-[9px] uppercase tracking-wider px-4 py-2.5`}
                      style={{ color: 'rgba(133,183,235,0.40)', fontWeight: 500 }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectBudgets.map(pb => {
                  const pct    = pb.utilPct
                  const colour = pct >= 100 ? '#E24B4A' : pct >= pb.alertPct ? '#F8A100' : '#22A06B'
                  return (
                    <tr
                      key={pb.id}
                      className="group"
                      style={{ borderBottom: '1px solid rgba(133,183,235,0.06)' }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: '#EBF4FF' }}>{pb.projectId}</td>
                      <td className="px-4 py-3" style={{ color: '#85B7EB' }}>{fmt$(pb.monthlyCapDollars)}</td>
                      <td className="px-4 py-3" style={{ color: '#EBF4FF' }}>{fmt$(pb.mtdSpend)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(133,183,235,0.12)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: colour }} />
                          </div>
                          <span className={`${mono} text-[10px]`} style={{ color: colour }}>{pct}%</span>
                        </div>
                      </td>
                      <td className={`${mono} px-4 py-3 text-[10.5px]`} style={{ color: 'rgba(133,183,235,0.60)' }}>{pb.alertPct}%</td>
                      <td className="px-4 py-3">
                        <span
                          className={`${mono} text-[9.5px] px-2 py-0.5 rounded`}
                          style={{
                            background: pb.hardStop ? 'rgba(226,75,74,0.12)' : 'rgba(55,138,221,0.10)',
                            color:      pb.hardStop ? '#F28B82' : 'rgba(133,183,235,0.50)',
                            border:     `1px solid ${pb.hardStop ? 'rgba(226,75,74,0.2)' : 'rgba(133,183,235,0.15)'}`,
                          }}
                        >
                          {pb.hardStop ? 'HARD STOP' : 'warn only'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditPB(pb)}
                            className={`${mono} text-[10px] px-2 py-0.5 rounded`}
                            style={{ background: 'rgba(55,138,221,0.12)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.18)' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deletePB(pb.id)}
                            className={`${mono} text-[10px] px-2 py-0.5 rounded`}
                            style={{ background: 'rgba(226,75,74,0.10)', color: '#F28B82', border: '1px solid rgba(226,75,74,0.20)' }}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {editRule !== undefined && (
        <RuleModal
          rule={editRule}
          onClose={() => setEditRule(undefined)}
          onSaved={() => { setEditRule(undefined); load() }}
        />
      )}
      {editPB !== undefined && (
        <PBModal
          pb={editPB}
          onClose={() => setEditPB(undefined)}
          onSaved={() => { setEditPB(undefined); load() }}
        />
      )}
    </div>
  )
}
