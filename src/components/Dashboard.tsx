'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar, { type PageId } from './Sidebar'
import { mono } from './ui'
import OverviewPage,     { type DashboardStats } from './pages/OverviewPage'
import BudgetPage        from './pages/BudgetPage'
import UsagePage,        { type UsageRecord }    from './pages/UsagePage'
import LiveDemoPage      from './pages/LiveDemoPage'
import EffectivenessPage from './pages/EffectivenessPage'
import ProvidersPage     from './pages/ProvidersPage'
import TeamsPage          from './pages/TeamsPage'
import OptimizationPage  from './pages/OptimizationPage'
import SettingsPage      from './pages/SettingsPage'
import AlertsPage        from './pages/AlertsPage'
import GovernancePage    from './pages/GovernancePage'
import IntegrationsPage  from './pages/IntegrationsPage'
import UsersPage         from './pages/UsersPage'
import ForecastPage       from './pages/ForecastPage'
import SubscriptionsPage  from './pages/SubscriptionsPage'
import BudgetRulesPage    from './pages/BudgetRulesPage'
import WebhooksPage       from './pages/WebhooksPage'
import AccountPage        from './pages/AccountPage'
import StubPage           from './pages/StubPage'

// ── Page metadata ─────────────────────────────────────────────────────────────

const PAGE_META: Record<PageId, { title: string; sub: string; icon: string }> = {
  overview:      { title: 'Executive Overview',      icon: '▣', sub: `${new Date().toLocaleString('en-US',{month:'long',year:'numeric'})} · Multi-provider · Sprint 16` },
  providers:     { title: 'Providers',               icon: '⬡', sub: '5 API providers + 3 seat providers · token & seat billing' },
  teams:         { title: 'Teams & Attribution',     icon: '◎', sub: '4 teams · 6 contributors · project-level drill-down' },
  budget:        { title: 'Budget & Forecast',       icon: '◫', sub: 'Monthly budget · threshold state machine' },
  optimization:  { title: 'Optimization Insights',   icon: '↗', sub: 'AI-generated · model routing · cache strategy' },
  forecast:      { title: 'Spend Forecast',           icon: '↗', sub: '90-day history · 60-day projection · budget runway · S10' },
  subscriptions: { title: 'Subscriptions',           icon: '◑', sub: 'Vendor contracts · renewal calendar · committed spend · S12' },
  effectiveness: { title: 'Coding Effectiveness',    icon: '⟳', sub: '6 coding tools · Acceptance rate · Code quality · ROI' },
  demo:          { title: 'API Playground',          icon: '⚡', sub: 'Live Claude calls · real-time cost recording' },
  governance:    { title: 'RBAC & Policies',         icon: '◉', sub: '4 roles · 9 permissions · JWT auth · audit trail · S7' },
  alerts:        { title: 'Alerts & Incidents',      icon: '◈', sub: 'persisted · webhook delivery · auto-resolve · S8' },
  budgetRules:   { title: 'Budget Rules',            icon: '⚙', sub: 'IF/THEN rules · auto config-write · project caps · S16' },
  webhooks:      { title: 'Webhooks',                 icon: '⊛', sub: 'Slack · HTTP · PagerDuty · Teams · HMAC signed · retry+backoff · S14' },
  integrations:  { title: 'Integrations & Key Vault',icon: '⊞', sub: 'AES-256-GCM key vault · test-before-save · 8 providers · S11' },
  users:         { title: 'User Management',          icon: '◎', sub: 'invite · bulk CSV · SSO/SCIM · sessions · group mapping · S9, S13' },
  settings:      { title: 'Settings',                icon: '⚙', sub: 'v16.0.0 · 18 live-editable config keys · S6–S16' },
  account:       { title: 'My Account',               icon: '◇', sub: 'self-service password · TOTP MFA enrollment · S13' },
}

// ── Mobile bottom nav pages ───────────────────────────────────────────────────

const BOTTOM_NAV: { id: PageId; icon: string; label: string }[] = [
  { id: 'overview',  icon: '▣', label: 'Overview' },
  { id: 'providers', icon: '⬡', label: 'Providers' },
  { id: 'teams',     icon: '◎', label: 'Teams' },
  { id: 'budget',    icon: '◫', label: 'Budget' },
  { id: 'demo',      icon: '⚡', label: 'Playground' },
]

// ── Top bar ───────────────────────────────────────────────────────────────────

