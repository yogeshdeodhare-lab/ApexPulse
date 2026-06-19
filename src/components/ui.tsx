'use client'

// ── Shared class strings ──────────────────────────────────────────────────────

export const mono  = 'font-mono'
export const panel = 'bg-panel border border-[rgba(133,183,235,0.13)] rounded-[14px] p-4'

// ── Formatters ────────────────────────────────────────────────────────────────

export function fmtUSD(n: number, decimals = 2) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(decimals)}`
}

export function fmtTokens(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

export function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function modelShort(id: string) {
  if (id.includes('haiku'))  return 'Haiku'
  if (id.includes('sonnet')) return 'Sonnet'
  if (id.includes('opus'))   return 'Opus'
  return id.split('-')[0]
}

export function getBarColor(pct: number): string {
  if (pct >= 90) return '#E24B4A'
  if (pct >= 80) return '#C98A20'
  if (pct >= 70) return '#C98A20'
  return '#378ADD'
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:      string
  value:      string | number
  unit?:      string
  accent?:    string
  delta?:     string
  deltaGood?: boolean
  sub?:       string
}

export function KpiCard({ label, value, unit, accent = '#378ADD', delta, deltaGood, sub }: KpiCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[14px] p-4 flex flex-col gap-1 card-lift"
      style={{
        background: 'rgba(13,40,69,0.80)',
        border: '1px solid rgba(133,183,235,0.14)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Glow blob */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-[0.18] pointer-events-none"
        style={{ background: accent, filter: 'blur(18px)' }}
      />
      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[14px]"
        style={{ background: `linear-gradient(90deg, ${accent} 0%, transparent 70%)`, opacity: 0.7 }}
      />

      <div className={`${mono} text-[9.5px] tracking-[.10em] uppercase`} style={{ color: 'rgba(133,183,235,0.55)' }}>
        {label}
      </div>
      <div className="flex items-baseline gap-1 leading-none">
        <span className="text-[24px] font-semibold" style={{ color: '#EBF4FF' }}>{value}</span>
        {unit && <span className="text-[13px]" style={{ color: accent }}>{unit}</span>}
      </div>
      {delta && (
        <div className={`${mono} text-[10px] mt-0.5`} style={{ color: deltaGood ? '#22A06B' : '#C98A20' }}>
          {delta}
        </div>
      )}
      {sub && (
        <div className={`${mono} text-[10px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>{sub}</div>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface PanelProps {
  title:      string
  badge?:     string
  sub?:       string
  children:   React.ReactNode
  accent?:    string
  className?: string
}

export function Panel({ title, badge, sub, children, accent, className = '' }: PanelProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[14px] p-4 ${className}`}
      style={{
        background: 'rgba(13,40,69,0.75)',
        border: '1px solid rgba(133,183,235,0.14)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {/* Gradient top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[14px]"
        style={{
          background: accent
            ? `linear-gradient(90deg, ${accent} 0%, transparent 70%)`
            : 'linear-gradient(90deg, #378ADD 0%, #85B7EB 55%, transparent 100%)',
          opacity: 0.65,
        }}
      />

      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
        <span className="text-[13px] font-semibold" style={{ color: '#EBF4FF' }}>{title}</span>
        {badge && (
          <span
            className={`${mono} text-[9px] tracking-[.08em] px-2 py-0.5 rounded-full`}
            style={{ background: 'rgba(55,138,221,0.11)', color: 'rgba(133,183,235,0.60)', border: '1px solid rgba(133,183,235,0.12)' }}
          >
            {badge}
          </span>
        )}
      </div>
      {sub && <div className={`${mono} text-[10px] mb-2`} style={{ color: 'rgba(133,183,235,0.40)' }}>{sub}</div>}
      {children}
    </div>
  )
}

// ── Note ──────────────────────────────────────────────────────────────────────

interface NoteProps {
  icon?:    string
  accent?:  string
  children: React.ReactNode
}

export function Note({ icon = 'ℹ', accent = '#378ADD', children }: NoteProps) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-[11px] p-3 text-[12px]"
      style={{
        background: 'rgba(55,138,221,0.06)',
        border: `1px solid rgba(55,138,221,0.18)`,
        color: 'rgba(235,244,255,0.75)',
      }}
    >
      <span className="text-[14px] shrink-0 leading-tight mt-0.5" style={{ color: accent }}>{icon}</span>
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

export function StatusBadge({ pct }: { pct: number }) {
  const { label, bg, fg } =
    pct >= 100 ? { label: 'EXCEEDED', bg: 'rgba(226,75,74,0.15)',  fg: '#E24B4A' } :
    pct >= 90  ? { label: 'CRITICAL', bg: 'rgba(226,75,74,0.12)',  fg: '#E24B4A' } :
    pct >= 80  ? { label: 'ELEVATED', bg: 'rgba(201,138,32,0.12)', fg: '#C98A20' } :
    pct >= 70  ? { label: 'WARNING',  bg: 'rgba(201,138,32,0.10)', fg: '#C98A20' } :
                 { label: 'ACTIVE',   bg: 'rgba(55,138,221,0.12)', fg: '#378ADD' }

  return (
    <span
      className={`${mono} text-[9px] font-semibold px-2 py-0.5 rounded-full`}
      style={{ background: bg, color: fg, border: `1px solid ${fg}38` }}
    >
      {label} · {pct}%
    </span>
  )
}

// ── SrcBadge ─────────────────────────────────────────────────────────────────

const SRC_CFG = {
  API:  { bg: 'rgba(34,160,107,0.12)',  fg: '#22A06B', border: 'rgba(34,160,107,0.25)' },
  GIT:  { bg: 'rgba(201,138,32,0.10)',  fg: '#C98A20', border: 'rgba(201,138,32,0.22)' },
  STAT: { bg: 'rgba(123,150,201,0.10)', fg: '#7B96C9', border: 'rgba(123,150,201,0.22)' },
}

export function SrcBadge({ src }: { src: 'API' | 'GIT' | 'STAT' }) {
  const c = SRC_CFG[src]
  return (
    <span
      className={`${mono} text-[9px] font-semibold px-1.5 py-0.5 rounded`}
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      {src}
    </span>
  )
}
