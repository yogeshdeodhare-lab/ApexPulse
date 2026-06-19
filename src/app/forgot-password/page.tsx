'use client'

import { useState } from 'react'
import Link from 'next/link'
import { mono } from '@/components/ui'

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [devUrl,  setDevUrl]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/auth/reset-password/request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    })
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    setSent(true)
    setDevUrl(d.devResetUrl ?? null)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: 'radial-gradient(ellipse 90% 65% at 50% -5%, rgba(24,95,165,0.30) 0%, #071E3D 55%, #040F20 100%)' }}
    >
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: '#EBF4FF', letterSpacing: '-0.03em' }}>
            Reset your password
          </h1>
          <p className={`${mono} text-[10px] mt-1`} style={{ color: 'rgba(133,183,235,0.45)' }}>
            APEX Pulse — AI FinOps Intelligence Layer
          </p>
        </div>

        <div
          className="rounded-[20px] p-7"
          style={{
            background: 'rgba(10,34,62,0.90)', border: '1px solid rgba(133,183,235,0.16)',
            backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
          }}
        >
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={`${mono} text-[9.5px] tracking-[0.10em] uppercase block mb-1.5`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                  Email address
                </label>
                <input
                  type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={`${mono} w-full px-3.5 py-2.5 rounded-[11px] text-[12.5px] outline-none`}
                  style={{ background: 'rgba(55,138,221,0.06)', border: '1px solid rgba(133,183,235,0.18)', color: '#EBF4FF' }}
                />
              </div>
              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 rounded-[11px] text-[13.5px] font-semibold"
                style={{
                  background: loading ? 'rgba(55,138,221,0.25)' : 'linear-gradient(135deg, #185FA5 0%, #1E73CC 100%)',
                  color: '#EBF4FF', border: '1px solid rgba(55,138,221,0.35)',
                }}
              >
                {loading ? 'Sending…' : 'Send reset link →'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <div
                className={`${mono} text-[11px] px-3.5 py-3 rounded-[10px]`}
                style={{ background: 'rgba(34,160,107,0.10)', color: '#22A06B', border: '1px solid rgba(34,160,107,0.22)' }}
              >
                ✓ If that email exists, a reset link has been sent. It expires in 30 minutes.
              </div>
              {devUrl && (
                <div
                  className={`${mono} text-[9.5px] px-3.5 py-3 rounded-[10px] break-all`}
                  style={{ background: 'rgba(55,138,221,0.08)', color: 'rgba(133,183,235,0.65)', border: '1px solid rgba(133,183,235,0.16)' }}
                >
                  <div className="mb-1.5" style={{ color: 'rgba(133,183,235,0.40)' }}>DEV MODE — no email provider configured, link shown here:</div>
                  <Link href={devUrl} style={{ color: '#85B7EB' }}>{devUrl}</Link>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 text-center">
            <Link href="/login" className={`${mono} text-[10.5px]`} style={{ color: 'rgba(133,183,235,0.50)' }}>
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
