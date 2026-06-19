'use client'

import { mono } from './ui'

export type PageId =
  | 'overview' | 'providers' | 'teams'
  | 'budget' | 'optimization' | 'forecast' | 'subscriptions'
  | 'effectiveness' | 'demo'
  | 'governance' | 'alerts' | 'budgetRules' | 'webhooks'
  | 'integrations' | 'settings' | 'users'

interface NavItem {
  id: PageId
  label: string
  badge?: number
  live?: boolean
}

const SECTIONS: { title: string; icon: string; items: NavItem[] }[] = [
  {
    title: 'ANALYTICS', icon: '◈',
    items: [
      { id: 'overview',  label: 'Executive Overview' },
      { id: 'providers', label: 'Providers' },
      { id: 'teams',     label: 'Teams & Projects' },
    ],
  },
  {
    title: 'FINANCIAL', icon: '◫',
    items: [
      { id: 'budget',        label: 'Budget & Forecast' },
      { id: 'optimization',  label: 'Optimization' },
      { id: 'forecast',      label: 'Spend Forecast' },
      { id: 'subscriptions', label: 'Subscriptions' },
    ],
  },
  {
    title: 'DEVELOPER', icon: '⟳',
    items: [
      { id: 'effectiveness', label: 'Coding Effectiveness' },
      { id: 'demo',          label: 'API Playground', live: true },
    ],
  },
  {
    title: 'GOVERNANCE', icon: '◉',
    items: [
      { id: 'governance',  label: 'RBAC & Policies' },
      { id: 'alerts',      label: 'Alerts' },
      { id: 'budgetRules', label: 'Budget Rules' },
      { id: 'webhooks',    label: 'Webhooks' },
    ],
  },
  {
    title: 'ADMIN', icon: '⚙',
    items: [
      { id: 'integrations', label: 'Integrations' },
      { id: 'users',        label: 'Users' },
      { id: 'settings',     label: 'Settings' },
    ],
  },
]

// Page-specific icons
const PAGE_ICON: Record<PageId, string> = {
  overview:      '▣',
  providers:     '⬡',
  teams:         '◎',
  budget:        '◫',
  optimization:  '↗',
  forecast:      '↗',
  subscriptions: '◑',
  effectiveness: '⟳',
  demo:          '⚡',
  governance:    '◉',
  alerts:        '◈',
  budgetRules:   '⚙',
  webhooks:      '⊛',
  integrations:  '⊞',
  users:         '◎',
  settings:      '⚙',
}

// APEX Pulse™ ECG mark SVG
function PulseMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polyline
        points="6,34 14,34 19,20 25,42 31,24 36,32 41,32 50,32"
        stroke="rgba(255,255,255,0.95)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="animate-ecg"
      />
      <circle cx="31" cy="24" r="2.6" fill="#85B7EB" />
    </svg>
  )
}

interface SidebarProps {
  active:       PageId
  onNav:        (id: PageId) => void
  collapsed?:   boolean   // icon-rail mode (tablet)
  overlay?:     boolean   // mobile overlay mode
  onClose?:     () => void
  alertCount?:  number
}

