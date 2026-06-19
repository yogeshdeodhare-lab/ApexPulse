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
  ssoProvider: string | null
  mfaEnabled:  boolean
}

interface UsersSummary { total: number; active: number; admins: number; viewers: number }

interface UserSessionRow {
  id:         string
  userId:     string
  createdAt:  string
  lastSeenAt: string
  revokedAt:  string | null
  user:       { email: string; name: string | null; role: string }
}

interface GroupMapping {
  id:       string
  idpGroup: string
  role:     string
}

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

// ── Bulk invite modal (S13) ────────────────────────────────────────────────────

function BulkInviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [csv,     setCsv]     = useState('email,name,role\n')
  const [saving,  setSaving]  = useState(false)
  const [result,  setResult]  = useState<{ created: { email: string; tempPassword: string }[]; skipped: { email: string; reason: string }[] } | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  function parseCsv(text: string) {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
    const rows  = lines[0]?.toLowerCase().startsWith('email') ? lines.slice(1) : lines
    return rows.map(line => {
      const [email, name, role] = line.split(',').map(s => s.trim())
      return { email, name, role }
    }).filter(r => r.email)
  }

  async function submit() {
    setSaving(true); setError(null)
    const rows = parseCsv(csv)
    if (rows.length === 0) { setError('No valid rows found'); setSaving(false); return }
    const res = await fetch('/api/users/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
    })
    setSaving(false)
    if (res.ok) { setResult(await res.json()); onCreated() }
    else { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Bulk invite failed') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(4,23,47,0.80)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg mx-4 rounded-[16px] p-6" style={{ background: '#051f42', border: '1px solid rgba(133,183,235,0.15)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: '#EBF4FF' }}>Bulk Invite (CSV)</h3>
          <button onClick={onClose} style={{ color: 'rgba(133,183,235,0.45)', fontSize: 18 }}>✕</button>
        </div>

        {!result ? (
          <>
            <p className={`${mono} text-[9.5px] mb-2`} style={{ color: 'rgba(133,183,235,0.45)' }}>
              One row per line: <code style={{ color: 'rgba(133,183,235,0.65)' }}>email,name,role</code> — role defaults to viewer. Up to 500 rows.
            </p>
            <textarea
              value={csv} onChange={e => setCsv(e.target.value)} rows={8} spellCheck={false}
              className={`${mono} w-full text-[11px] p-3 rounded-[8px] outline-none`}
              style={{ background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF' }}
            />
            {error && (
              <div className={`${mono} text-[10px] px-3 py-2 rounded-[8px] mt-3`} style={{ background: 'rgba(226,75,74,0.10)', color: '#E24B4A' }}>{error}</div>
            )}
            <div className="flex gap-2 pt-4">
              <button onClick={submit} disabled={saving}
                className={`flex-1 ${mono} text-[11px] py-2 rounded-[9px] font-semibold transition-all`}
                style={{ background: 'rgba(55,138,221,0.20)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.25)' }}>
                {saving ? 'Importing…' : 'Import users'}
              </button>
              <button onClick={onClose} className={`${mono} text-[11px] px-4 py-2 rounded-[9px]`} style={{ color: 'rgba(133,183,235,0.45)', border: '1px solid rgba(133,183,235,0.12)' }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className={`${mono} text-[11px] px-3 py-2 rounded-[8px]`} style={{ background: 'rgba(34,160,107,0.10)', color: '#22A06B' }}>
              ✓ {result.created.length} created · {result.skipped.length} skipped
            </div>
            {result.created.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-[8px]" style={{ border: '1px solid rgba(133,183,235,0.12)' }}>
                <table className="w-full text-[10.5px]">
                  <thead><tr style={{ borderBottom: '1px solid rgba(133,183,235,0.10)' }}>
                    <th className={`${mono} text-left px-2 py-1.5`} style={{ color: 'rgba(133,183,235,0.45)' }}>Email</th>
                    <th className={`${mono} text-left px-2 py-1.5`} style={{ color: 'rgba(133,183,235,0.45)' }}>Temp password</th>
                  </tr></thead>
                  <tbody>
                    {result.created.map(c => (
                      <tr key={c.email} style={{ borderBottom: '1px solid rgba(133,183,235,0.05)' }}>
                        <td className="px-2 py-1.5" style={{ color: '#EBF4FF' }}>{c.email}</td>
                        <td className={`${mono} px-2 py-1.5`} style={{ color: '#85B7EB' }}>{c.tempPassword}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.35)' }}>
              Copy these passwords now — they are shown only once. No email provider is configured.
            </p>
            <button onClick={onClose} className={`${mono} text-[11px] w-full py-2 rounded-[9px] font-semibold`} style={{ background: '#185FA5', color: '#EBF4FF' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Active sessions panel (S13) ────────────────────────────────────────────────

function SessionsPanel() {
  const [sessions, setSessions] = useState<UserSessionRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/users/sessions').then(r => r.json()).then(d => { if (Array.isArray(d)) setSessions(d) }).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function revoke(id: string) {
    setRevoking(id)
    await fetch('/api/users/sessions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setRevoking(null)
    load()
  }

  return (
    <Panel title="Active Sessions" badge={`${sessions.length} ACTIVE`} sub="Enforced on every request — force-expire to sign a device out immediately">
      {loading ? (
        <p className={`${mono} text-[10.5px] py-4`} style={{ color: 'rgba(133,183,235,0.40)' }}>Loading…</p>
      ) : sessions.length === 0 ? (
        <p className={`${mono} text-[10.5px] py-4`} style={{ color: 'rgba(133,183,235,0.40)' }}>No tracked sessions yet — logins via env-admin bootstrap are not tracked.</p>
      ) : (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                {['User', 'Role', 'Started', 'Last seen', ''].map(h => (
                  <th key={h} className={`${mono} text-[9px] tracking-[.07em] uppercase text-left py-2 px-2`} style={{ color: 'rgba(133,183,235,0.40)', borderBottom: '1px solid rgba(133,183,235,0.10)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(133,183,235,0.06)' }}>
                  <td className="py-2 px-2">
                    <div style={{ color: '#EBF4FF' }}>{s.user.name ?? s.user.email}</div>
                    <div className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.45)' }}>{s.user.email}</div>
                  </td>
                  <td className="px-2"><RoleBadge role={s.user.role} /></td>
                  <td className={`${mono} text-[10px] px-2`} style={{ color: 'rgba(133,183,235,0.40)' }}>{ago(s.createdAt)}</td>
                  <td className={`${mono} text-[10px] px-2`} style={{ color: 'rgba(133,183,235,0.40)' }}>{ago(s.lastSeenAt)}</td>
                  <td className="px-2">
                    <button onClick={() => revoke(s.id)} disabled={revoking === s.id}
                      className={`${mono} text-[9px] px-2 py-1 rounded-[6px]`}
                      style={{ background: 'rgba(226,75,74,0.10)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.20)' }}>
                      {revoking === s.id ? '…' : 'Force-expire'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

// ── IdP group → role mapping panel (S13) ───────────────────────────────────────

function GroupMappingsPanel() {
  const [mappings, setMappings] = useState<GroupMapping[]>([])
  const [idpGroup, setIdpGroup] = useState('')
  const [role,     setRole]     = useState('viewer')
  const [saving,   setSaving]   = useState(false)

  function load() {
    fetch('/api/group-mappings').then(r => r.json()).then(d => { if (Array.isArray(d)) setMappings(d) })
  }
  useEffect(load, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!idpGroup.trim()) return
    setSaving(true)
    await fetch('/api/group-mappings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idpGroup: idpGroup.trim(), role }),
    })
    setSaving(false); setIdpGroup(''); load()
  }

  async function remove(id: string) {
    await fetch(`/api/group-mappings?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <Panel title="SSO Group → Role Mapping" sub="IdP groups (Okta / Azure AD) are mapped to APEX Pulse roles on every SSO sign-in and SCIM push">
      <form onSubmit={add} className="flex gap-2 mt-2 mb-3">
        <input value={idpGroup} onChange={e => setIdpGroup(e.target.value)} placeholder="e.g. finops-admins"
          className={`${mono} flex-1 text-[11px] px-3 py-1.5 rounded-[7px] outline-none`}
          style={{ background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF' }} />
        <select value={role} onChange={e => setRole(e.target.value)}
          className={`${mono} text-[11px] px-2 py-1.5 rounded-[7px] outline-none`}
          style={{ background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF' }}>
          {['viewer', 'manager', 'finance', 'admin'].map(r => <option key={r} value={r}>{ROLE_META[r]?.label ?? r}</option>)}
        </select>
        <button type="submit" disabled={saving}
          className={`${mono} text-[10.5px] px-3 py-1.5 rounded-[7px] font-semibold`}
          style={{ background: 'rgba(55,138,221,0.20)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.25)' }}>
          + Add
        </button>
      </form>
      {mappings.length === 0 ? (
        <p className={`${mono} text-[10.5px] py-2`} style={{ color: 'rgba(133,183,235,0.40)' }}>No mappings yet — unmapped SSO/SCIM users default to viewer.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {mappings.map(m => (
            <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(133,183,235,0.06)', border: '1px solid rgba(133,183,235,0.12)' }}>
              <span className={`${mono} text-[10.5px]`} style={{ color: '#EBF4FF' }}>{m.idpGroup}</span>
              <span className="text-[10px]" style={{ color: 'rgba(133,183,235,0.35)' }}>→</span>
              <RoleBadge role={m.role} />
              <button onClick={() => remove(m.id)} className="text-[11px] opacity-40 hover:opacity-80" style={{ color: '#E24B4A' }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users,    setUsers]    = useState<AppUser[]>([])
  const [summary,  setSummary]  = useState<UsersSummary | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [showModal,setShowModal]= useState(false)
  const [showBulk, setShowBulk] = useState(false)
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
      {showBulk && <BulkInviteModal onClose={() => setShowBulk(false)} onCreated={load} />}

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
        <div className="flex justify-end gap-2 mt-2 mb-3">
          <button
            onClick={() => setShowBulk(true)}
            className={`${mono} text-[10px] px-3 py-1.5 rounded-[8px] font-semibold transition-all`}
            style={{ background: 'rgba(55,138,221,0.08)', color: 'rgba(133,183,235,0.70)', border: '1px solid rgba(133,183,235,0.16)' }}
          >
            Bulk Invite (CSV)
          </button>
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
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium" style={{ color: '#EBF4FF' }}>{u.name ?? '—'}</span>
                      {u.ssoProvider && (
                        <span className={`${mono} text-[8px] px-1.5 py-0.5 rounded`} style={{ background: 'rgba(55,138,221,0.12)', color: '#85B7EB' }}>{u.ssoProvider}</span>
                      )}
                      {u.mfaEnabled && (
                        <span className={`${mono} text-[8px] px-1.5 py-0.5 rounded`} style={{ background: 'rgba(34,160,107,0.12)', color: '#22A06B' }}>🔒 MFA</span>
                      )}
                    </div>
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

      {/* S13 — SSO / SCIM */}
      <GroupMappingsPanel />
      <SessionsPanel />

      {/* How-to */}
      <Panel title="Access Management" sub="Role changes take effect on next API call — no re-login needed">
        <div className="grid md:grid-cols-2 gap-2 mt-2">
          {[
            { icon: '◉', title: 'Role assignment',     desc: 'Change roles inline — enforced within one request via live session lookup, no re-login needed' },
            { icon: '⟳', title: 'Password reset',      desc: 'User self-service via "Forgot password?" on the login page, or My Account once signed in' },
            { icon: '◫', title: 'Deactivate (not delete)', desc: 'Inactive users are blocked at auth within one request — history and attribution data preserved' },
            { icon: '◈', title: 'Audit trail',          desc: 'All user create/update events logged to AuditLog — view via GET /api/audit' },
            { icon: '⊘', title: 'SCIM provisioning',    desc: 'Okta/Azure AD push users to POST /api/scim/v2/Users with a Bearer token (SCIM_BEARER_TOKEN)' },
            { icon: '◇', title: 'Session control',      desc: 'Force-expire a device below — takes effect on its very next request, not just at JWT expiry' },
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
