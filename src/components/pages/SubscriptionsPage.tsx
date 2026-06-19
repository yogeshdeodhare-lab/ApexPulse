'use client'

import { useEffect, useState } from 'react'
import { Panel, KpiCard, Note, mono, fmtUSD } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Subscription {
  id:             string
  vendor:         string
  name:           string
  tier:           string
  billingCycle:   string
  startDate:      string
  renewalDate:    string | null
  committedSpend: number | null
  seats:          number | null
  pricePerSeat:   number | null
  status:         string
  notes:          string | null
  createdAt:      string
  updatedAt:      string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VENDORS = [
  'anthropic', 'openai', 'google', 'azure', 'aws',
  'github', 'cursor', 'windsurf', 'linear', 'notion', 'custom',
]

const VENDOR_META: Record<string, { label: string; color: string; icon: string }> = {
  anthropic: { label: 'Anthropic',        color: '#2dd4bf', icon: 'AC' },
  openai:    { label: 'OpenAI',           color: '#34d399', icon: 'OA' },
  google:    { label: 'Google',           color: '#4ade80', icon: 'GG' },
  azure:     { label: 'Azure',            color: '#818cf8', icon: 'AZ' },
  aws:       { label: 'AWS',              color: '#f472b6', icon: 'AW' },
  github:    { label: 'GitHub',           color: '#a3a3a3', icon: 'GH' },
  cursor:    { label: 'Cursor',           color: '#60a5fa', icon: 'CR' },
  windsurf:  { label: 'Windsurf',         color: '#a78bfa', icon: 'WS' },
  linear:    { label: 'Linear',           color: '#6366f1', icon: 'LN' },
  notion:    { label: 'Notion',           color: '#e4e4e7', icon: 'NO' },
  custom:    { label: 'Custom',           color: '#85B7EB', icon: '⊞' },
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  active:    { label: 'ACTIVE',    bg: 'rgba(34,160,107,0.12)',  fg: '#22A06B' },
  trial:     { label: 'TRIAL',     bg: 'rgba(201,138,32,0.12)',  fg: '#C98A20' },
  paused:    { label: 'PAUSED',    bg: 'rgba(55,138,221,0.10)',  fg: '#85B7EB' },
  cancelled: { label: 'CANCELLED', bg: 'rgba(226,75,74,0.10)',   fg: '#E24B4A' },
  expired:   { label: 'EXPIRED',   bg: 'rgba(133,183,235,0.08)', fg: 'rgba(133,183,235,0.40)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(date: string | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VendorBadge({ vendor }: { vendor: string }) {
  const m = VENDOR_META[vendor] ?? VENDOR_META.custom
  return (
    <div className="w-8 h-8 rounded-[8px] grid place-items-center text-[10px] font-bold shrink-0"
      style={{ background: `${m.color}20`, color: m.color, border: `1px solid ${m.color}30` }}>
      {m.icon}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.active
  return (
    <span className={`${mono} text-[9px] font-semibold px-2 py-0.5 rounded-full`}
      style={{ background: m.bg, color: m.fg, border: `1px solid ${m.fg}38` }}>
      {m.label}
    </span>
  )
}

function RenewalChip({ days }: { days: number | null }) {
  if (days === null) return <span className={`${mono} text-[10px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>—</span>
  const color = days < 0 ? '#E24B4A' : days <= 14 ? '#E24B4A' : days <= 30 ? '#C98A20' : '#22A06B'
  const label = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d`
  return (
    <span className={`${mono} text-[10px] font-semibold`} style={{ color }}>{label}</span>
  )
}

// ── Subscription form modal ───────────────────────────────────────────────────

type FormData = {
  vendor: string; name: string; tier: string; billingCycle: string
  startDate: string; renewalDate: string; committedSpend: string
  seats: string; pricePerSeat: string; status: string; notes: string
}

const EMPTY_FORM: FormData = {
  vendor: 'anthropic', name: '', tier: 'usage-based', billingCycle: 'monthly',
  startDate: new Date().toISOString().slice(0, 10), renewalDate: '',
  committedSpend: '', seats: '', pricePerSeat: '', status: 'active', notes: '',
}

interface SubModalProps {
  initial:   Subscription | null
  onClose:   () => void
  onSaved:   () => void
}

function SubModal({ initial, onClose, onSaved }: SubModalProps) {
  const [form,   setForm]   = useState<FormData>(
    initial ? {
      vendor:        initial.vendor,
      name:          initial.name,
      tier:          initial.tier,
      billingCycle:  initial.billingCycle,
      startDate:     initial.startDate.slice(0, 10),
      renewalDate:   initial.renewalDate?.slice(0, 10) ?? '',
      committedSpend:initial.committedSpend?.toString() ?? '',
      seats:         initial.seats?.toString() ?? '',
      pricePerSeat:  initial.pricePerSeat?.toString() ?? '',
      status:        initial.status,
      notes:         initial.notes ?? '',
    } : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  function field(k: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  const inputCls = `${mono} w-full text-[11px] px-3 py-2 rounded-[8px] outline-none`
  const inputStyle = { background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.16)', color: '#85B7EB' }
  const labelCls  = `${mono} text-[9px] block mb-1`
  const labelStyle = { color: 'rgba(133,183,235,0.50)' }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    const payload = {
      ...form,
      committedSpend: form.committedSpend ? Number(form.committedSpend) : null,
      seats:          form.seats          ? Number(form.seats)          : null,
      pricePerSeat:   form.pricePerSeat   ? Number(form.pricePerSeat)   : null,
      renewalDate:    form.renewalDate    || null,
      ...(initial && { id: initial.id }),
    }
    const res = await fetch('/api/subscriptions', {
      method:  initial ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed') }
    else onSaved()
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,15,35,0.85)', backdropFilter: 'blur(8px)' }}>
      <form onSubmit={submit}
        className="w-full max-w-lg rounded-[16px] overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: '#0a2040', border: '1px solid rgba(133,183,235,0.20)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(133,183,235,0.12)' }}>
          <div className="text-[13px] font-semibold flex-1" style={{ color: '#EBF4FF' }}>
            {initial ? 'Edit Subscription' : 'Add Subscription'}
          </div>
          <button type="button" onClick={onClose} className="text-[16px] opacity-40 hover:opacity-70" style={{ color: '#85B7EB' }}>✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>VENDOR</label>
              <select value={form.vendor} onChange={field('vendor')} className={inputCls} style={inputStyle}>
                {VENDORS.map(v => <option key={v} value={v}>{VENDOR_META[v]?.label ?? v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>STATUS</label>
              <select value={form.status} onChange={field('status')} className={inputCls} style={inputStyle}>
                {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>NAME</label>
            <input type="text" value={form.name} onChange={field('name')} required
              placeholder="Anthropic API - Enterprise" className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>TIER</label>
              <select value={form.tier} onChange={field('tier')} className={inputCls} style={inputStyle}>
                {['enterprise','team','pro','starter','usage-based'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>BILLING CYCLE</label>
              <select value={form.billingCycle} onChange={field('billingCycle')} className={inputCls} style={inputStyle}>
                {['monthly','annual','usage'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>START DATE</label>
              <input type="date" value={form.startDate} onChange={field('startDate')} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>RENEWAL DATE</label>
              <input type="date" value={form.renewalDate} onChange={field('renewalDate')} className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>COMMITTED SPEND ($) — optional, for annual commitments</label>
            <input type="number" value={form.committedSpend} onChange={field('committedSpend')} min="0" step="0.01"
              placeholder="0.00" className={inputCls} style={inputStyle} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>SEATS — optional</label>
              <input type="number" value={form.seats} onChange={field('seats')} min="0"
                placeholder="0" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>$/SEAT/MO — optional</label>
              <input type="number" value={form.pricePerSeat} onChange={field('pricePerSeat')} min="0" step="0.01"
                placeholder="0.00" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className={labelCls} style={labelStyle}>NOTES</label>
            <textarea value={form.notes} onChange={field('notes')} rows={2}
              placeholder="Auto-renews, contact: procurement@…"
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>

          {error && (
            <div className={`${mono} text-[10px] px-3 py-2 rounded-[8px]`}
              style={{ background: 'rgba(226,75,74,0.10)', border: '1px solid rgba(226,75,74,0.25)', color: '#E24B4A' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5 pt-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(133,183,235,0.10)' }}>
          <button type="button" onClick={onClose}
            className={`${mono} text-[11px] px-4 py-2 rounded-[8px] transition-all`}
            style={{ background: 'rgba(133,183,235,0.06)', border: '1px solid rgba(133,183,235,0.14)', color: 'rgba(133,183,235,0.55)' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className={`${mono} text-[11px] flex-1 py-2 rounded-[8px] font-semibold transition-all disabled:opacity-40`}
            style={{ background: 'rgba(55,138,221,0.20)', border: '1px solid rgba(133,183,235,0.25)', color: '#85B7EB' }}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Add Subscription'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Renewal calendar panel ────────────────────────────────────────────────────

function RenewalCalendar({ subs }: { subs: Subscription[] }) {
  const upcoming = subs
    .filter(s => s.renewalDate && s.status === 'active')
    .map(s => ({ ...s, days: daysUntil(s.renewalDate)! }))
    .filter(s => s.days <= 90)
    .sort((a, b) => a.days - b.days)

  if (upcoming.length === 0) {
    return (
      <Panel title="Renewal Calendar" badge="NEXT 90 DAYS" sub="Active subscriptions with renewal dates">
        <p className={`${mono} text-[10.5px] py-4 text-center`} style={{ color: 'rgba(133,183,235,0.35)' }}>
          No renewals in the next 90 days
        </p>
      </Panel>
    )
  }

  return (
    <Panel title="Renewal Calendar" badge={`${upcoming.length} UPCOMING · 90 DAYS`} sub="Renewals sorted by urgency">
      <div className="space-y-2 mt-2">
        {upcoming.map(s => {
          const urgency = s.days < 0 ? 'overdue' : s.days <= 14 ? 'urgent' : s.days <= 30 ? 'soon' : 'ok'
          const barColor = urgency === 'overdue' || urgency === 'urgent' ? '#E24B4A' : urgency === 'soon' ? '#C98A20' : '#22A06B'
          return (
            <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-[10px]"
              style={{ background: `${barColor}09`, border: `1px solid ${barColor}20` }}>
              <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: barColor }} />
              <VendorBadge vendor={s.vendor} />
              <div className="flex-1 min-w-0">
                <div className="text-[11.5px] font-medium truncate" style={{ color: '#EBF4FF' }}>{s.name}</div>
                <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.45)' }}>
                  {fmt(s.renewalDate)} · {s.billingCycle}
                  {s.committedSpend && ` · ${fmtUSD(s.committedSpend)} committed`}
                </div>
              </div>
              <RenewalChip days={s.days} />
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [subs,    setSubs]    = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'add' | Subscription | null>(null)
  const [deleting,setDeleting]= useState<string | null>(null)

  function load() {
    fetch('/api/subscriptions')
      .then(r => r.json())
      .then(d => { setSubs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    setDeleting(id)
    await fetch(`/api/subscriptions?id=${id}`, { method: 'DELETE' })
    setDeleting(null)
    load()
  }

  const active    = subs.filter(s => s.status === 'active')
  const totalCommitted = subs.filter(s => s.committedSpend).reduce((sum, s) => sum + (s.committedSpend ?? 0), 0)
  const totalSeats = subs.filter(s => s.seats).reduce((sum, s) => sum + (s.seats ?? 0), 0)
  const renewingSoon = subs.filter(s => {
    const d = daysUntil(s.renewalDate)
    return d !== null && d >= 0 && d <= 30 && s.status === 'active'
  }).length

  if (loading) return (
    <div className="flex items-center justify-center py-24" style={{ color: 'rgba(133,183,235,0.50)' }}>
      <span className={`${mono} text-[12px]`}>Loading subscriptions…</span>
    </div>
  )

  return (
    <div className="space-y-4 animate-slideUp">
      {modal && (
        <SubModal
          initial={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active"        value={active.length}         unit="subscriptions" accent="#22A06B" />
        <KpiCard label="Renewing Soon" value={renewingSoon}          unit="in 30d"        accent={renewingSoon > 0 ? '#C98A20' : '#378ADD'}
          delta={renewingSoon > 0 ? 'action required' : 'all clear'} deltaGood={renewingSoon === 0} />
        <KpiCard label="Committed"     value={fmtUSD(totalCommitted)} unit="annual"       accent="#378ADD"
          delta="across all vendors" deltaGood />
        <KpiCard label="Seat Licenses" value={totalSeats.toLocaleString()} unit="total"  accent="#85B7EB" />
      </div>

      {/* Renewal calendar */}
      <RenewalCalendar subs={subs} />

      {/* Subscription table */}
      <Panel title="All Subscriptions" badge={`${subs.length} TOTAL · S12`}>
        <div className="flex justify-end mb-3">
          <button onClick={() => setModal('add')}
            className={`${mono} text-[10.5px] px-4 py-2 rounded-[8px] font-medium transition-all`}
            style={{ background: 'rgba(55,138,221,0.16)', border: '1px solid rgba(133,183,235,0.22)', color: '#85B7EB' }}>
            + Add Subscription
          </button>
        </div>

        {subs.length === 0 ? (
          <div className={`${mono} text-[11px] text-center py-8`} style={{ color: 'rgba(133,183,235,0.35)' }}>
            No subscriptions yet — click Add to track your first vendor contract
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {['Vendor','Name','Tier','Billing','Renewal','Committed','Seats','Status',''].map(h => (
                    <th key={h} className={`${mono} text-[9px] text-left py-2 px-2 whitespace-nowrap`}
                      style={{ color: 'rgba(133,183,235,0.45)', borderBottom: '1px solid rgba(133,183,235,0.12)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map(s => {
                  const days = daysUntil(s.renewalDate)
                  return (
                    <tr key={s.id} className="border-b transition-colors"
                      style={{ borderColor: 'rgba(133,183,235,0.08)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(55,138,221,0.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <VendorBadge vendor={s.vendor} />
                          <span className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.55)' }}>
                            {VENDOR_META[s.vendor]?.label ?? s.vendor}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 max-w-[180px]">
                        <div className="text-[11.5px] font-medium truncate" style={{ color: '#EBF4FF' }}>{s.name}</div>
                        {s.notes && <div className={`${mono} text-[9px] truncate`} style={{ color: 'rgba(133,183,235,0.35)' }}>{s.notes}</div>}
                      </td>
                      <td className="px-2">
                        <span className={`${mono} text-[9px] px-1.5 py-0.5 rounded`}
                          style={{ background: 'rgba(55,138,221,0.10)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.15)' }}>
                          {s.tier}
                        </span>
                      </td>
                      <td className={`${mono} text-[10px] px-2`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                        {s.billingCycle}
                      </td>
                      <td className="px-2">
                        <div className={`${mono} text-[10px]`} style={{ color: 'rgba(133,183,235,0.55)' }}>
                          {fmt(s.renewalDate)}
                        </div>
                        <RenewalChip days={days} />
                      </td>
                      <td className={`${mono} text-[10.5px] font-bold px-2`} style={{ color: '#378ADD' }}>
                        {s.committedSpend ? fmtUSD(s.committedSpend) : '—'}
                      </td>
                      <td className={`${mono} text-[10px] px-2`} style={{ color: 'rgba(133,183,235,0.55)' }}>
                        {s.seats ? `${s.seats} @ $${s.pricePerSeat}/mo` : '—'}
                      </td>
                      <td className="px-2"><StatusBadge status={s.status} /></td>
                      <td className="px-2">
                        <div className="flex gap-1.5">
                          <button onClick={() => setModal(s)}
                            className={`${mono} text-[9px] px-2 py-1 rounded-[5px] transition-all`}
                            style={{ background: 'rgba(55,138,221,0.10)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.16)' }}>
                            Edit
                          </button>
                          <button onClick={() => handleDelete(s.id, s.name)} disabled={deleting === s.id}
                            className={`${mono} text-[9px] px-2 py-1 rounded-[5px] transition-all disabled:opacity-40`}
                            style={{ background: 'rgba(226,75,74,0.08)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.18)' }}>
                            {deleting === s.id ? '…' : 'Del'}
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
      </Panel>

      {/* Committed spend summary */}
      {subs.some(s => s.committedSpend) && (
        <Panel title="Committed Spend Tracker" badge="ANNUAL COMMITMENTS · S12"
          sub="Vendor contracts with minimum committed spend">
          <div className="space-y-2 mt-2">
            {subs.filter(s => s.committedSpend).map(s => {
              const pct = Math.min(100, Math.round(((s.pricePerSeat ?? 0) * (s.seats ?? 0) / (s.committedSpend ?? 1)) * 100))
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <VendorBadge vendor={s.vendor} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[11px] font-medium truncate" style={{ color: '#EBF4FF' }}>{s.name}</span>
                      <span className={`${mono} text-[10px] font-bold ml-2`} style={{ color: '#378ADD' }}>
                        {fmtUSD(s.committedSpend!)} committed
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(133,183,235,0.10)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#378ADD' }} />
                    </div>
                    <div className={`${mono} text-[9px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                      Renews {fmt(s.renewalDate)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}

      <Note icon="📋" accent="#378ADD">
        <b>Subscription Management (S12)</b> — Track vendor contracts, renewal dates, and committed spend.
        Renewals within 30 days are flagged. Add usage-based subscriptions to track committed minimums,
        or seat-based plans to monitor license costs. All changes are audit-logged.
      </Note>
    </div>
  )
}
