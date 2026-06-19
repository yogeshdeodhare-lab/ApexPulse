'use client'

import { useEffect, useState } from 'react'
import { Panel, KpiCard, Note, mono } from '@/components/ui'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingsData {
  providers: Record<string, boolean>
  authEnabled: boolean
}

interface VaultEntry {
  provider:  string
  keyHint:   string | null
  testedAt:  string | null
  testOk:    boolean
}

interface Integration {
  id:          string
  label:       string
  envKey:      string
  category:    string
  icon:        string
  color:       string
  description: string
  docs:        string
  placeholder: string
  needsEndpoint?: boolean  // azure needs a separate endpoint
}

// ── Static integration definitions ───────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
  {
    id: 'anthropic', label: 'Anthropic Claude', envKey: 'ANTHROPIC_API_KEY', category: 'API Provider',
    icon: 'AC', color: '#2dd4bf',
    description: 'Claude Opus, Sonnet, Haiku — token billing with cache tracking',
    docs: 'console.anthropic.com → API Keys',
    placeholder: 'sk-ant-api03-…',
  },
  {
    id: 'openai', label: 'OpenAI', envKey: 'OPENAI_API_KEY', category: 'API Provider',
    icon: 'OA', color: '#34d399',
    description: 'GPT-4o, o1, GPT-4o-mini — token billing',
    docs: 'platform.openai.com → API Keys',
    placeholder: 'sk-proj-…',
  },
  {
    id: 'google', label: 'Google Gemini', envKey: 'GOOGLE_API_KEY', category: 'API Provider',
    icon: 'GG', color: '#4ade80',
    description: 'Gemini 2.0, 1.5 Pro, Flash — token billing',
    docs: 'aistudio.google.com → API Keys',
    placeholder: 'AIza…',
  },
  {
    id: 'azure', label: 'Azure OpenAI', envKey: 'AZURE_OPENAI_API_KEY', category: 'API Provider',
    icon: 'AZ', color: '#818cf8',
    description: 'GPT-4o via Azure — token billing (13% premium over OpenAI direct)',
    docs: 'portal.azure.com → OpenAI resource → Keys and Endpoint',
    placeholder: 'Azure API key…',
    needsEndpoint: true,
  },
  {
    id: 'bedrock', label: 'AWS Bedrock', envKey: 'AWS_ACCESS_KEY_ID', category: 'API Provider',
    icon: 'AB', color: '#f472b6',
    description: 'Claude 3.5 Sonnet, Haiku via Bedrock — token billing',
    docs: 'console.aws.amazon.com → IAM → Users → Access Keys',
    placeholder: 'AKIAIOSFODNN7EXAMPLE',
  },
  {
    id: 'github', label: 'GitHub (Copilot)', envKey: 'GITHUB_TOKEN', category: 'Seat Provider',
    icon: 'GH', color: '#a3a3a3',
    description: 'GitHub Copilot seat sync — auto-import seat counts via API',
    docs: 'github.com → Settings → Developer Settings → Tokens',
    placeholder: 'ghp_…',
  },
  {
    id: 'slackAlerts', label: 'Slack Alerts', envKey: 'SLACK_WEBHOOK_URL', category: 'Webhook',
    icon: 'SL', color: '#f59e0b',
    description: 'Incoming webhook — receives budget threshold and anomaly alerts',
    docs: 'api.slack.com/messaging/webhooks',
    placeholder: 'https://hooks.slack.com/services/…',
  },
  {
    id: 'webhookAlerts', label: 'HTTP Webhook', envKey: 'ALERT_WEBHOOK_URL', category: 'Webhook',
    icon: 'WH', color: '#60a5fa',
    description: 'Generic JSON POST — all alert types, compatible with any receiver',
    docs: 'Any HTTPS endpoint that accepts POST with JSON body',
    placeholder: 'https://your-endpoint.com/alerts',
  },
]

const CATEGORIES = ['API Provider', 'Seat Provider', 'Webhook']

