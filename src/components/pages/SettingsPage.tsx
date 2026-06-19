'use client'

import { useEffect, useState } from 'react'
import { Panel, KpiCard, mono } from '@/components/ui'

interface SettingsData {
  version:     string
  sprint:      number
  nodeEnv:     string
  dbType:      string
  providers:   Record<string, boolean>
  authEnabled: boolean
}

interface ConfigEntry {
  value: string; default: string; description: string; category: string; isOverridden: boolean
}

// ── Runtime Config editor ─────────────────────────────────────────────────────

function ConfigEditor() {
  const [config,  setConfig]  = useState<Record<string, ConfigEntry> | null>(null)
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState<string | null>(null)
  const [saved,   setSaved]   = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => setConfig(d.config))
      .catch(() => setError('Could not load config'))
  }, [])

  async function save(key: string) {
    const value = editing[key]
    if (value === undefined) return
    setSaving(key); setError(null)
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    setSaving(null)
    if (res.ok) {
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
      setConfig(prev => prev ? { ...prev, [key]: { ...prev[key], value, isOverridden: true } } : prev)
      setEditing(prev => { const n = { ...prev }; delete n[key]; return n })
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Save failed')
    }
  }

  function reset(key: string, defaultVal: string) {
    setEditing(prev => ({ ...prev, [key]: defaultVal }))
  }

  if (error && !config) return <p className={`${mono} text-[10.5px] py-4`} style={{ color: '#E24B4A' }}>{error}</p>
  if (!config) return <p className={`${mono} text-[10.5px] py-4`} style={{ color: 'rgba(133,183,235,0.40)' }}>Loading config…</p>

  const categories = [...new Set(Object.values(config).map(c => c.category))]

  return (
    <div className="space-y-4">
      {error && <p className={`${mono} text-[10.5px] px-3 py-2 rounded-[8px]`} style={{ background: 'rgba(226,75,74,0.10)', color: '#E24B4A' }}>{error}</p>}
      {categories.map(cat => (
        <div key={cat}>
          <div className={`${mono} text-[8.5px] tracking-[.12em] uppercase mb-2 px-1`} style={{ color: 'rgba(133,183,235,0.30)' }}>
            {cat}
          </div>
          <div className="space-y-1.5">
            {Object.entries(config)
              .filter(([, v]) => v.category === cat)
              .map(([key, entry]) => {
                const currentEdit = editing[key]
                const displayVal  = currentEdit !== undefined ? currentEdit : entry.value
                const isDirty     = currentEdit !== undefined && currentEdit !== entry.value
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-3 py-2 rounded-[9px]"
                    style={{
                      background: entry.isOverridden ? 'rgba(55,138,221,0.06)' : 'rgba(133,183,235,0.03)',
                      border: `1px solid ${isDirty ? 'rgba(201,138,32,0.30)' : entry.isOverridden ? 'rgba(55,138,221,0.15)' : 'rgba(133,183,235,0.07)'}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <code className={`${mono} text-[10px]`} style={{ color: '#85B7EB' }}>{key}</code>
                        {entry.isOverridden && (
                          <span className={`${mono} text-[8px] px-1.5 py-0.5 rounded-full`}
                            style={{ background: 'rgba(55,138,221,0.12)', color: '#378ADD' }}>
                            overridden
                          </span>
                        )}
                      </div>
                      <p className={`${mono} text-[9px] mt-0.5 truncate`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                        {entry.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="text"
                        value={displayVal}
                        onChange={e => setEditing(prev => ({ ...prev, [key]: e.target.value }))}
                        className={`${mono} text-[11px] px-2 py-1 rounded-[7px] w-24 text-right outline-none`}
                        style={{
                          background: 'rgba(55,138,221,0.07)',
                          border: `1px solid ${isDirty ? 'rgba(201,138,32,0.40)' : 'rgba(133,183,235,0.15)'}`,
                          color: isDirty ? '#C98A20' : '#EBF4FF',
                        }}
                      />
                      {isDirty && (
                        <>
                          <button
                            onClick={() => save(key)}
                            disabled={saving === key}
                            className={`${mono} text-[9px] px-2 py-1 rounded-[6px] transition-all`}
                            style={{ background: 'rgba(34,160,107,0.15)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.25)' }}
                          >
                            {saving === key ? '…' : '✓'}
                          </button>
                          <button
                            onClick={() => reset(key, entry.default)}
                            className={`${mono} text-[9px] px-2 py-1 rounded-[6px]`}
                            style={{ background: 'rgba(133,183,235,0.06)', color: 'rgba(133,183,235,0.40)', border: '1px solid rgba(133,183,235,0.12)' }}
                          >
                            ↺
                          </button>
                        </>
                      )}
                      {saved === key && (
                        <span className={`${mono} text-[9px]`} style={{ color: '#22A06B' }}>✓ saved</span>
                      )}
                      {!isDirty && saved !== key && (
                        <span className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.25)' }}>
                          default: {entry.default}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

const PROVIDER_LABELS: Record<string, { label: string; key: string; doc: string }> = {
  anthropic:     { label: 'Anthropic Claude',  key: 'ANTHROPIC_API_KEY',      doc: 'Live Demo tab + cost recording' },
  openai:        { label: 'OpenAI',            key: 'OPENAI_API_KEY',         doc: 'OpenAI cost ingestion' },
  google:        { label: 'Google Gemini',     key: 'GOOGLE_API_KEY',         doc: 'Gemini cost ingestion' },
  azure:         { label: 'Azure OpenAI',      key: 'AZURE_OPENAI_API_KEY',   doc: 'Azure cost ingestion' },
  bedrock:       { label: 'AWS Bedrock',       key: 'AWS_ACCESS_KEY_ID',      doc: 'Bedrock cost ingestion' },
  github:        { label: 'GitHub Copilot',    key: 'GITHUB_TOKEN',           doc: 'Seat sync (future)' },
  slackAlerts:   { label: 'Slack Alerts',      key: 'SLACK_WEBHOOK_URL',      doc: 'Budget threshold Slack messages' },
  webhookAlerts: { label: 'Webhook Alerts',    key: 'ALERT_WEBHOOK_URL',      doc: 'Generic HTTP alert webhook' },
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: active ? '#22A06B' : 'rgba(133,183,235,0.20)', boxShadow: active ? '0 0 6px rgba(34,160,107,0.5)' : 'none' }}
    />
  )
}

export default function SettingsPage() {
  const [data, setData]       = useState<SettingsData | null>(null)
  const [exported, setExported] = useState(false)

  useEffect(() => { fetch('/api/settings').then(r => r.json()).then(setData) }, [])

  function handleExportJSON() {
    window.open('/api/export?format=json&limit=50000', '_blank')
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  function handleExportCSV() {
    const a = document.createElement('a')
    a.href = '/api/export?format=csv&limit=50000'
    a.download = `apex-usage-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  const activeProviders = data ? Object.values(data.providers).filter(Boolean).length : 0

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="App Version"  value={data?.version ?? '—'}  accent="#378ADD" />
        <KpiCard label="Sprint"       value={data ? `S${data.sprint}` : '—'} accent="#85B7EB" />
        <KpiCard label="Integrations" value={activeProviders} unit="active" accent="#22A06B" />
        <KpiCard label="Auth"         value={data?.authEnabled ? 'Enabled' : 'Open mode'} accent={data?.authEnabled ? '#22A06B' : '#C98A20'} />
      </div>

      {/* Runtime Config editor */}
      <Panel title="Runtime Config" badge="16 KEYS · LIVE EDIT" sub="Changes take effect within 60s — no restart required">
        <ConfigEditor />
      </Panel>

      {/* Provider / integration status */}
      <Panel title="Integration Status" badge="ENV CHECK" sub="Green = env var detected · configure in .env.local">
        <div className="space-y-1 mt-1">
          {Object.entries(PROVIDER_LABELS).map(([key, meta]) => {
            const active = data?.providers[key] ?? false
            return (
              <div
                key={key}
                className="flex items-center gap-3 py-2 px-3 rounded-[8px] transition-colors"
                style={{ background: active ? 'rgba(34,160,107,0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(133,183,235,0.07)' }}
              >
                <StatusDot active={active} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium" style={{ color: active ? '#EBF4FF' : 'rgba(235,244,255,0.45)' }}>
                      {meta.label}
                    </span>
                    <span className={`${mono} text-[9px] px-1.5 py-0.5 rounded`} style={{ background: 'rgba(133,183,235,0.07)', color: 'rgba(133,183,235,0.45)' }}>
                      {meta.key}
                    </span>
                  </div>
                  <div className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.35)' }}>{meta.doc}</div>
                </div>
                <span className={`${mono} text-[9px] font-semibold px-2 py-0.5 rounded-full`}
                  style={active
                    ? { background: 'rgba(34,160,107,0.12)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.25)' }
                    : { background: 'rgba(133,183,235,0.06)', color: 'rgba(133,183,235,0.35)', border: '1px solid rgba(133,183,235,0.10)' }
                  }
                >
                  {active ? 'ACTIVE' : 'NOT SET'}
                </span>
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Data export */}
      <Panel title="Data Export" sub="Download all usage records for BI tools or compliance archival">
        <div className="flex flex-wrap gap-3 mt-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[12px] font-semibold transition-all card-lift"
            style={{ background: 'rgba(55,138,221,0.12)', color: '#378ADD', border: '1px solid rgba(55,138,221,0.25)' }}
          >
            <span>↓</span> Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-[12px] font-semibold transition-all card-lift"
            style={{ background: 'rgba(133,183,235,0.08)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.18)' }}
          >
            <span>↓</span> Export JSON
          </button>
          {exported && <span className={`${mono} text-[10px] self-center`} style={{ color: '#22A06B' }}>✓ Downloading…</span>}
        </div>
        <div className={`${mono} text-[9.5px] mt-3`} style={{ color: 'rgba(133,183,235,0.30)' }}>
          Up to 50,000 records · also available via <code style={{ color: 'rgba(133,183,235,0.50)' }}>GET /api/export?format=csv&amp;team=platform&amp;from=2024-01-01</code>
        </div>
      </Panel>

      {/* Quick start */}
      <Panel title="Quick Reference" sub="Common commands">
        <div className="space-y-2 mt-1">
          {[
            { cmd: 'npm run db:setup',          desc: 'Create DB + seed demo data' },
            { cmd: 'npm run db:reset',           desc: 'Wipe DB + reseed' },
            { cmd: 'npm run db:studio',          desc: 'Prisma Studio GUI — check terminal for URL' },
            { cmd: 'docker compose up -d',       desc: 'Run in Docker (data persists in volume)' },
            { cmd: 'curl /api/health',           desc: 'Health check endpoint' },
            { cmd: 'curl /api/export?format=csv',desc: 'Export all usage as CSV' },
          ].map(({ cmd, desc }) => (
            <div key={cmd} className="flex items-start gap-3">
              <code className={`${mono} text-[10px] px-2 py-1 rounded flex-shrink-0`}
                style={{ background: 'rgba(55,138,221,0.08)', color: '#85B7EB' }}>
                {cmd}
              </code>
              <span className={`${mono} text-[10px] self-center`} style={{ color: 'rgba(133,183,235,0.45)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
