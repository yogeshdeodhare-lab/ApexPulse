'use client'

import { useEffect, useState } from 'react'
import { Panel, KpiCard, mono } from '@/components/ui'
import type { AlertEvent } from '@/app/api/alerts/route'

const SEVERITY_META = {
  critical: { color: '#E24B4A', bg: 'rgba(226,75,74,0.10)', border: 'rgba(226,75,74,0.22)', label: 'CRITICAL', dot: '●' },
  warning:  { color: '#C98A20', bg: 'rgba(201,138,32,0.10)', border: 'rgba(201,138,32,0.22)', label: 'WARNING',  dot: '●' },
  info:     { color: '#85B7EB', bg: 'rgba(133,183,235,0.08)', border: 'rgba(133,183,235,0.18)', label: 'INFO',   dot: '●' },
}

const TYPE_ICONS: Record<string, string> = {
  budget_threshold: '◫',
  seat_roi:         '◧',
  cache_efficiency: '⟳',
  security:         '◉',
  provider_error:   '⬡',
}

function ago(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

function AlertCard({ alert, resolved }: { alert: AlertEvent; resolved?: boolean }) {
  const s = SEVERITY_META[alert.severity]
  return (
    <div
      className="rounded-[13px] p-4 transition-all"
      style={{
        background: resolved ? 'rgba(133,183,235,0.03)' : s.bg,
        border: `1px solid ${resolved ? 'rgba(133,183,235,0.10)' : s.border}`,
        opacity: resolved ? 0.7 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-[9px] flex items-center justify-center text-[13px] flex-shrink-0 mt-0.5"
          style={{
            background: `${s.color}18`,
            color: resolved ? 'rgba(133,183,235,0.40)' : s.color,
            border: `1px solid ${s.color}30`,
          }}
        >
          {TYPE_ICONS[alert.type] ?? '◈'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`${mono} text-[9px] px-2 py-0.5 rounded-full font-semibold`}
              style={resolved
                ? { background: 'rgba(34,160,107,0.10)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.20)' }
                : { background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}30` }
              }
            >
              {resolved ? '✓ RESOLVED' : `${s.dot} ${s.label}`}
            </span>
            <span className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>
              {resolved && alert.resolvedAt
                ? `resolved ${ago(alert.resolvedAt)} · fired ${ago(alert.firedAt)}`
                : `${ago(alert.firedAt)} · ${alert.source}`}
            </span>
          </div>
          <p className="text-[13px] font-semibold mb-1" style={{ color: resolved ? 'rgba(235,244,255,0.55)' : '#EBF4FF' }}>
            {alert.title}
          </p>
          <p className={`${mono} text-[11px] leading-relaxed`} style={{ color: 'rgba(133,183,235,0.55)' }}>
            {alert.message}
          </p>
          {!resolved && alert.value != null && alert.threshold != null && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(133,183,235,0.10)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (alert.value / alert.threshold) * 100)}%`, background: s.color, opacity: 0.7 }}
                />
              </div>
              <span className={`${mono} text-[9px] flex-shrink-0`} style={{ color: s.color }}>
                {typeof alert.value === 'number' && alert.value < 10
                  ? `${alert.value.toFixed(2)}× / ${alert.threshold}×`
                  : `${Math.min(100, Math.round((alert.value / alert.threshold) * 100))}%`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WebhookStatus() {
  return (
    <div className="space-y-2 mt-2">
      {[
        { name: 'Slack Webhook',  env: 'SLACK_WEBHOOK_URL',  events: 'budget thresholds, spend spikes' },
        { name: 'HTTP Webhook',   env: 'ALERT_WEBHOOK_URL',  events: 'all alert types (JSON POST)' },
      ].map(({ name, env, events }) => (
        <div
          key={env}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px]"
          style={{ background: 'rgba(133,183,235,0.04)', border: '1px solid rgba(133,183,235,0.08)' }}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'rgba(133,183,235,0.25)' }} />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] font-medium" style={{ color: 'rgba(235,244,255,0.60)' }}>{name}</span>
            <span className={`${mono} text-[9px] block`} style={{ color: 'rgba(133,183,235,0.35)' }}>{events}</span>
          </div>
          <code
            className={`${mono} text-[9px] px-1.5 py-0.5 rounded`}
            style={{ background: 'rgba(133,183,235,0.07)', color: 'rgba(133,183,235,0.45)' }}
          >
            {env}
          </code>
        </div>
      ))}
      <p className={`${mono} text-[9.5px] pt-1`} style={{ color: 'rgba(133,183,235,0.30)' }}>
        Webhooks fire on new alert creation — one delivery per event, not per poll.
        Configure in <code style={{ color: 'rgba(133,183,235,0.50)' }}>.env.local</code>.
      </p>
    </div>
  )
}

interface AlertsData {
  active:        AlertEvent[]
  resolved:      AlertEvent[]
  total:         number
  criticalCount: number
  warningCount:  number
}

export default function AlertsPage() {
  const [data,    setData]    = useState<AlertsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'active' | 'resolved'>('active')

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24" style={{ color: 'rgba(133,183,235,0.40)' }}>
      Evaluating alert conditions…
    </div>
  )

  const active   = data?.active   ?? []
  const resolved = data?.resolved ?? []

  return (
    <div className="space-y-4 animate-slideUp">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Active Alerts"  value={active.length}            accent={active.length > 0 ? '#E24B4A' : '#22A06B'} />
        <KpiCard label="Critical"       value={data?.criticalCount ?? 0} accent="#E24B4A" />
        <KpiCard label="Warning"        value={data?.warningCount ?? 0}  accent="#C98A20" />
        <KpiCard label="Resolved (30d)" value={resolved.length}          accent="#22A06B" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-[10px]" style={{ background: 'rgba(133,183,235,0.06)', border: '1px solid rgba(133,183,235,0.10)' }}>
        {(['active', 'resolved'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 ${mono} text-[10px] py-1.5 rounded-[8px] transition-all font-semibold capitalize`}
            style={tab === t
              ? { background: 'rgba(55,138,221,0.18)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.20)' }
              : { color: 'rgba(133,183,235,0.45)' }
            }
          >
            {t} {t === 'active' ? `(${active.length})` : `(${resolved.length})`}
          </button>
        ))}
      </div>

      {/* Active alerts */}
      {tab === 'active' && (
        <Panel title="Active Alerts" badge={active.length > 0 ? `${active.length} ACTIVE` : 'ALL CLEAR'}>
          {active.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-[32px] mb-2">✓</div>
              <p className="text-[13px] font-medium" style={{ color: '#22A06B' }}>All systems normal</p>
              <p className={`${mono} text-[10.5px] mt-1`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                No active alerts — thresholds configured via Settings → Runtime Config
              </p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {active.map(a => <AlertCard key={a.id} alert={a} />)}
            </div>
          )}
        </Panel>
      )}

      {/* Resolved history */}
      {tab === 'resolved' && (
        <Panel title="Resolved Alerts" badge="LAST 30 DAYS" sub="Auto-resolved when threshold condition clears">
          {resolved.length === 0 ? (
            <div className="py-8 text-center">
              <p className={`${mono} text-[11px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                No resolved alerts yet — history builds as alerts fire and clear.
              </p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {resolved.map(a => <AlertCard key={a.id} alert={a} resolved />)}
            </div>
          )}
        </Panel>
      )}

      {/* Alert sources (only on active tab) */}
      {tab === 'active' && (
        <Panel title="Alert Sources" badge="MONITORS">
          <div className="grid md:grid-cols-2 gap-2 mt-2">
            {[
              { icon: '◫', name: 'Budget Monitor',    desc: 'Fires when MTD spend crosses warn / critical thresholds', configKey: 'budget.warn_pct' },
              { icon: '◧', name: 'Seat ROI Monitor',  desc: 'Flags coding tools with ROI below target multiple',       configKey: 'opt.seat.roi_target' },
              { icon: '⟳', name: 'Cache Efficiency',  desc: 'Alerts when Anthropic cache hit rate drops below floor',  configKey: 'opt.cache.target_hit_rate' },
              { icon: '◉', name: 'Security Monitor',  desc: 'Raises warning on ACCESS_DENIED spikes in audit log',    configKey: null },
            ].map(({ icon, name, desc, configKey }) => (
              <div
                key={name}
                className="flex items-start gap-3 px-3 py-2.5 rounded-[10px]"
                style={{ background: 'rgba(133,183,235,0.04)', border: '1px solid rgba(133,183,235,0.08)' }}
              >
                <span className="text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'rgba(133,183,235,0.50)' }}>{icon}</span>
                <div>
                  <p className="text-[12px] font-medium" style={{ color: '#EBF4FF' }}>{name}</p>
                  <p className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>{desc}</p>
                  {configKey && (
                    <span
                      className={`${mono} text-[8.5px] mt-1 inline-block px-1.5 py-0.5 rounded`}
                      style={{ background: 'rgba(55,138,221,0.08)', color: 'rgba(133,183,235,0.50)' }}
                    >
                      config: {configKey}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Webhook delivery */}
      <Panel title="Alert Delivery" badge="WEBHOOKS · S8" sub="Fires once on new alert creation — not on every poll">
        <WebhookStatus />
      </Panel>
    </div>
  )
}