// ── Status badge ──────────────────────────────────────────────────────────────

function SourceBadge({ type }: { type: 'vault' | 'env' | 'none' }) {
  if (type === 'vault') return (
    <span className={`${mono} text-[9px] px-2 py-0.5 rounded-full font-semibold`}
      style={{ background: 'rgba(34,160,107,0.12)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.25)' }}>
      ● VAULT
    </span>
  )
  if (type === 'env') return (
    <span className={`${mono} text-[9px] px-2 py-0.5 rounded-full font-semibold`}
      style={{ background: 'rgba(55,138,221,0.12)', color: '#85B7EB', border: '1px solid rgba(55,138,221,0.25)' }}>
      ● ENV
    </span>
  )
  return (
    <span className={`${mono} text-[9px] px-2 py-0.5 rounded-full`}
      style={{ background: 'rgba(133,183,235,0.06)', color: 'rgba(133,183,235,0.35)', border: '1px solid rgba(133,183,235,0.12)' }}>
      ○ NOT SET
    </span>
  )
}

// ── Connect modal ─────────────────────────────────────────────────────────────

interface ConnectModalProps {
  integration: Integration
  onClose:    () => void
  onSaved:    () => void
}

function ConnectModal({ integration, onClose, onSaved }: ConnectModalProps) {
  const [key,      setKey]      = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [testing,  setTesting]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [testResult, setTestResult] = useState<{ok: boolean; message: string; latencyMs: number} | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  async function handleTest() {
    if (!key.trim()) { setError('Enter a key first'); return }
    setTesting(true); setTestResult(null); setError(null)
    try {
      const res = await fetch('/api/integrations/providers/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: integration.id, key: key.trim(), endpoint: endpoint.trim() }),
      })
      const data = await res.json()
      setTestResult(data)
    } catch (e) {
      setError('Test request failed')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!key.trim()) { setError('Enter a key first'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/integrations/providers', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: integration.id, key: key.trim() }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Save failed'); return }
      if (integration.needsEndpoint && endpoint.trim()) {
        await fetch('/api/integrations/providers', {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ provider: `${integration.id}_endpoint`, key: endpoint.trim() }),
        })
      }
      onSaved()
    } catch {
      setError('Save request failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(4,15,35,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-[16px] overflow-hidden"
        style={{ background: '#0a2040', border: '1px solid rgba(133,183,235,0.20)', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(133,183,235,0.12)' }}>
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: `${integration.color}20`, color: integration.color, border: `1px solid ${integration.color}30` }}>
            {integration.icon}
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>Connect {integration.label}</div>
            <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.45)' }}>
              Key stored encrypted with AES-256-GCM · never logged
            </div>
          </div>
          <button onClick={onClose} className="text-[16px] opacity-40 hover:opacity-70 transition-opacity" style={{ color: '#85B7EB' }}>✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Key input */}
          <div>
            <label className={`${mono} text-[9.5px] block mb-1.5`} style={{ color: 'rgba(133,183,235,0.55)' }}>
              {integration.id === 'slackAlerts' || integration.id === 'webhookAlerts' ? 'WEBHOOK URL' : 'API KEY'}
            </label>
            <input
              type="password"
              value={key}
              onChange={e => { setKey(e.target.value); setTestResult(null) }}
              placeholder={integration.placeholder}
              autoComplete="off"
              className={`${mono} w-full text-[11px] px-3 py-2.5 rounded-[8px] outline-none transition-all`}
              style={{
                background: 'rgba(55,138,221,0.07)',
                border: '1px solid rgba(133,183,235,0.16)',
                color: '#85B7EB',
              }}
            />
          </div>

          {/* Azure endpoint */}
          {integration.needsEndpoint && (
            <div>
              <label className={`${mono} text-[9.5px] block mb-1.5`} style={{ color: 'rgba(133,183,235,0.55)' }}>
                AZURE ENDPOINT
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={e => setEndpoint(e.target.value)}
                placeholder="https://<resource>.openai.azure.com/"
                className={`${mono} w-full text-[11px] px-3 py-2.5 rounded-[8px] outline-none`}
                style={{ background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.16)', color: '#85B7EB' }}
              />
            </div>
          )}

          {/* Docs hint */}
          <p className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
            {integration.docs}
          </p>

          {/* Test result */}
          {testResult && (
            <div className={`${mono} text-[10.5px] px-3 py-2.5 rounded-[8px]`}
              style={{
                background: testResult.ok ? 'rgba(34,160,107,0.10)' : 'rgba(226,75,74,0.10)',
                border:     `1px solid ${testResult.ok ? 'rgba(34,160,107,0.25)' : 'rgba(226,75,74,0.25)'}`,
                color:      testResult.ok ? '#22A06B' : '#E24B4A',
              }}>
              {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
              {testResult.latencyMs > 0 && <span style={{ color: 'rgba(133,183,235,0.45)', marginLeft: 8 }}>{testResult.latencyMs}ms</span>}
            </div>
          )}

          {error && (
            <div className={`${mono} text-[10px] px-3 py-2 rounded-[8px]`}
              style={{ background: 'rgba(226,75,74,0.10)', border: '1px solid rgba(226,75,74,0.25)', color: '#E24B4A' }}>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={handleTest} disabled={testing || !key.trim()}
            className={`${mono} text-[11px] px-4 py-2 rounded-[8px] font-medium transition-all disabled:opacity-40`}
            style={{ background: 'rgba(55,138,221,0.12)', border: '1px solid rgba(133,183,235,0.20)', color: '#85B7EB' }}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !key.trim()}
            className={`${mono} text-[11px] flex-1 py-2 rounded-[8px] font-semibold transition-all disabled:opacity-40`}
            style={{
              background: testResult?.ok ? 'rgba(34,160,107,0.20)' : 'rgba(55,138,221,0.18)',
              border:     `1px solid ${testResult?.ok ? 'rgba(34,160,107,0.30)' : 'rgba(133,183,235,0.20)'}`,
              color:      testResult?.ok ? '#22A06B' : '#85B7EB',
            }}>
            {saving ? 'Saving…' : testResult?.ok ? '✓ Save to Vault' : 'Save to Vault'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [settings,    setSettings]    = useState<SettingsData | null>(null)
  const [vault,       setVault]       = useState<VaultEntry[]>([])
  const [modalItem,   setModalItem]   = useState<Integration | null>(null)
  const [removingId,  setRemovingId]  = useState<string | null>(null)

  function load() {
    fetch('/api/settings').then(r => r.json()).then(setSettings)
    fetch('/api/integrations/providers').then(r => r.json()).then(d => { if (Array.isArray(d)) setVault(d) }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const providers   = settings?.providers ?? {}
  const vaultMap    = Object.fromEntries(vault.map(v => [v.provider, v]))

  function sourceFor(id: string): 'vault' | 'env' | 'none' {
    if (vaultMap[id]) return 'vault'
    if (providers[id]) return 'env'
    return 'none'
  }

  const activeCount = INTEGRATIONS.filter(i => sourceFor(i.id) !== 'none').length
  const vaultCount  = vault.filter(v => !v.provider.endsWith('_endpoint')).length

  async function handleRemove(id: string) {
    if (!confirm(`Remove ${id} key from vault?`)) return
    setRemovingId(id)
    await fetch(`/api/integrations/providers?provider=${id}`, { method: 'DELETE' })
    setRemovingId(null)
    load()
  }

  return (
    <div className="space-y-4 animate-slideUp">
      {modalItem && (
        <ConnectModal
          integration={modalItem}
          onClose={() => setModalItem(null)}
          onSaved={() => { setModalItem(null); load() }}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active"       value={activeCount}  unit="connected" accent="#22A06B" />
        <KpiCard label="Key Vault"    value={vaultCount}   unit="encrypted" accent="#378ADD"
          delta="AES-256-GCM · S11" deltaGood />
        <KpiCard label="Via Env Var"  value={Object.values(providers).filter(Boolean).length - (providers['slackAlerts'] ? 0 : 0)} unit="" accent="#85B7EB" />
        <KpiCard label="Auth"         value={settings?.authEnabled ? 'ON' : 'Open'} accent={settings?.authEnabled ? '#22A06B' : '#85B7EB'} />
      </div>

      {/* Integration cards by category */}
      {CATEGORIES.map(cat => {
        const items = INTEGRATIONS.filter(i => i.category === cat)
        const catActive = items.filter(i => sourceFor(i.id) !== 'none').length
        return (
          <Panel key={cat} title={cat} badge={`${catActive} / ${items.length} ACTIVE`}>
            <div className="space-y-2 mt-2">
              {items.map(item => {
                const source    = sourceFor(item.id)
                const vaultData = vaultMap[item.id]
                const active    = source !== 'none'

                return (
                  <div key={item.id}
                    className="flex items-start gap-3 p-3 rounded-[11px] transition-all"
                    style={{
                      background: active ? `${item.color}08` : 'rgba(133,183,235,0.03)',
                      border: `1px solid ${active ? item.color + '22' : 'rgba(133,183,235,0.08)'}`,
                    }}>

                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{
                        background: active ? `${item.color}20` : 'rgba(133,183,235,0.06)',
                        color:      active ? item.color : 'rgba(133,183,235,0.30)',
                        border:     `1px solid ${active ? item.color + '30' : 'rgba(133,183,235,0.10)'}`,
                      }}>
                      {item.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[12.5px] font-semibold"
                          style={{ color: active ? '#EBF4FF' : 'rgba(235,244,255,0.45)' }}>
                          {item.label}
                        </span>
                        <SourceBadge type={source} />
                        {vaultData?.testOk && (
                          <span className={`${mono} text-[9px] px-1.5 py-0.5 rounded`}
                            style={{ background: 'rgba(34,160,107,0.10)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.20)' }}>
                            ✓ tested
                          </span>
                        )}
                      </div>
                      <p className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>
                        {item.description}
                      </p>
                      {vaultData && (
                        <p className={`${mono} text-[9px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                          Vault key: ●●●●{vaultData.keyHint}
                          {vaultData.testedAt && ` · tested ${new Date(vaultData.testedAt).toLocaleDateString()}`}
                        </p>
                      )}
                      {!active && (
                        <p className={`${mono} text-[9px] mt-1`} style={{ color: 'rgba(133,183,235,0.28)' }}>
                          Set env <code style={{ color: 'rgba(133,183,235,0.50)' }}>{item.envKey}</code> or connect via vault below · {item.docs}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {vaultData && (
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={removingId === item.id}
                          className={`${mono} text-[9px] px-2 py-1 rounded-[6px] transition-all disabled:opacity-40`}
                          style={{ background: 'rgba(226,75,74,0.10)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.20)' }}>
                          {removingId === item.id ? '…' : 'Remove'}
                        </button>
                      )}
                      <button
                        onClick={() => setModalItem(item)}
                        className={`${mono} text-[9px] px-3 py-1.5 rounded-[7px] font-medium transition-all`}
                        style={{
                          background: vaultData ? 'rgba(55,138,221,0.10)' : 'rgba(55,138,221,0.16)',
                          border:     '1px solid rgba(133,183,235,0.20)',
                          color:      '#85B7EB',
                        }}>
                        {vaultData ? 'Re-connect' : 'Connect'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        )
      })}

      {/* Key vault info */}
      <Note icon="🔐" accent="#378ADD">
        <b>Key Vault (S11)</b> — API keys entered here are encrypted with <b>AES-256-GCM</b> and stored in the database.
        Keys are never logged, never returned in plaintext, and override env vars at runtime.
        Set <code className={mono}>ENCRYPTION_KEY</code> (base64 of 32 random bytes) in your env for production.
        Generate: <code className={mono}>openssl rand -base64 32</code>
      </Note>
    </div>
  )
}
