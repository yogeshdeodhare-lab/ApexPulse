'use client'

import { Panel, Note, mono, fmtUSD, fmtTokens, fmtDate, modelShort } from '@/components/ui'

export interface UsageRecord {
  id: string; timestamp: string; model: string
  inputTokens: number; outputTokens: number; cacheReadTokens: number
  totalCost: number; userId: string | null; projectId: string | null
  latencyMs: number | null; source: string
}

const MODEL_COLORS: Record<string, string> = {
  haiku: '#2dd4bf', sonnet: '#60a5fa', opus: '#fb7185',
}
function modelColor(m: string) {
  if (m.includes('haiku'))  return MODEL_COLORS.haiku
  if (m.includes('sonnet')) return MODEL_COLORS.sonnet
  if (m.includes('opus'))   return MODEL_COLORS.opus
  return '#8a91a6'
}

export default function UsagePage({ records, loading }: { records: UsageRecord[]; loading: boolean }) {
  return (
    <div className="animate-fadeIn space-y-3">
      <Panel title="Recent usage" badge={`LAST ${records.length} RECORDS`}
        sub="one row per Claude API call · newest first">
        {loading ? (
          <p className="text-muted text-center py-8 text-[13px]">Loading…</p>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr>
                  {['Time', 'Model', 'Input', 'Output', 'Cache', 'Cost', 'Project', 'Source'].map(h => (
                    <th key={h} className={`${mono} text-[9.5px] text-muted tracking-[.07em] uppercase text-left py-2 px-2 border-b border-line whitespace-nowrap`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-line/50 last:border-none hover:bg-panel2/40 transition-colors">
                    <td className={`${mono} py-2.5 px-2 text-dim whitespace-nowrap text-[11px]`}>{fmtDate(r.timestamp)}</td>
                    <td className="px-2">
                      <span className={`${mono} text-[10px] px-2 py-0.5 rounded-full font-medium`}
                        style={{ background: modelColor(r.model) + '22', color: modelColor(r.model) }}>
                        {modelShort(r.model)}
                      </span>
                    </td>
                    <td className={`${mono} text-right px-2 text-muted`}>{fmtTokens(r.inputTokens)}</td>
                    <td className={`${mono} text-right px-2 text-muted`}>{fmtTokens(r.outputTokens)}</td>
                    <td className={`${mono} text-right px-2 text-violet`}>{fmtTokens(r.cacheReadTokens)}</td>
                    <td className={`${mono} text-right px-2 text-cyan font-medium`}>{fmtUSD(r.totalCost, 4)}</td>
                    <td className={`${mono} px-2 text-muted`}>{r.projectId ?? '—'}</td>
                    <td className={`${mono} px-2 text-dim text-[10px]`}>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Note icon="💡" accent="var(--cyan)">
        <b>Integration:</b> Record any Claude call by POSTing to{' '}
        <code className={`${mono} text-[11px] bg-panel px-1.5 py-0.5 rounded`}>POST /api/usage</code>{' '}
        with <code className={`${mono} text-[11px] bg-panel px-1.5 py-0.5 rounded`}>
          {'{ model, inputTokens, outputTokens, cacheReadTokens, projectId, userId }'}
        </code>
      </Note>
    </div>
  )
}
