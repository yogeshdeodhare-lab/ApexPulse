'use client'

import { useState, useRef } from 'react'
import { Panel, Note, KpiCard, mono, fmtUSD, fmtTokens, modelShort } from '@/components/ui'
import { DEMO_MODELS } from '@/lib/pricing'

interface LiveResult {
  content: string; model: string; latencyMs: number
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
  cost: { inputCost: number; outputCost: number; cacheReadCost: number; cacheWriteCost: number; totalCost: number }
}

export default function LiveDemoPage({ onNewRecord }: { onNewRecord: () => void }) {
  const [prompt,  setPrompt]  = useState('')
  const [model,   setModel]   = useState(DEMO_MODELS[1].id)
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState<LiveResult | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || loading) return
    setLoading(true); setError(null); setResult(null)

    const res  = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) setError(data.error + (data.hint ? '\n\n' + data.hint : ''))
    else { setResult(data); onNewRecord() }
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <Note icon="⚡" accent="var(--cyan)">
        <b>Live Claude calls.</b> Each request hits the Anthropic API, gets recorded, and immediately
        updates the Overview and Usage pages. Requires{' '}
        <code className={`${mono} text-[11px] bg-panel px-1.5 py-0.5 rounded`}>ANTHROPIC_API_KEY</code> in{' '}
        <code className={`${mono} text-[11px] bg-panel px-1.5 py-0.5 rounded`}>.env.local</code>.
      </Note>

      <Panel title="Send a prompt" sub="recorded in real-time · cost calculated from Anthropic response headers">
        <form onSubmit={handleSend} className="space-y-3 mt-2">
          <div>
            <label className={`${mono} text-[10px] text-muted block mb-1.5 tracking-[.05em]`}>MODEL</label>
            <div className="flex gap-2 flex-wrap">
              {DEMO_MODELS.map(m => (
                <button key={m.id} type="button" onClick={() => setModel(m.id)}
                  className={`${mono} text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                    model === m.id ? 'border-cyan text-cyan bg-cyan/10' : 'border-line text-muted hover:border-muted'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`${mono} text-[10px] text-muted block mb-1.5 tracking-[.05em]`}>PROMPT</label>
            <textarea
              ref={textareaRef} rows={5} value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ask Claude anything… e.g. 'Explain prompt caching in 2 sentences.'"
              className="w-full bg-panel2 border border-line rounded-lg px-3 py-2.5 text-[13px] resize-y outline-none focus:border-cyan transition-colors"
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e) }}
            />
            <p className={`${mono} text-[9.5px] text-dim mt-1`}>Cmd+Enter / Ctrl+Enter to send</p>
          </div>

          <button type="submit" disabled={loading || !prompt.trim()}
            className="px-6 py-2.5 rounded-lg bg-cyan text-bg font-semibold text-[13px] disabled:opacity-40 hover:bg-cyan/90 transition-colors flex items-center gap-2">
            {loading ? <><span className="animate-spin">◌</span> Sending…</> : '▶ Send to Claude'}
          </button>
        </form>
      </Panel>

      {error && <Note icon="✗" accent="var(--rose)"><b>Error:</b> <span className="whitespace-pre-wrap">{error}</span></Note>}

      {result && (
        <>
          <Panel title="Response" badge={`${result.latencyMs}ms`} sub={modelShort(result.model)}>
            <div className="bg-panel2 rounded-lg p-4 text-[13px] leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto mt-2">
              {result.content}
            </div>
          </Panel>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Input Tokens"  value={fmtTokens(result.usage.inputTokens)}     accent="var(--blue)" />
            <KpiCard label="Output Tokens" value={fmtTokens(result.usage.outputTokens)}    accent="var(--green)" />
            <KpiCard label="Cache Read"    value={fmtTokens(result.usage.cacheReadTokens)} accent="var(--violet)" />
            <KpiCard label="Total Cost"    value={fmtUSD(result.cost.totalCost, 6)}         accent="var(--cyan)" />
          </div>

          <Panel title="Cost breakdown" sub="per token type">
            <table className="w-full text-[12.5px] border-collapse mt-2">
              <thead>
                <tr>
                  {['Token type', 'Count', 'Cost'].map(h => (
                    <th key={h} className={`${mono} text-[10px] text-muted uppercase tracking-[.06em] text-left py-2 px-2 border-b border-line`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={mono}>
                <tr className="border-b border-line/50">
                  <td className="py-2.5 px-2">Input</td>
                  <td className="px-2 text-right text-muted">{result.usage.inputTokens.toLocaleString()}</td>
                  <td className="px-2 text-right text-cyan">{fmtUSD(result.cost.inputCost, 6)}</td>
                </tr>
                <tr className="border-b border-line/50">
                  <td className="py-2.5 px-2">Output</td>
                  <td className="px-2 text-right text-muted">{result.usage.outputTokens.toLocaleString()}</td>
                  <td className="px-2 text-right text-cyan">{fmtUSD(result.cost.outputCost, 6)}</td>
                </tr>
                <tr className="border-b border-line/50">
                  <td className="py-2.5 px-2">Cache read</td>
                  <td className="px-2 text-right text-muted">{result.usage.cacheReadTokens.toLocaleString()}</td>
                  <td className="px-2 text-right text-violet">{fmtUSD(result.cost.cacheReadCost, 6)}</td>
                </tr>
                <tr className="font-semibold">
                  <td className="py-2.5 px-2" colSpan={2}>Total</td>
                  <td className="px-2 text-right text-cyan">{fmtUSD(result.cost.totalCost, 6)}</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  )
}
