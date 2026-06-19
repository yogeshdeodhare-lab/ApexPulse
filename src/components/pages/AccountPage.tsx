'use client'

import { useEffect, useState } from 'react'
import { Panel, mono } from '@/components/ui'

interface Profile { email: string; name: string | null; role: string; mfaEnabled: boolean; ssoProvider: string | null; hasPassword?: boolean; isEnvAdmin: boolean }

// ── Change password ───────────────────────────────────────────────────────────

function PasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirm,         setConfirm]         = useState('')
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (newPassword !== confirm) { setMsg({ ok: false, text: 'New passwords do not match' }); return }
    setSaving(true)
    const res = await fetch('/api/account/password', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    setSaving(false)
    if (res.ok) {
      setMsg({ ok: true, text: 'Password updated.' })
      setCurrentPassword(''); setNewPassword(''); setConfirm('')
    } else {
      const d = await res.json().catch(() => ({}))
      setMsg({ ok: false, text: d.error ?? 'Update failed' })
    }
  }

  const inputStyle = {
    background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.18)',
    borderRadius: 8, color: '#EBF4FF', padding: '7px 10px', fontSize: 12, width: '100%', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <Panel title="Change Password" sub="Self-service — requires your current password">
      <form onSubmit={submit} className="space-y-3 mt-2 max-w-sm">
        <div>
          <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>CURRENT PASSWORD</label>
          <input type="password" required style={inputStyle} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>NEW PASSWORD</label>
          <input type="password" required minLength={8} style={inputStyle} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>CONFIRM NEW PASSWORD</label>
          <input type="password" required minLength={8} style={inputStyle} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        {msg && (
          <div className={`${mono} text-[10.5px] px-3 py-2 rounded-[8px]`}
            style={{ background: msg.ok ? 'rgba(34,160,107,0.10)' : 'rgba(226,75,74,0.10)', color: msg.ok ? '#22A06B' : '#E24B4A' }}>
            {msg.text}
          </div>
        )}
        <button type="submit" disabled={saving}
          className={`${mono} text-[11px] px-4 py-2 rounded-[9px] font-semibold transition-all`}
          style={{ background: 'rgba(55,138,221,0.20)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.25)' }}>
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Panel>
  )
}

// ── MFA enrollment ─────────────────────────────────────────────────────────────