export default function Sidebar({ active, onNav, collapsed = false, overlay = false, onClose, alertCount }: SidebarProps) {
  const width = overlay ? 228 : collapsed ? 60 : 228

  return (
    <aside
      className="flex flex-col flex-shrink-0 overflow-hidden overflow-y-auto transition-all duration-300"
      style={{
        width,
        minHeight: '100vh',
        background: 'linear-gradient(175deg, #042C53 0%, #051f42 60%, #04172f 100%)',
        borderRight: '1px solid rgba(133,183,235,0.10)',
        position: overlay ? 'fixed' : 'relative',
        top: overlay ? 0 : undefined,
        left: overlay ? 0 : undefined,
        bottom: overlay ? 0 : undefined,
        zIndex: overlay ? 50 : undefined,
        boxShadow: overlay ? '4px 0 40px rgba(0,0,0,0.5)' : undefined,
      }}
    >
      {/* ── Logo ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 flex-shrink-0"
        style={{
          padding: collapsed && !overlay ? '14px 0' : '14px 16px',
          justifyContent: collapsed && !overlay ? 'center' : undefined,
          borderBottom: '1px solid rgba(133,183,235,0.10)',
          minHeight: 60,
        }}
      >
        {/* ECG mark badge */}
        <div
          className="rounded-[10px] flex items-center justify-center flex-shrink-0 animate-glow"
          style={{ width: 34, height: 34, background: '#185FA5', boxShadow: '0 0 12px rgba(55,138,221,0.4)' }}
        >
          <PulseMark size={20} />
        </div>

        {(!collapsed || overlay) && (
          <div>
            <div className="text-[13.5px] font-semibold leading-tight" style={{ color: '#EBF4FF', letterSpacing: '-0.01em' }}>
              APEX <span style={{ color: '#85B7EB' }}>Pulse</span>
              <sup className="text-[8px] ml-0.5" style={{ color: 'rgba(133,183,235,0.45)', verticalAlign: 'super' }}>™</sup>
            </div>
            <div className={`${mono} text-[8.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.45)', letterSpacing: '1.8px' }}>
              INTELLIGENCE LAYER
            </div>
          </div>
        )}

        {/* Mobile close button */}
        {overlay && onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-[16px] opacity-40 hover:opacity-80 transition-opacity"
            style={{ color: '#85B7EB' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {SECTIONS.map(section => (
          <div key={section.title}>
            {/* Section title — hidden when collapsed */}
            {(!collapsed || overlay) && (
              <div
                className={`${mono} text-[8.5px] tracking-[.16em] uppercase px-[14px] pt-4 pb-1`}
                style={{ color: 'rgba(133,183,235,0.35)' }}
              >
                {section.title}
              </div>
            )}
            {collapsed && !overlay && <div className="mt-2" />}

            {section.items.map(item => {
              const isActive = active === item.id
              const icon = PAGE_ICON[item.id]
              const effectiveBadge = item.id === 'alerts'
                ? (alertCount != null && alertCount > 0 ? alertCount : undefined)
                : item.badge

              return (
                <button
                  key={item.id}
                  onClick={() => { onNav(item.id); onClose?.() }}
                  title={collapsed && !overlay ? item.label : undefined}
                  className="w-full flex items-center transition-all duration-150 text-left group"
                  style={{
                    padding: collapsed && !overlay ? '8px 0' : '7px 10px 7px 10px',
                    margin: collapsed && !overlay ? '1px 0' : '1px 6px',
                    width: collapsed && !overlay ? '100%' : 'calc(100% - 12px)',
                    justifyContent: collapsed && !overlay ? 'center' : undefined,
                    borderRadius: 9,
                    gap: 10,
                    background: isActive
                      ? 'rgba(55,138,221,0.14)'
                      : 'transparent',
                    borderLeft: isActive && (!collapsed || overlay)
                      ? '2px solid #378ADD'
                      : '2px solid transparent',
                    paddingLeft: isActive && (!collapsed || overlay) ? 8 : 10,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(55,138,221,0.07)'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  {/* Icon */}
                  <span
                    className="text-[14px] w-[18px] text-center shrink-0 leading-none"
                    style={{ color: isActive ? '#85B7EB' : 'rgba(133,183,235,0.5)' }}
                  >
                    {icon}
                  </span>

                  {/* Label + badges — hidden when collapsed */}
                  {(!collapsed || overlay) && (
                    <>
                      <span
                        className="flex-1 text-[12.5px] font-medium"
                        style={{ color: isActive ? '#EBF4FF' : 'rgba(133,183,235,0.65)' }}
                      >
                        {item.label}
                      </span>
                      {item.live && (
                        <span
                          className={`${mono} text-[8.5px] px-1.5 py-0.5 rounded`}
                          style={{ background: 'rgba(55,138,221,0.15)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.2)' }}
                        >
                          LIVE
                        </span>
                      )}
                      {effectiveBadge != null && (
                        <span
                          className={`${mono} text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white`}
                          style={{ background: '#E24B4A' }}
                        >
                          {effectiveBadge}
                        </span>
                      )}
                    </>
                  )}

                  {/* Collapsed badge dot */}
                  {collapsed && !overlay && effectiveBadge != null && (
                    <span className="absolute top-1 right-1 w-[6px] h-[6px] rounded-full bg-rose" />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{
          padding: collapsed && !overlay ? '10px 6px' : '10px 12px',
          borderTop: '1px solid rgba(133,183,235,0.10)',
        }}
      >
        <div
          className="flex items-center gap-2 rounded-[9px]"
          style={{
            background: 'rgba(24,95,165,0.15)',
            border: '1px solid rgba(133,183,235,0.12)',
            padding: collapsed && !overlay ? '8px 0' : '8px 10px',
            justifyContent: collapsed && !overlay ? 'center' : undefined,
          }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full animate-pulse2 flex-shrink-0"
            style={{ background: '#22A06B', boxShadow: '0 0 8px rgba(34,160,107,0.6)' }}
          />
          {(!collapsed || overlay) && (
            <div>
              <div className="text-[11px] font-semibold" style={{ color: '#EBF4FF' }}>Production</div>
              <div className={`${mono} text-[8.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.45)' }}>
                multi-provider · Sprint 16
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
