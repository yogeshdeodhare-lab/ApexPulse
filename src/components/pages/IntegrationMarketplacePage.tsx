'use client'

import { useState, useEffect, useCallback } from 'react'
import { mono } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Field { key: string; label: string; placeholder?: string }

interface CatalogEntry {
  id:             string
  label:          string
  category:       string
  authMethod:     string
  description:    string
  fields:         Field[]
  secretLabel:    string | null
  supportsSync:   boolean
  supportsTicket: boolean
  connected:      boolean
  active:         boolean
  config:         Record<string, string>
  testedAt:       string | null
  testOk:         boolean
  lastSyncAt:     string | null
  lastSyncStatus: string | null
  lastSyncError:  string | null
  lastSyncCount:  number | null
}

const ICON: Record<string, string> = { jira: 'JR', linear: 'LN', datadog: 'DD', servicenow: 'SN', grafana: 'GF' }
const COLOR: Record<string, string> = { jira: '#2684ff', linear: '#5e6ad2', datadog: '#632ca6', servicenow: '#62d84e', grafana: '#f46800' }

function relTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ── Connect modal ─────────────────────────────────────────────────────────────

interface ConnectModalProps {
  entry:   CatalogEntry
  onClose: () => void
  onSaved: () => void
}

function ConnectModal({ entry, onClose, onSaved }: ConnectModalProps) {
  const [config, setConfig] = useState<Record<string, string>>(entry.config ?? {})
  const [secret, setSecret] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs: number } | null>(null)
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleTest() {
    setTesting(true); setTestResult(null); setError(null)
    try {
      const res = await fetch(`/api/integrations/marketplace/${entry.id}/test`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config, secret: secret || undefined }),
      })
      setTestResult(await res.json())
    } catch {
      setError('Test request failed')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/integrations/marketplace/${entry.id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config, secret: secret || undefined }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Connect failed'); return }
      if (d.secret) { setGeneratedSecret(d.secret); return } // show once, don't close yet
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,15,36,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !generatedSecret) onClose() }}>
      <div className="w-full max-w-md rounded-[14px] overflow-hidden"
        style={{ background: '#071e3d', border: '1px solid rgba(133,183,235,0.18)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>

        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
          <div>
            <div className="text-[14px] font-semibold" style={{ color: '#EBF4FF' }}>
              {entry.connected ? 'Edit' : 'Connect'} {entry.label}
            </div>
            <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.45)' }}>{entry.authMethod}</div>
          </div>
          {!generatedSecret && (
            <button onClick={onClose} className="text-[16px] opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#85B7EB' }}>✕</button>
          )}
        </div>

        <div className="px-5 py-4 space-y-3">
          {generatedSecret ? (
            <>
              <div className={`${mono} text-[10.5px] px-3 py-2.5 rounded-[8px]`} style={{ background: 'rgba(34,160,107,0.10)', border: '1px solid rgba(34,160,107,0.25)', color: '#22A06B' }}>
                ✓ Connected. Copy this scrape token now — it won&apos;t be shown again.
              </div>
              <div className={`${mono} text-[11px] px-3 py-2.5 rounded-[8px] break-all`} style={{ background: 'rgba(55,138,221,0.08)', border: '1px solid rgba(133,183,235,0.18)', color: '#85B7EB' }}>
                {generatedSecret}
              </div>
              <div className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                Use it as a Bearer token against <code>GET /api/metrics</code> in your Prometheus scrape config.
              </div>
              <button onClick={() => { onSaved() }} className={`${mono} w-full text-[11.5px] py-2 rounded-[8px] font-semibold`} style={{ background: '#185FA5', color: '#EBF4FF' }}>
                Done
              </button>
            </>
          ) : (
            <>
              {entry.fields.map(f => (
                <div key={f.key}>
                  <label className={`${mono} text-[9.5px] block mb-1.5`} style={{ color: 'rgba(133,183,235,0.55)' }}>{f.label.toUpperCase()}</label>
                  <input
                    value={config[f.key] ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className={`${mono} w-full text-[11px] px-3 py-2.5 rounded-[8px] outline-none`}
                    style={{ background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.16)', color: '#EBF4FF' }}
                  />
                </div>
              ))}

              {entry.secretLabel && (
                <div>
                  <label className={`${mono} text-[9.5px] block mb-1.5`} style={{ color: 'rgba(133,183,235,0.55)' }}>{entry.secretLabel.toUpperCase()}</label>
                  <input
                    type="password" value={secret} onChange={e => { setSecret(e.target.value); setTestResult(null) }}
                    placeholder={entry.connected ? 'Leave blank to keep existing' : undefined}
                    autoComplete="off"
                    className={`${mono} w-full text-[11px] px-3 py-2.5 rounded-[8px] outline-none`}
                    style={{ background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.16)', color: '#85B7EB' }}
                  />
                </div>
              )}

              {!entry.fields.length && !entry.secretLabel && (
                <p className={`${mono} text-[10.5px]`} style={{ color: 'rgba(133,183,235,0.45)' }}>
                  No configuration needed — connecting generates a scrape token for Grafana/Prometheus to use against <code>GET /api/metrics</code>.
                </p>
              )}

              {testResult && (
                <div className={`${mono} text-[10.5px] px-3 py-2.5 rounded-[8px]`}
                  style={{ background: testResult.ok ? 'rgba(34,160,107,0.10)' : 'rgba(226,75,74,0.10)', border: `1px solid ${testResult.ok ? 'rgba(34,160,107,0.25)' : 'rgba(226,75,74,0.25)'}`, color: testResult.ok ? '#22A06B' : '#E24B4A' }}>
                  {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
                  {testResult.latencyMs > 0 && <span style={{ color: 'rgba(133,183,235,0.45)', marginLeft: 8 }}>{testResult.latencyMs}ms</span>}
                </div>
              )}
              {error && (
                <div className={`${mono} text-[10px] px-3 py-2 rounded-[8px]`} style={{ background: 'rgba(226,75,74,0.10)', border: '1px solid rgba(226,75,74,0.25)', color: '#E24B4A' }}>{error}</div>
              )}
            </>
          )}
        </div>

        {!generatedSecret && (
          <div className="flex gap-2 px-5 pb-5">
            {entry.fields.length > 0 || entry.secretLabel ? (
              <button onClick={handleTest} disabled={testing}
                className={`${mono} text-[11px] px-4 py-2 rounded-[8px] font-medium transition-all disabled:opacity-40`}
                style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.20)', color: '#85B7EB' }}>
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
            ) : null}
            <button onClick={handleSave} disabled={saving}
              className={`${mono} text-[11px] flex-1 py-2 rounded-[8px] font-semibold transition-all disabled:opacity-40`}
              style={{ background: testResult?.ok ? 'rgba(34,160,107,0.20)' : 'rgba(55,138,221,0.18)', border: `1px solid ${testResult?.ok ? 'rgba(34,160,107,0.30)' : 'rgba(133,183,235,0.20)'}`, color: testResult?.ok ? '#22A06B' : '#85B7EB' }}>
              {saving ? 'Saving…' : entry.connected ? 'Update' : 'Connect'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-[12px] p-4" style={{ background: accent ? 'rgba(55,138,221,0.12)' : 'rgba(55,138,221,0.07)', border: `1px solid ${accent ? 'rgba(133,183,235,0.25)' : 'rgba(133,183,235,0.13)'}` }}>
      <div className={`${mono} text-[9px] uppercase tracking-[0.13em] mb-1.5`} style={{ color: 'rgba(133,183,235,0.50)' }}>{label}</div>
      <div className="text-[22px] font-bold leading-none mb-1" style={{ color: accent ? '#85B7EB' : '#EBF4FF' }}>{value}</div>
      {sub && <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>{sub}</div>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IntegrationMarketplacePage() {
  const [catalog,  setCatalog]  = useState<CatalogEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [editItem, setEditItem] = useState<CatalogEntry | null>(null)
  const [busyId,   setBusyId]   = useState<string | null>(null)
  const [rowMsg,   setRowMsg]   = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const d = await fetch('/api/integrations/marketplace').then(r => r.json())
    if (Array.isArray(d)) setCatalog(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function disconnect(id: string) {
    if (!confirm('Disconnect this integration?')) return
    setBusyId(id)
    await fetch(`/api/integrations/marketplace/${id}`, { method: 'DELETE' })
    setBusyId(null)
    load()
  }

  async function test(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/integrations/marketplace/${id}/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    const d = await res.json()
    setRowMsg(prev => ({ ...prev, [id]: d.ok ? `✓ ${d.message}` : `✗ ${d.message}` }))
    setBusyId(null)
    load()
    setTimeout(() => setRowMsg(prev => { const n = { ...prev }; delete n[id]; return n }), 6_000)
  }

  async function sync(id: string) {
    setBusyId(id)
    const res = await fetch(`/api/integrations/marketplace/${id}/sync`, { method: 'POST' })
    const d = await res.json()
    setRowMsg(prev => ({ ...prev, [id]: d.ok ? `✓ ${d.message}` : `✗ ${d.message}` }))
    setBusyId(null)
    load()
    setTimeout(() => setRowMsg(prev => { const n = { ...prev }; delete n[id]; return n }), 6_000)
  }

  const connectedCount = catalog.filter(c => c.connected && c.active).length
  const ticketCapable  = catalog.filter(c => c.connected && c.active && c.supportsTicket).length
  const lastTest        = catalog.filter(c => c.testedAt).sort((a, b) => new Date(b.testedAt!).getTime() - new Date(a.testedAt!).getTime())[0]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Connected"        value={`${connectedCount} / ${catalog.length}`} sub="active integrations" accent />
        <KpiCard label="Ticket-on-Alert"  value={String(ticketCapable)}                    sub="Jira/Linear/ServiceNow" />
        <KpiCard label="Last Test"        value={relTime(lastTest?.testedAt ?? null)}      sub={lastTest?.label ?? 'none yet'} />
        <KpiCard label="Categories"       value="3"                                        sub="Issue Tracker · Observability · ITSM" />
      </div>

      <div className="rounded-[14px] overflow-hidden" style={{ background: 'rgba(55,138,221,0.05)', border: '1px solid rgba(133,183,235,0.13)' }}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
          <div className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>Integration Marketplace</div>
          <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>
            One-click connections — credentials encrypted at rest, never returned in plaintext · S15
          </div>
        </div>

        {loading && <div className={`${mono} text-[11px] text-center py-8`} style={{ color: 'rgba(133,183,235,0.40)' }}>Loading…</div>}

        <div className="divide-y" style={{ borderColor: 'rgba(133,183,235,0.07)' }}>
          {catalog.map(entry => {
            const color = COLOR[entry.id] ?? '#85B7EB'
            return (
              <div key={entry.id} className="px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                    style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                    {ICON[entry.id]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>{entry.label}</span>
                      <span className={`${mono} text-[9px] px-2 py-0.5 rounded-full`} style={{ background: 'rgba(55,138,221,0.10)', color: 'rgba(133,183,235,0.60)', border: '1px solid rgba(133,183,235,0.15)' }}>
                        {entry.category}
                      </span>
                      {entry.connected ? (
                        <span className={`${mono} text-[9px] px-2 py-0.5 rounded-full`} style={{ background: 'rgba(34,160,107,0.12)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.25)' }}>
                          ● CONNECTED
                        </span>
                      ) : (
                        <span className={`${mono} text-[9px] px-2 py-0.5 rounded-full`} style={{ background: 'rgba(133,183,235,0.06)', color: 'rgba(133,183,235,0.35)', border: '1px solid rgba(133,183,235,0.12)' }}>
                          ○ NOT CONNECTED
                        </span>
                      )}
                      {entry.testedAt && (
                        <span style={{ color: entry.testOk ? '#22A06B' : '#F28B82' }} className="text-[11px]">{entry.testOk ? '✓' : '✕'}</span>
                      )}
                    </div>
                    <p className={`${mono} text-[9.5px] mt-1`} style={{ color: 'rgba(133,183,235,0.45)' }}>{entry.description} · {entry.authMethod}</p>
                    {entry.connected && (
                      <p className={`${mono} text-[9px] mt-1`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                        {entry.testedAt && `tested ${relTime(entry.testedAt)}`}
                        {entry.supportsSync && ` · last sync ${relTime(entry.lastSyncAt)}${entry.lastSyncStatus === 'error' ? ` (${entry.lastSyncError})` : ''}`}
                      </p>
                    )}
                    {rowMsg[entry.id] && (
                      <p className={`${mono} text-[9.5px] mt-1`} style={{ color: rowMsg[entry.id].startsWith('✓') ? '#22A06B' : '#F28B82' }}>{rowMsg[entry.id]}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {entry.connected && (
                      <button onClick={() => test(entry.id)} disabled={busyId === entry.id}
                        className={`${mono} text-[9px] px-2.5 py-1 rounded-[6px] transition-colors disabled:opacity-40`}
                        style={{ background: 'rgba(248,161,0,0.10)', border: '1px solid rgba(248,161,0,0.22)', color: '#F8A100' }}>
                        Test
                      </button>
                    )}
                    {entry.connected && entry.supportsSync && (
                      <button onClick={() => sync(entry.id)} disabled={busyId === entry.id}
                        className={`${mono} text-[9px] px-2.5 py-1 rounded-[6px] transition-colors disabled:opacity-40`}
                        style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.18)', color: '#85B7EB' }}>
                        Sync
                      </button>
                    )}
                    <button onClick={() => setEditItem(entry)}
                      className={`${mono} text-[9px] px-2.5 py-1 rounded-[6px] transition-colors`}
                      style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.18)', color: '#85B7EB' }}>
                      {entry.connected ? 'Edit' : 'Connect'}
                    </button>
                    {entry.connected && (
                      <button onClick={() => disconnect(entry.id)} disabled={busyId === entry.id}
                        className={`${mono} text-[9px] px-2.5 py-1 rounded-[6px] transition-colors disabled:opacity-40`}
                        style={{ background: 'rgba(226,75,74,0.10)', border: '1px solid rgba(226,75,74,0.20)', color: '#F28B82' }}>
                        Disconnect
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editItem && (
        <ConnectModal entry={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load() }} />
      )}
    </div>
  )
}
