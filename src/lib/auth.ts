import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GithubProvider from 'next-auth/providers/github'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { getConfigBool } from '@/lib/config'
import { decrypt } from '@/lib/vault'
import { verifyTotp } from '@/lib/totp'
import { resolveRoleFromGroups } from '@/lib/group-mapping'
import { compare } from 'bcryptjs'

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string; name?: string | null; role: string }
  }
  interface User {
    id: string; email: string; name?: string | null; role: string; groups?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string; role: string; sid?: string
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },

  pages: {
    signIn:  '/login',
    error:   '/login',
  },

  providers: [
    // ── Credentials: env-based admin + DB users (with optional TOTP MFA) ────
    CredentialsProvider({
      id:   'credentials',
      name: 'Email & password',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
        code:     { label: 'Authenticator code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null

        // 1. Env-based bootstrap admin (no DB required for first run) — MFA not applicable
        const adminEmail = process.env.ADMIN_EMAIL
        const adminPass  = process.env.ADMIN_PASSWORD
        if (adminEmail && adminPass &&
            credentials.email === adminEmail &&
            credentials.password === adminPass) {
          return { id: 'env-admin', email: adminEmail, name: 'Admin', role: 'admin' }
        }

        // 2. DB users
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user?.active || !user.passwordHash) return null

        const valid = await compare(credentials.password, user.passwordHash)
        if (!valid) return null

        // 3. MFA gate — required if the user enrolled, or the tenant enforces it for everyone
        const tenantRequiresMfa = await getConfigBool('auth.mfa_required')
        if (user.mfaEnabled || tenantRequiresMfa) {
          if (!user.mfaSecret) throw new Error('MFA_SETUP_REQUIRED')
          if (!credentials.code) throw new Error('MFA_REQUIRED')
          const secret = decrypt(user.mfaSecret)
          if (!verifyTotp(secret, credentials.code)) throw new Error('MFA_REQUIRED')
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role }
      },
    }),

    // ── GitHub OAuth (optional — only active when env vars are set) ──────────
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [GithubProvider({
          clientId:     process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          profile(profile) {
            return {
              id:    String(profile.id),
              email: profile.email ?? `${profile.login}@github`,
              name:  profile.name ?? profile.login,
              role:  'viewer', // resolved against the DB / group mapping in the signIn callback
            }
          },
        })]
      : []),

    // ── Generic OIDC (Okta / Azure AD / Google Workspace / any SAML-bridge IdP) ─
    // Activated when OIDC_ISSUER + OIDC_CLIENT_ID + OIDC_CLIENT_SECRET are set.
    // Uses OIDC discovery (`${issuer}/.well-known/openid-configuration`).
    ...(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET
      ? [{
          id:           'oidc',
          name:         process.env.OIDC_PROVIDER_NAME || 'SSO',
          type:         'oauth' as const,
          wellKnown:    `${process.env.OIDC_ISSUER}/.well-known/openid-configuration`,
          authorization: { params: { scope: 'openid email profile' } },
          idToken:      true,
          checks:       ['pkce', 'state'] as ('pkce' | 'state')[],
          clientId:     process.env.OIDC_CLIENT_ID,
          clientSecret: process.env.OIDC_CLIENT_SECRET,
          profile(profile: Record<string, unknown>) {
            const groups = Array.isArray(profile.groups)
              ? profile.groups as string[]
              : Array.isArray(profile.roles) ? profile.roles as string[] : []
            return {
              id:     String(profile.sub),
              email:  String(profile.email ?? ''),
              name:   String(profile.name ?? profile.email ?? ''),
              role:   'viewer', // resolved against the DB / group mapping in the signIn callback
              groups,
            }
          },
        }]
      : []),
  ],

  callbacks: {
    // Persist every provider's identity into the DB User table, so SCIM,
    // group-role mapping, and session tracking have a real row to attach to.
    async signIn({ user, account }) {
      if (account?.provider !== 'credentials') {
        const email = user.email
        if (!email) return false

        const roleFromGroups = await resolveRoleFromGroups(user.groups)
        const existing = await prisma.user.findUnique({ where: { email } })

        const dbUser = await prisma.user.upsert({
          where:  { email },
          update: {
            name:        user.name ?? existing?.name,
            ssoProvider: account?.provider,
            externalId:  user.id,
            ...(roleFromGroups && { role: roleFromGroups }),
          },
          create: {
            email, name: user.name ?? null,
            role: roleFromGroups ?? 'viewer',
            ssoProvider: account?.provider, externalId: user.id,
          },
        })

        if (!dbUser.active) return false // deprovisioned (e.g. via SCIM) — block sign-in

        user.id   = dbUser.id
        user.role = dbUser.role
      }

      void logAudit({
        action: 'LOGIN', resource: 'auth',
        userId: user.id, userEmail: user.email ?? undefined,
        after:  { role: user.role, provider: account?.provider },
      })
      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role

        // Track this login as a revocable session (skipped for the env-admin bootstrap account)
        if (user.id !== 'env-admin') {
          const sid = randomUUID()
          try {
            await prisma.userSession.create({ data: { id: sid, userId: user.id } })
            token.sid = sid
          } catch {
            // best-effort — login still succeeds without session tracking
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.id   = token.id
      session.user.role = token.role
      return session
    },
  },
}