function Topbar({ page, onMenuClick }: { page: PageId; onMenuClick: () => void }) {
  const meta = PAGE_META[page]
  const now  = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <header
      className="flex items-center gap-3 flex-shrink-0 px-4 py-0"
      style={{
        background: 'rgba(7,30,61,0.90)',
        borderBottom: '1px solid rgba(133,183,235,0.11)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        minHeight: 52,
      }}
    >
      {/* Hamburger — visible only on mobile */}
      <button
        className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
        style={{ color: '#85B7EB' }}
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
          <path d="M0 1h18M0 7h18M0 13h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Page title + hero strip */}
      <div className="flex-1 min-w-0 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px]" style={{ color: '#378ADD' }}>{meta.icon}</span>
          <div className="text-[14px] font-semibold leading-tight truncate" style={{ color: '#EBF4FF' }}>
            {meta.title}
          </div>
        </div>
        <div className={`${mono} text-[9.5px] mt-0.5 truncate`} style={{ color: 'rgba(133,183,235,0.45)' }}>
          {meta.sub}
        </div>
      </div>

      {/* Right side */}
      <div className={`flex items-center gap-2 ${mono} shrink-0`}>
        <span className="hidden sm:inline text-[10px]" style={{ color: 'rgba(133,183,235,0.40)' }}>{now}</span>
        <span
          className="flex items-center gap-1.5 text-[10px] rounded-lg px-2.5 py-1"
          style={{ background: 'rgba(55,138,221,0.10)', border: '1px solid rgba(133,183,235,0.15)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse2" style={{ background: '#22A06B', boxShadow: '0 0 6px rgba(34,160,107,0.6)' }} />
          <span style={{ color: '#378ADD' }} className="font-medium">live</span>
        </span>
      </div>
    </header>
  )
}

// ── Mobile bottom navigation ──────────────────────────────────────────────────

function BottomNav({ active, onNav }: { active: PageId; onNav: (id: PageId) => void }) {
  return (
    <div className="bottom-nav items-stretch">
      {BOTTOM_NAV.map(item => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
            style={{ color: isActive ? '#378ADD' : 'rgba(133,183,235,0.40)' }}
          >
            <span className="text-[16px] leading-none">{item.icon}</span>
            <span className={`${mono} text-[8px] leading-none`}>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Loading state ─────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24" style={{ color: 'rgba(133,183,235,0.50)' }}>
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4 animate-glow"
        style={{ background: '#185FA5' }}
      >
        <svg width="22" height="22" viewBox="0 0 56 56" fill="none">
          <polyline points="6,34 14,34 19,20 25,42 31,24 36,32 41,32 50,32"
            stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="31" cy="24" r="2.6" fill="#85B7EB"/>
        </svg>
      </div>
      <p className={`${mono} text-[12px] mb-1`} style={{ color: '#85B7EB' }}>Loading APEX Pulse…</p>
      <p className={`${mono} text-[10px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
        If this persists, run: <code className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(55,138,221,0.1)' }}>npm run db:setup</code>
      </p>
    </div>
  )
}

// ── Dashboard shell ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [page,        setPage]        = useState<PageId>('overview')
  const [stats,       setStats]       = useState<DashboardStats | null>(null)
  const [records,     setRecords]     = useState<UsageRecord[]>([])
  const [loading,     setLoading]     = useState(true)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [collapsed,   setCollapsed]   = useState(false)  // icon-rail on tablet
  const [alertCount,  setAlertCount]  = useState(0)

  // Responsive sidebar collapse detection
  useEffect(() => {
    function onResize() {
      setCollapsed(window.innerWidth < 1280 && window.innerWidth >= 768)
      if (window.innerWidth >= 768) setMobileOpen(false)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/stats')
    setStats(await res.json())
  }, [])

  const fetchUsage = useCallback(async () => {
    const res = await fetch('/api/usage?limit=100')
    setRecords(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()
    fetchUsage()
    fetch('/api/alerts').then(r => r.json()).then(d => setAlertCount(d.active?.length ?? 0)).catch(() => {})
    const id = setInterval(fetchStats, 30_000)
    return () => clearInterval(id)
  }, [fetchStats, fetchUsage])

  function handleBudgetSave(amount: number) {
    fetchStats()
    if (stats) {
      setStats(prev => prev && ({
        ...prev,
        budget: {
          amount,
          consumed:       prev.budget?.consumed ?? prev.mtdSpend,
          remaining:      Math.max(0, amount - (prev.budget?.consumed ?? prev.mtdSpend)),
          utilizationPct: Math.min(100, Math.round(((prev.budget?.consumed ?? prev.mtdSpend) / amount) * 100)),
        },
      }))
    }
  }

  function navigate(id: PageId) {
    setPage(id)
    setMobileOpen(false)
  }

  function renderPage() {
    switch (page) {
      case 'overview':
        return stats ? <OverviewPage stats={stats} /> : <LoadingState />
      case 'budget':
        return <BudgetPage budget={stats?.budget ?? null} onSave={handleBudgetSave} />
      case 'teams':
        return <TeamsPage />
      case 'providers':
        return <ProvidersPage />
      case 'demo':
        return <LiveDemoPage onNewRecord={() => { fetchStats(); fetchUsage() }} />
      case 'effectiveness':
        return <EffectivenessPage />
      case 'optimization':
        return <OptimizationPage />
      case 'settings':
        return <SettingsPage />
      case 'alerts':
        return <AlertsPage />
      case 'governance':
        return <GovernancePage />
      case 'integrations':
        return <IntegrationsPage />
      case 'users':
        return <UsersPage />
      case 'forecast':
        return <ForecastPage />
      case 'subscriptions':
        return <SubscriptionsPage />
      case 'budgetRules':
        return <BudgetRulesPage />
      case 'webhooks':
        return <WebhooksPage />
      case 'account':
        return <AccountPage />
      default:
        return <StubPage pageId={page} />
    }
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="md:hidden">
          <Sidebar active={page} onNav={navigate} overlay onClose={() => setMobileOpen(false)} alertCount={alertCount} />
        </div>
      )}

      {/* Desktop / tablet sidebar (uses CSS --sw variable for width) */}
      <div className="hidden md:block flex-shrink-0" style={{ width: 'var(--sw)' }}>
        <Sidebar active={page} onNav={navigate} collapsed={collapsed} alertCount={alertCount} />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar page={page} onMenuClick={() => setMobileOpen(v => !v)} />

        <main className="flex-1 overflow-y-auto p-4 md:p-5 animate-slideUp">
          {renderPage()}
        </main>

        <footer
          className={`${mono} text-[9.5px] text-center py-2 flex-shrink-0 hidden sm:block`}
          style={{ color: 'rgba(133,183,235,0.28)', borderTop: '1px solid rgba(133,183,235,0.08)' }}
        >
          APEX Pulse · Intelligence Layer · Sprint 16 · v16.0.0 · verify pricing at each provider's page
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav active={page} onNav={navigate} />
    </div>
  )
}