function MfaPanel({ initialEnabled }: { initialEnabled: boolean }) {
  const [enrolling, setEnrolling] = useState(false)
  const [secret,    setSecret]    = useState<string | null>(null)
  const [otpUrl,    setOtpUrl]    = useState<string | null>(null)
  const [code,      setCode]      = useState('')
  const [enabled,   setEnabled]   = useState(initialEnabled)
  const [busy,      setBusy]      = useState(false)
  const [msg,       setMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  async function startEnroll() {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/account/mfa/setup', { method: 'POST' })
    const d = await res.json()
    setBusy(false)
    if (res.ok) { setSecret(d.secret); setOtpUrl(d.otpauthUrl); setEnrolling(true) }
    else setMsg({ ok: false, text: d.error ?? 'Setup failed' })
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const res = await fetch('/api/account/mfa/verify', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    })
    const d = await res.json()
    setBusy(false)
    if (res.ok) {
      setEnabled(true); setEnrolling(false); setSecret(null); setOtpUrl(null); setCode('')
      setMsg({ ok: true, text: 'MFA enabled. You will be asked for a code on every future sign-in.' })
    } else setMsg({ ok: false, text: d.error ?? 'Invalid code' })
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const res = await fetch('/api/account/mfa/disable', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    })
    const d = await res.json()
    setBusy(false)
    if (res.ok) { setEnabled(false); setCode(''); setMsg({ ok: true, text: 'MFA disabled.' }) }
    else setMsg({ ok: false, text: d.error ?? 'Invalid code' })
  }

  const inputStyle = {
    background: 'rgba(55,138,221,0.07)', border: '1px solid rgba(133,183,235,0.18)',
    borderRadius: 8, color: '#EBF4FF', padding: '7px 10px', fontSize: 13, outline: 'none', fontFamily: 'inherit', letterSpacing: '0.3em',
  }

  return (
    <Panel title="Two-Factor Authentication (TOTP)" sub="Time-based one-time codes — compatible with Google Authenticator, 1Password, Authy">
      <div className="mt-2 max-w-sm space-y-3">
        {!enrolling && !enabled && (
          <button onClick={startEnroll} disabled={busy}
            className={`${mono} text-[11px] px-4 py-2 rounded-[9px] font-semibold transition-all`}
            style={{ background: 'rgba(55,138,221,0.20)', color: '#85B7EB', border: '1px solid rgba(133,183,235,0.25)' }}>
            {busy ? 'Starting…' : 'Set up MFA'}
          </button>
        )}

        {enrolling && secret && (
          <form onSubmit={confirmEnroll} className="space-y-3">
            <div className={`${mono} text-[9.5px] px-3 py-2.5 rounded-[8px]`} style={{ background: 'rgba(55,138,221,0.07)', color: 'rgba(133,183,235,0.55)', border: '1px solid rgba(133,183,235,0.15)' }}>
              No QR scan available — enter this key manually in your authenticator app:
              <div className="mt-1.5 text-[12px] font-bold break-all" style={{ color: '#85B7EB', letterSpacing: '0.1em' }}>{secret}</div>
              {otpUrl && <div className="mt-1.5 break-all opacity-60">{otpUrl}</div>}
            </div>
            <div>
              <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>ENTER THE 6-DIGIT CODE TO CONFIRM</label>
              <input type="text" inputMode="numeric" maxLength={6} required style={inputStyle} value={code} onChange={e => setCode(e.target.value)} placeholder="123456" />
            </div>
            <button type="submit" disabled={busy}
              className={`${mono} text-[11px] px-4 py-2 rounded-[9px] font-semibold transition-all`}
              style={{ background: '#185FA5', color: '#EBF4FF', border: '1px solid rgba(133,183,235,0.2)' }}>
              {busy ? 'Verifying…' : 'Confirm & enable'}
            </button>
          </form>
        )}

        {enabled && (
          <form onSubmit={disable} className="space-y-3">
            <div className={`${mono} text-[10.5px] px-3 py-2 rounded-[8px]`} style={{ background: 'rgba(34,160,107,0.10)', color: '#22A06B' }}>
              ✓ MFA is enabled on this account.
            </div>
            <div>
              <label className={`${mono} text-[9px] block mb-1`} style={{ color: 'rgba(133,183,235,0.50)' }}>ENTER CURRENT CODE TO DISABLE</label>
              <input type="text" inputMode="numeric" maxLength={6} required style={inputStyle} value={code} onChange={e => setCode(e.target.value)} placeholder="123456" />
            </div>
            <button type="submit" disabled={busy}
              className={`${mono} text-[11px] px-4 py-2 rounded-[9px] font-semibold transition-all`}
              style={{ background: 'rgba(226,75,74,0.12)', color: '#F28B82', border: '1px solid rgba(226,75,74,0.22)' }}>
              {busy ? 'Disabling…' : 'Disable MFA'}
            </button>
          </form>
        )}

        {msg && (
          <div className={`${mono} text-[10.5px] px-3 py-2 rounded-[8px]`}
            style={{ background: msg.ok ? 'rgba(34,160,107,0.10)' : 'rgba(226,75,74,0.10)', color: msg.ok ? '#22A06B' : '#E24B4A' }}>
            {msg.text}
          </div>
        )}
      </div>
    </Panel>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    fetch('/api/account').then(r => r.json()).then(d => { if (!d.error) setProfile(d) }).catch(() => {})
  }, [])

  if (!profile) {
    return <div className={`${mono} text-[11px] py-12 text-center`} style={{ color: 'rgba(133,183,235,0.40)' }}>Loading account…</div>
  }

  return (
    <div className="space-y-4 animate-slideUp">
      {profile.isEnvAdmin && (
        <div className={`${mono} text-[10.5px] px-3.5 py-3 rounded-[10px]`} style={{ background: 'rgba(55,138,221,0.08)', color: 'rgba(133,183,235,0.60)', border: '1px solid rgba(133,183,235,0.16)' }}>
          You are signed in as the bootstrap admin account (env-based). Password change and MFA require a DB-backed admin user.
        </div>
      )}
      {!profile.isEnvAdmin && profile.hasPassword && <PasswordPanel />}
      {!profile.isEnvAdmin && !profile.hasPassword && (
        <div className={`${mono} text-[10.5px] px-3.5 py-3 rounded-[10px]`} style={{ background: 'rgba(55,138,221,0.08)', color: 'rgba(133,183,235,0.60)', border: '1px solid rgba(133,183,235,0.16)' }}>
          This account signs in via {profile.ssoProvider ?? 'SSO'} — no local password to change.
        </div>
      )}
      {!profile.isEnvAdmin && <MfaPanel initialEnabled={profile.mfaEnabled} />}
    </div>
  )
}
