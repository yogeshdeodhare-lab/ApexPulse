'use client'

import { useEffect, useState } from 'react'
import { Panel, KpiCard, mono } from '@/components/ui'

interface AppUser {
  id:          string
  email:       string
  name:        string | null
  role:        'viewer' | 'manager' | 'finance' | 'admin'
  active:      boolean
  createdAt:   string
  lastLoginAt: string | null
}

interface UsersSummary { total: number; active: number; admins: number; viewers: number }

const ROLE_META: Record<string, { label: string; color: string }> = {
  admin:   { label: 'Admin',   color: '#E24B4A' },
  finance: { label: 'Finance', color: '#C98A20' },
  manager: { label: 'Manager', color: '#22A06B' },
  viewer:  { label: 'Viewer',  color: '#85B7EB' },
}

function RoleBadge({ role }: { role: string }) {
  const m = ROLE_META[role] ?? { label: role, color: '#85B7EB' }
  return (
    <span
      className={`${mono} text-[9px] px-2 py-0.5 rounded-full font-semibold`}
      style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}28` }}
    >
      {m.label}
    </span>
  )
}

function ago(ts: string | null) {
  if (!ts) return 'never'
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form,    setForm]    = useState({ email: '', name: '', role: 'viewer', password: '' })
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const res = await fetch('/api/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { onCreated(); onClose() }
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Create failed')
    }
  }

  const inputStyle = {
    background: 'rgba(55,138,221,0.07)',
    border: '1px solid rgba(133,183,235,0.18)',
    borderRadius: 8,
    color: '#EBF4FF',
    padding: '7px 10px',
    fontSize: 12,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(4,23,47,0.80)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-[16px] p-6"
        style={{ background: '#051f42', border: '1px solid rgba(133,183,235,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-semibold" style={{ color: '#EBF4FF' }}>Invite User</h3>
          <button onClick={onClose} style={{ color: 'rgba(133,183,235,0.45)', fontSize: 18 }}>✕</button>
        </div>

        {error && (
          <div className={`${mono} text-[10px] px-3 py-2 rounded-[8px] mb-4`}
            style={{ background: 'rgba(226,75,74,0.10)', color: '#E24B4A' }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>EMAIL *</label>
            <input type="email" required style={inputStyle} value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>DISPLAY NAME</label>
            <input type="text" style={inputStyle} value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>ROLE *</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {['viewer', 'manager', 'finance', 'admin'].map(r => (
                <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>TEMPORARY PASSWORD *</label>
            <input type="password" required style={inputStyle} value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 ${mono} text-[11px] py-2 rounded-[9px] font-semibold transition-all`}
              style={{ background: 'rgba(55,138,221,0.20)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.25)' }}
            >
              {saving ? 'Creating…' : 'Create User'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${mono} text-[11px] px-4 py-2 rounded-[9px]`}
              style={{ color: 'rgba(133,183,235,0.45)', border: '1px solid rgba(133,183,235,0.12)' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users,    setUsers]    = useState<AppUser[]>([])
  const [summary,  setSummary]  = useState<UsersSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showModal,setShowModal]= useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/users')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setUsers(d.users ?? [])
        setSummary(d.summary ?? null)
        setLoading(false)
      })
      .catch(() => { setError('Could not load users'); setLoading(false) })
  }

  useEffect(load, [])

  async function patchUser(id: string, patch: Record<string, unknown>) {
    setUpdating(id)
    const res = await fetch('/api/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, ...patch }),
    })
    setUpdating(null)
    if (res.ok) {
      const updated = await res.json()
      setUsers(prev => prev.map(u => u.id === id ? updated : u))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24" style={{ color: 'rgba(133,183,235,0.40)' }}>
      Loading users…
    </div>
  )

  if (error) return (
    <div className="p-4 rounded-[12px] mt-4" style={{ background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.20)' }}>
      <p className={`${mono} text-[11px]`} style={{ color: '#E24B4A' }}>{error}</p>
      <p className={`${mono} text-[10px] mt-1`} style={{ color: 'rgba(133,183,235,0.40)' }}>
        Requires admin role and auth enabled (NEXTAUTH_SECRET in .env.local).
      </p>
    </div>
  )

  return (
    <div className="space-y-4 animate-slideUp">
      {showModal && <InviteModal onClose={() => setShowModal(false)} onCreated={load} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Users"  value={summary?.total   ?? 0} accent="#378ADD" />
        <KpiCard label="Active"       value={summary?.active  ?? 0} accent="#22A06B" />
        <KpiCard label="Admins"       value={summary?.admins  ?? 0} accent="#E24B4A" />
        <KpiCard label="Viewers"      value={summary?.viewers ?? 0} accent="#85B7EB" />
      </div>

      {/* User table */}
      <Panel
        title="Users"
        badge={`${users.length} ACCOUNTS`}
        sub="Admin-managed · roles enforced at middleware level"
      >
        <div className="flex justify-end mt-2 mb-3">
          <button
            onClick={() => setShowModal(true)}
            className={`${mono} text-[10px] px-3 py-1.5 rounded-[8px] font-semibold transition-all`}
            style={{ background: 'rgba(55,138,221,0.14)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.20)' }}
          >
            + Invite User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                {['User', 'Role', 'Status', 'Last Login', 'Created', ''].map(h => (
                  <th
                    key={h}
                    className={`${mono} text-[9px] tracking-[.07em] uppercase text-left py-2 px-2`}
                    style={{ color: 'rgba(133,183,235,0.40)', borderBottom: '1px solid rgba(133,183,235,0.10)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr
                  key={u.id}
                  style={{ borderBottom: '1px solid rgba(133,183,235,0.06)', opacity: u.active ? 1 : 0.5 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(55,138,221,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="py-2.5 px-2">
                    <div className="font-medium" style={{ color: '#EBF4FF' }}>{u.name ?? '—'}</div>
                    <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.45)' }}>{u.email}</div>
                  </td>
                  <td className="px-2">
                    <select
                      value={u.role}
                      disabled={updating === u.id}
                      onChange={e => patchUser(u.id, { role: e.target.value })}
                      className={`${mono} text-[9px] rounded-[6px] px-1.5 py-1 cursor-pointer`}
                      style={{
                        background: `${ROLE_META[u.role]?.color ?? '#85B7EB'}18`,
                        color: ROLE_META[u.role]?.color ?? '#85B7EB',
                        border: `1px solid ${ROLE_META[u.role]?.color ?? '#85B7EB'}28`,
                      }}
                    >
                      {['viewer', 'manager', 'finance', 'admin'].map(r => (
                        <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2">
                    <button
                      onClick={() => patchUser(u.id, { active: !u.active })}
                      disabled={updating === u.id}
                      className={`${mono} text-[9px] px-2 py-0.5 rounded-full`}
                      style={u.active
                        ? { background: 'rgba(34,160,107,0.12)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.25)' }
                        : { background: 'rgba(133,183,235,0.06)', color: 'rgba(133,183,235,0.35)', border: '1px solid rgba(133,183,235,0.12)' }
                      }
                    >
                      {updating === u.id ? '…' : u.active ? '● Active' : '○ Inactive'}
                    </button>
                  </td>
                  <td className={`${mono} text-[10px] px-2`} style={{ color: 'rgba(133,183,235,0.45)' }}>
                    {ago(u.lastLoginAt)}
                  </td>
                  <td className={`${mono} text-[10px] px-2`} style={{ color: 'rgba(133,183,235,0.35)' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="px-2">
                    <RoleBadge role={u.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* How-to */}
      <Panel title="Access Management" sub="Role changes take effect on next API call — no re-login needed">
        <div className="grid md:grid-cols-2 gap-2 mt-2">
          {[
            { icon: '◉', title: 'Role assignment',     desc: 'Change roles inline — enforced immediately via JWT claims on next request' },
            { icon: '⟳', title: 'Password reset',      desc: 'Run npm run auth:hash-password, then update passwordHash via Prisma Studio' },
            { icon: '◫', title: 'Deactivate (not delete)', desc: 'Inactive users are blocked at auth — history and attribution data preserved' },
            { icon: '◈', title: 'Audit trail',          desc: 'All user create/update events logged to AuditLog — view via GET /api/audit' },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 px-3 py-2.5 rounded-[10px]"
              style={{ background: 'rgba(133,183,235,0.04)', border: '1px solid rgba(133,183,235,0.08)' }}
            >
              <span className="text-[14px] mt-0.5 flex-shrink-0" style={{ color: 'rgba(133,183,235,0.50)' }}>{icon}</span>
              <div>
                <p className="text-[12px] font-medium" style={{ color: '#EBF4FF' }}>{title}</p>
                <p className={`${mono} text-[9.5px] mt-0.5`} style={{ color: 'rgba(133,183,235,0.40)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
