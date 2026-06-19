import { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GithubProvider from 'next-auth/providers/github'
import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { compare } from 'bcryptjs'

declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string; name?: string | null; role: string }
  }
  interface User {
    id: string; email: string; name?: string | null; role: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string; role: string
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
    // ── Credentials: env-based admin (initial setup / fallback) ─────────────
    CredentialsProvider({
      id:   'credentials',
      name: 'Email & password',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null

        // 1. Env-based bootstrap admin (no DB required for first run)
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

        await prisma.user.update({
          where: { id: user.id },
          data:  { lastLoginAt: new Date() },
        })
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
              role:  'viewer', // GitHub users default to viewer; promote in admin UI
            }
          },
        })]
      : []),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id   = token.id
      session.user.role = token.role
      return session
    },
    async signIn({ user }) {
      void logAudit({
        action:    'LOGIN',
        resource:  'auth',
        userId:    user.id,
        userEmail: user.email ?? undefined,
        after:     { role: user.role },
      })
      return true
    },
  },
}
