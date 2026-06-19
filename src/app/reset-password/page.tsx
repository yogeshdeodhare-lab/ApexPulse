'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { mono } from '@/components/ui'

function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? ''

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [done,      setDone]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (!token) { setError('Missing or invalid reset link'); return }

    setLoading(true)
    const res = await fetch('/api/auth/reset-password/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password }),
    })
    setLoading(false)
    if (res.ok) { setDone(true); return }
    const d = await res.json().catch(() => ({}))
    setError(d.error ?? 'Reset failed')
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'radial-gradient(ellipse 90% 65% at 50% -5%, rgba(24,95,165,0.30) 0%, #071E3D 55%, #040F20 100%)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: '#EBF4FF', letterSpacing: '-0.03em' }}>
            Set a new password
          </h1>
        </div>

        <div
          className="rounded-[20px] p-7"
          style={{
            background: 'rgba(10,34,62,0.90)', border: '1px solid rgba(133,183,235,0.16)',
            backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
          }}
        >
          {done ? (
            <div className="space-y-4 text-center">
              <div
                className={`${mono} text-[11px] px-3.5 py-3 rounded-[10px]`}
                style={{ background: 'rgba(34,160,107,0.10)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.22)' }}
              >
                ✓ Password updated. All existing sessions were signed out — please sign in again.
              </div>
              <Link href="/login" className={`${mono} text-[11px] inline-block`} style={{ color: '#85B7EB' }}>
                Go to sign in →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!token && (
                <div className={`${mono} text-[10.5px] px-3 py-2.5 rounded-[8px]`} style={{ background: 'rgba(226,75,74,0.08)', color: '#E24B4A' }}>
                  This link is missing its token — request a new one from the sign-in page.
                </div>
              )}
              <div>
                <label className={`${mono} text-[9.5px] tracking-[0.10em] uppercase block mb-1.5`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                  New password
                </label>
                <input
                  type="password" required minLength={8} autoFocus value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`${mono} w-full px-3.5 py-2.5 rounded-[11px] text-[12.5px] outline-none`}
                  style={{ background: 'rgba(55,138,221,0.06)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF' }}
                />
              </div>
              <div>
                <label className={`${mono} text-[9.5px] tracking-[0.10em] uppercase block mb-1.5`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                  Confirm password
                </label>
                <input
                  type="password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className={`${mono} w-full px-3.5 py-2.5 rounded-[11px] text-[12.5px] outline-none`}
                  style={{ background: 'rgba(55,138,221,0.06)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF' }}
                />
              </div>
              {error && (
                <div className={`${mono} text-[11px] px-3.5 py-2.5 rounded-[10px]`} style={{ background: 'rgba(226,75,74,0.08)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.22)' }}>
                  ✕ {error}
                </div>
              )}
              <button
                type="submit" disabled={loading || !token}
                className="w-full py-2.5 rounded-[11px] text-[13.5px] font-semibold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #185FA5 0%, #1E73CC 100%)', color: '#EBF4FF', border: '1px solid rgba(55,138,221,0.35)' }}
              >
                {loading ? 'Updating…' : 'Update password →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#071E3D' }}>
        <div className="w-8 h-8 rounded-lg animate-glow" style={{ background: '#185FA5' }} />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
