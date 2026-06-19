'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { mono } from '@/components/ui'

// ── Inner form — uses useSearchParams, must be inside <Suspense> ─────────────

function LoginForm() {
  const params      = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [showHint, setShowHint] = useState(false)

  const githubEnabled = process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED === '1'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', { email, password, callbackUrl, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError('Invalid email or password.')
    } else if (res?.ok) {
      window.location.href = callbackUrl
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: 'radial-gradient(ellipse 90% 65% at 50% -5%, rgba(24,95,165,0.30) 0%, #071E3D 55%, #040F20 100%)',
      }}
    >
      {/* Background grid lines — decorative */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(55,138,221,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(55,138,221,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-5"
            style={{
              background: 'linear-gradient(135deg, #185FA5 0%, #1A6DC0 100%)',
              boxShadow: '0 0 0 1px rgba(55,138,221,0.30), 0 8px 32px rgba(24,95,165,0.50)',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
              <polyline
                points="6,34 14,34 19,20 25,42 31,24 36,32 41,32 50,32"
                stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                className="animate-ecg"
              />
              <circle cx="31" cy="24" r="3" fill="#85B7EB" />
            </svg>
          </div>
          <h1
            className="text-[24px] font-extrabold tracking-tight"
            style={{ color: '#EBF4FF', letterSpacing: '-0.03em' }}
          >
            APEX Pulse
          </h1>
          <p className={`${mono} text-[10px] mt-1 tracking-[0.14em] uppercase`} style={{ color: 'rgba(133,183,235,0.45)' }}>
            AI FinOps Intelligence Layer
          </p>
        </div>

        {/* Sign-in card */}
        <div
          className="rounded-[20px] p-7"
          style={{
            background: 'rgba(10,34,62,0.90)',
            border: '1px solid rgba(133,183,235,0.16)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.40), 0 0 0 1px rgba(55,138,221,0.08)',
          }}
        >
          <h2 className="text-[17px] font-bold mb-1" style={{ color: '#EBF4FF', letterSpacing: '-0.02em' }}>
            Sign in
          </h2>
          <p className={`${mono} text-[10.5px] mb-6`} style={{ color: 'rgba(133,183,235,0.45)' }}>
            Use your organization credentials
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label
                className={`${mono} text-[9.5px] tracking-[0.10em] uppercase block mb-1.5`}
                style={{ color: 'rgba(133,183,235,0.50)' }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                className={`${mono} w-full px-3.5 py-2.5 rounded-[11px] text-[12.5px] outline-none transition-all duration-150`}
                style={{
                  background: 'rgba(55,138,221,0.06)',
                  border: '1px solid rgba(133,183,235,0.18)',
                  color: '#EBF4FF',
                }}
                onFocus={e  => (e.target.style.borderColor = 'rgba(55,138,221,0.55)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(133,183,235,0.18)')}
              />
            </div>

            {/* Password */}
            <div>
              <label
                className={`${mono} text-[9.5px] tracking-[0.10em] uppercase block mb-1.5`}
                style={{ color: 'rgba(133,183,235,0.50)' }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={`${mono} w-full px-3.5 py-2.5 rounded-[11px] text-[12.5px] outline-none transition-all duration-150`}
                style={{
                  background: 'rgba(55,138,221,0.06)',
                  border: '1px solid rgba(133,183,235,0.18)',
                  color: '#EBF4FF',
                }}
                onFocus={e  => (e.target.style.borderColor = 'rgba(55,138,221,0.55)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(133,183,235,0.18)')}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                className={`${mono} text-[11px] px-3.5 py-2.5 rounded-[10px] flex items-center gap-2`}
                style={{ background: 'rgba(226,75,74,0.08)', color: '#E24B4A', border: '1px solid rgba(226,75,74,0.22)' }}
              >
                <span>✕</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-[11px] text-[13.5px] font-semibold transition-all duration-150"
              style={{
                background: loading
                  ? 'rgba(55,138,221,0.25)'
                  : 'linear-gradient(135deg, #185FA5 0%, #1E73CC 100%)',
                color: loading ? 'rgba(235,244,255,0.45)' : '#EBF4FF',
                border: '1px solid rgba(55,138,221,0.35)',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(24,95,165,0.35)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          {/* GitHub OAuth */}
          {githubEnabled && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'rgba(133,183,235,0.10)' }} />
                <span className={`${mono} text-[9px]`} style={{ color: 'rgba(133,183,235,0.30)' }}>or</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(133,183,235,0.10)' }} />
              </div>
              <button
                onClick={() => signIn('github', { callbackUrl })}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[11px] text-[12.5px] font-medium transition-all duration-150"
                style={{
                  background: 'rgba(133,183,235,0.05)',
                  border: '1px solid rgba(133,183,235,0.15)',
                  color: '#85B7EB',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                Continue with GitHub
              </button>
            </>
          )}

          {/* Test credentials hint (dev convenience) */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowHint(v => !v)}
              className={`${mono} text-[9.5px] w-full text-center`}
              style={{ color: 'rgba(133,183,235,0.30)' }}
            >
              {showHint ? '▲ hide' : '▼ show'} test credentials
            </button>
            {showHint && (
              <div
                className={`${mono} text-[9px] mt-2 p-3 rounded-[10px] leading-[1.8]`}
                style={{ background: 'rgba(55,138,221,0.05)', border: '1px solid rgba(55,138,221,0.12)', color: 'rgba(133,183,235,0.55)' }}
              >
                <div style={{ color: 'rgba(133,183,235,0.35)', marginBottom: 4 }}>ROLE — EMAIL — PASSWORD</div>
                <div><span style={{ color: '#E24B4A' }}>admin</span> · admin@example.com · Admin@Pulse1</div>
                <div><span style={{ color: '#C98A20' }}>finance</span> · finance@example.com · Finance@Pulse1</div>
                <div><span style={{ color: '#22A06B' }}>manager</span> · manager@example.com · Manager@Pulse1</div>
                <div><span style={{ color: '#85B7EB' }}>viewer</span> · viewer@example.com · Viewer@Pulse1</div>
                <div className="mt-2" style={{ color: 'rgba(133,183,235,0.28)', fontSize: 8.5 }}>
                  Run <code>npm run db:setup</code> to seed these users.
                </div>
              </div>
            )}
          </div>
        </div>

        <p className={`${mono} text-center text-[9px] mt-5`} style={{ color: 'rgba(133,183,235,0.20)' }}>
          APEX Pulse · Enterprise · v10.0.0 · All access is logged
        </p>
      </div>
    </div>
  )
}

// ── Page export — Suspense boundary required for useSearchParams ──────────────

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#071E3D' }}>
          <div className="w-8 h-8 rounded-lg animate-glow" style={{ background: '#185FA5' }} />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
