'use client'

import { useState, useEffect, useCallback } from 'react'
import { mono } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

type WebhookType = 'slack' | 'http' | 'pagerduty' | 'teams'

interface WebhookDelivery {
  id:         string
  webhookId:  string
  eventType:  string
  statusCode: number | null
  latencyMs:  number | null
  success:    boolean
  attempt:    number
  error:      string | null
  payload:    string
  sentAt:     string
  webhook?:   { name: string; type: string }
}

interface Webhook {
  id:         string
  name:       string
  url:        string
  type:       WebhookType
  events:     string[]
  secret:     string
  active:     boolean
  createdAt:  string
  updatedAt:  string
  deliveries: WebhookDelivery[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  { id: 'budget_threshold', label: 'Budget Threshold' },
  { id: 'seat_roi',         label: 'Seat ROI' },
  { id: 'cache_efficiency', label: 'Cache Efficiency' },
  { id: 'security',         label: 'Security' },
  { id: 'budget_rule',      label: 'Budget Rule Fired' },
]

const TYPE_META: Record<WebhookType, { label: string; icon: string; color: string }> = {
  slack:     { label: 'Slack',      icon: 'SL', color: '#f59e0b' },
  http:      { label: 'HTTP',       icon: 'WH', color: '#60a5fa' },
  pagerduty: { label: 'PagerDuty',  icon: 'PD', color: '#22c55e' },
  teams:     { label: 'MS Teams',   icon: 'TM', color: '#818cf8' },
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

// ── Webhook Modal ─────────────────────────────────────────────────────────────

interface WebhookModalProps {
  webhook: Webhook | null // null = create
  onClose: () => void
  onSaved: () => void
}

function WebhookModal({ webhook, onClose, onSaved }: WebhookModalProps) {
  const [name,   setName]   = useState(webhook?.name ?? '')
  const [url,    setUrl]    = useState(webhook?.url ?? '')
  const [type,   setType]   = useState<WebhookType>(webhook?.type ?? 'http')
  const [events, setEvents] = useState<string[]>(webhook?.events ?? [])
  const [allEvents, setAllEvents] = useState(webhook?.events.includes('*') ?? false)
  const [active, setActive] = useState(webhook?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; statusCode?: number; error?: string; latencyMs: number } | null>(null)

  function toggleEvent(id: string) {
    setEvents(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  async function handleTest() {
    if (!url.trim()) { setErr('Enter a URL first'); return }
    setTesting(true); setTestResult(null); setErr('')
    try {
      const body = webhook ? { id: webhook.id } : { url: url.trim(), type, name: name.trim() || 'Test' }
      const res = await fetch('/api/webhooks/test', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      setTestResult(await res.json())
    } catch {
      setErr('Test request failed')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) { setErr('Name is required'); return }
    if (!url.trim()) { setErr('URL is required'); return }
    const finalEvents = allEvents ? ['*'] : events
    if (finalEvents.length === 0) { setErr('Select at least one event'); return }

    setSaving(true); setErr('')
    try {
      const method = webhook ? 'PUT' : 'POST'
      const body   = webhook
        ? { id: webhook.id, name, url, type, events: finalEvents, active }
        : { name, url, type, events: finalEvents }

      const res = await fetch('/api/webhooks', {
        method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
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
        style={{ background: '#071e3d', border: '1px solid rgba(133,183,235,0.18)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: '#EBF4FF' }}>
              {webhook ? 'Edit Webhook' : 'New Webhook'}
            </div>
            <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.45)' }}>
              HMAC-SHA256 signed · X-Apex-Signature header · up to 3 delivery attempts
            </div>
          </div>
          <button onClick={onClose} className="text-[16px] opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#85B7EB' }}>✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Name + Type */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>Name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. #finops Slack channel"
                className="w-full rounded-[8px] px-3 py-2 text-[13px]"
                style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF', outline: 'none' }}
              />
            </div>
            <div>
              <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>Type</label>
              <select
                value={type} onChange={e => { setType(e.target.value as WebhookType); setTestResult(null) }}
                className="w-full rounded-[8px] px-3 py-2 text-[13px]"
                style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF', outline: 'none' }}
              >
                {(Object.keys(TYPE_META) as WebhookType[]).map(t => (
                  <option key={t} value={t}>{TYPE_META[t].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className={`${mono} text-[10px] uppercase tracking-wider mb-1.5 block`} style={{ color: 'rgba(133,183,235,0.55)' }}>
              {type === 'slack' ? 'Slack Incoming Webhook URL' : type === 'pagerduty' ? 'PagerDuty Events API URL' : type === 'teams' ? 'Teams Incoming Webhook URL' : 'Endpoint URL'}
            </label>
            <input
              value={url} onChange={e => { setUrl(e.target.value); setTestResult(null) }}
              placeholder="https://…"
              className={`${mono} w-full rounded-[8px] px-3 py-2 text-[12px]`}
              style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#85B7EB', outline: 'none' }}
            />
          </div>

          {/* Events */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`${mono} text-[10px] uppercase tracking-wider`} style={{ color: 'rgba(133,183,235,0.55)' }}>Event subscriptions</label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={allEvents} onChange={e => setAllEvents(e.target.checked)} className="accent-blue-400" />
                <span className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.55)' }}>All events</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2" style={{ opacity: allEvents ? 0.4 : 1, pointerEvents: allEvents ? 'none' : 'auto' }}>
              {EVENT_TYPES.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => toggleEvent(ev.id)}
                  className={`${mono} text-[10px] px-2.5 py-1.5 rounded-[7px] transition-colors`}
                  style={{
                    background: events.includes(ev.id) ? 'rgba(55,138,221,0.22)' : 'rgba(55,138,221,0.07)',
                    color:      events.includes(ev.id) ? '#85B7EB' : 'rgba(133,183,235,0.45)',
                    border:     `1px solid ${events.includes(ev.id) ? 'rgba(133,183,235,0.3)' : 'rgba(133,183,235,0.12)'}`,
                  }}
                >
                  {ev.label}
                </button>
              ))}
            </div>
          </div>

          {/* Active toggle (edit only) */}
          {webhook && (
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
                {active ? 'Active — receives matching events' : 'Disabled'}
              </span>
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className={`${mono} text-[10.5px] px-3 py-2.5 rounded-[8px]`}
              style={{
                background: testResult.success ? 'rgba(34,160,107,0.10)' : 'rgba(226,75,74,0.10)',
                border:     `1px solid ${testResult.success ? 'rgba(34,160,107,0.25)' : 'rgba(226,75,74,0.25)'}`,
                color:      testResult.success ? '#22A06B' : '#E24B4A',
              }}>
              {testResult.success ? '✓ Delivered' : `✗ Failed${testResult.error ? ` — ${testResult.error}` : ''}`}
              {testResult.statusCode != null && <span style={{ marginLeft: 8 }}>HTTP {testResult.statusCode}</span>}
              <span style={{ color: 'rgba(133,183,235,0.45)', marginLeft: 8 }}>{testResult.latencyMs}ms</span>
            </div>
          )}

          {err && (
            <div className={`${mono} text-[11px] rounded-[7px] px-3 py-2`} style={{ background: 'rgba(226,75,74,0.12)', color: '#F28B82', border: '1px solid rgba(226,75,74,0.25)' }}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid rgba(133,183,235,0.10)' }}>
          <button
            onClick={handleTest}
            disabled={testing || !url.trim()}
            className={`${mono} text-[11px] px-4 py-2 rounded-[8px] font-medium transition-all disabled:opacity-40`}
            style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.20)', color: '#85B7EB' }}
          >
            {testing ? 'Sending…' : 'Send Test'}
          </button>
          <div className="flex items-center gap-3">
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
              {saving ? 'Saving…' : webhook ? 'Update Webhook' : 'Create Webhook'}
            </button>
          </div>
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
      style={{ background: accent ? 'rgba(55,138,221,0.12)' : 'rgba(55,138,221,0.07)', border: `1px solid ${accent ? 'rgba(133,183,235,0.25)' : 'rgba(133,183,235,0.13)'}` }}
    >
      <div className={`${mono} text-[9px] uppercase tracking-[0.13em] mb-1.5`} style={{ color: 'rgba(133,183,235,0.50)' }}>{label}</div>
      <div className="text-[22px] font-bold leading-none mb-1" style={{ color: accent ? '#85B7EB' : '#EBF4FF' }}>{value}</div>
      {sub && <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>{sub}</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [webhooks,    setWebhooks]    = useState<Webhook[]>([])
  const [deliveries,  setDeliveries]  = useState<WebhookDelivery[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editItem,    setEditItem]    = useState<Webhook | null | undefined>(undefined) // undefined = closed
  const [testingId,   setTestingId]   = useState<string | null>(null)
  const [rowResult,   setRowResult]   = useState<Record<string, { success: boolean; statusCode?: number }>>({})

  const load = useCallback(async () => {
    const d = await fetch('/api/webhooks').then(r => r.json())
    if (Array.isArray(d.webhooks)) setWebhooks(d.webhooks)
    if (Array.isArray(d.recentDeliveries)) setDeliveries(d.recentDeliveries)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive(w: Webhook) {
    await fetch('/api/webhooks', {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: w.id, active: !w.active }),
    })
    load()
  }

  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook? Its delivery history will also be removed.')) return
    await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function sendTest(w: Webhook) {
    setTestingId(w.id)
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: w.id }),
      })
      const d = await res.json()
      setRowResult(prev => ({ ...prev, [w.id]: { success: d.success, statusCode: d.statusCode } }))
      load()
      setTimeout(() => setRowResult(prev => { const next = { ...prev }; delete next[w.id]; return next }), 5_000)
    } finally {
      setTestingId(null)
    }
  }

  const activeCount    = webhooks.filter(w => w.active).length
  const last24h         = deliveries.filter(d => Date.now() - new Date(d.sentAt).getTime() < 86_400_000)
  const successRate     = last24h.length > 0 ? Math.round((last24h.filter(d => d.success).length / last24h.length) * 100) : null
  const lastDeliveryAt  = deliveries[0]?.sentAt ?? null

  return (
    <div className="space-y-5">

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Webhooks"  value={String(activeCount)}    sub={`${webhooks.length} total`} accent />
        <KpiCard label="Deliveries (24h)" value={String(last24h.length)} sub="across all webhooks" />
        <KpiCard label="Success Rate"     value={successRate != null ? `${successRate}%` : '—'} sub="last 24h" />
        <KpiCard label="Last Delivery"    value={relTime(lastDeliveryAt)} sub={lastDeliveryAt ? new Date(lastDeliveryAt).toLocaleTimeString() : 'No deliveries yet'} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Webhooks panel (2/3) */}
        <div className="xl:col-span-2 rounded-[14px] overflow-hidden" style={{ background: 'rgba(55,138,221,0.05)', border: '1px solid rgba(133,183,235,0.13)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
            <div>
              <div className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>Webhook Registry</div>
              <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                Slack · HTTP · PagerDuty · Teams — HMAC signed, retried up to 3×
              </div>
            </div>
            <button
              onClick={() => setEditItem(null)}
              className={`${mono} text-[10.5px] px-3 py-1.5 rounded-[7px] transition-colors`}
              style={{ background: 'rgba(55,138,221,0.15)', border: '1px solid rgba(133,183,235,0.22)', color: '#85B7EB' }}
            >
              + Add Webhook
            </button>
          </div>

          {loading && (
            <div className={`${mono} text-[11px] text-center py-8`} style={{ color: 'rgba(133,183,235,0.40)' }}>Loading…</div>
          )}

          {!loading && webhooks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="text-[28px]" style={{ filter: 'grayscale(0.3)' }}>🔗</div>
              <div className="text-[13px] font-medium" style={{ color: 'rgba(133,183,235,0.6)' }}>No webhooks configured</div>
              <div className={`${mono} text-[10px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                Connect Slack, HTTP, PagerDuty or Teams to receive alert events
              </div>
              <button
                onClick={() => setEditItem(null)}
                className={`${mono} text-[11px] mt-2 px-4 py-2 rounded-[8px]`}
                style={{ background: '#185FA5', color: '#EBF4FF', border: '1px solid rgba(133,183,235,0.2)' }}
              >
                Add first webhook →
              </button>
            </div>
          )}

          <div className="divide-y" style={{ borderColor: 'rgba(133,183,235,0.07)' }}>
            {webhooks.map(w => {
              const meta = TYPE_META[w.type] ?? TYPE_META.http
              const lastDelivery = w.deliveries[0]
              const result = rowResult[w.id]
              return (
                <div key={w.id} className="px-4 py-3.5 group">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleActive(w)}
                      className="mt-0.5 relative w-9 h-5 rounded-full flex-shrink-0 transition-colors duration-200"
                      style={{ background: w.active ? '#185FA5' : 'rgba(55,138,221,0.15)', border: '1px solid rgba(133,183,235,0.2)' }}
                    >
                      <span
                        className="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200"
                        style={{ background: w.active ? '#85B7EB' : 'rgba(133,183,235,0.35)', transform: w.active ? 'translateX(17px)' : 'translateX(2px)' }}
                      />
                    </button>

                    <div className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5"
                      style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}30` }}>
                      {meta.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: w.active ? '#EBF4FF' : 'rgba(133,183,235,0.45)' }}>
                          {w.name}
                        </span>
                        <span className={`${mono} text-[9px] px-1.5 py-0.5 rounded`} style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
                          {meta.label}
                        </span>
                        {lastDelivery && (
                          <span style={{ color: lastDelivery.success ? '#22A06B' : '#F28B82' }} className="text-[11px]">
                            {lastDelivery.success ? '✓' : '✕'}
                          </span>
                        )}
                        {result && (
                          <span className={`${mono} text-[9px] px-1.5 py-0.5 rounded`} style={{ background: result.success ? 'rgba(34,160,107,0.12)' : 'rgba(226,75,74,0.12)', color: result.success ? '#22A06B' : '#F28B82' }}>
                            {result.success ? `✓ sent · ${result.statusCode}` : `✗ failed`}
                          </span>
                        )}
                      </div>
                      <div className={`${mono} text-[10px] mt-0.5 truncate`} style={{ color: 'rgba(133,183,235,0.45)' }}>
                        {w.url}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {w.events.includes('*') ? (
                          <span className={`${mono} text-[9px] px-2 py-0.5 rounded-[5px]`} style={{ background: 'rgba(55,138,221,0.10)', border: '1px solid rgba(133,183,235,0.15)', color: '#85B7EB' }}>
                            all events
                          </span>
                        ) : w.events.map(ev => (
                          <span key={ev} className={`${mono} text-[9px] px-2 py-0.5 rounded-[5px]`} style={{ background: 'rgba(55,138,221,0.10)', border: '1px solid rgba(133,183,235,0.15)', color: '#85B7EB' }}>
                            {EVENT_TYPES.find(e => e.id === ev)?.label ?? ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => sendTest(w)}
                        disabled={testingId === w.id}
                        className={`${mono} text-[10px] px-2.5 py-1 rounded-[6px] transition-colors disabled:opacity-40`}
                        style={{ background: 'rgba(248,161,0,0.10)', border: '1px solid rgba(248,161,0,0.22)', color: '#F8A100' }}
                      >
                        {testingId === w.id ? '…' : 'Test'}
                      </button>
                      <button
                        onClick={() => setEditItem(w)}
                        className={`${mono} text-[10px] px-2.5 py-1 rounded-[6px] transition-colors`}
                        style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.18)', color: '#85B7EB' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteWebhook(w.id)}
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

        {/* Deliveries panel (1/3) */}
        <div className="rounded-[14px] overflow-hidden" style={{ background: 'rgba(55,138,221,0.05)', border: '1px solid rgba(133,183,235,0.13)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
            <div className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>Delivery Log</div>
            <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>last 20 deliveries</div>
          </div>

          {deliveries.length === 0 ? (
            <div className={`${mono} text-[10.5px] text-center py-8`} style={{ color: 'rgba(133,183,235,0.35)' }}>
              No deliveries yet — fires automatically on the next matching alert
            </div>
          ) : (
            <div className="divide-y overflow-y-auto" style={{ borderColor: 'rgba(133,183,235,0.07)', maxHeight: 460 }}>
              {deliveries.map(d => (
                <div key={d.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span style={{ color: d.success ? '#22A06B' : '#F28B82' }}>{d.success ? '✓' : '✕'}</span>
                    <span className="text-[11.5px] font-medium truncate" style={{ color: '#EBF4FF' }}>{d.webhook?.name ?? 'Webhook'}</span>
                    <span className={`${mono} text-[9px] ml-auto flex-shrink-0`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                      {relTime(d.sentAt)}
                    </span>
                  </div>
                  <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                    {d.eventType}{d.statusCode != null ? ` · HTTP ${d.statusCode}` : ''}{d.latencyMs != null ? ` · ${d.latencyMs}ms` : ''}
                    {d.attempt > 1 ? ` · attempt ${d.attempt}` : ''}
                  </div>
                  {d.error && (
                    <div className={`${mono} text-[9px] mt-1`} style={{ color: '#F28B82' }}>{d.error}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {editItem !== undefined && (
        <WebhookModal
          webhook={editItem}
          onClose={() => setEditItem(undefined)}
          onSaved={() => { setEditItem(undefined); load() }}
        />
      )}
    </div>
  )
}
