# APEX Pulse — AI FinOps Intelligence Layer

> Multi-provider AI cost observability, RBAC, spend forecasting, and alert delivery.
> Track spend, tokens, team attribution, and coding tool ROI across Anthropic, OpenAI, Google Gemini, Azure OpenAI, and AWS Bedrock — all in one place.

[![CI](https://github.com/your-org/apex-pulse/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/apex-pulse/actions/workflows/ci.yml)

---

## What's inside

| Page | Sprint | Description |
|------|--------|-------------|
| **Executive Overview** | S1 | MTD spend, 14-day trend, 5-provider mix, project attribution |
| **Providers** | S2 | Token billing (5 API providers) + seat billing (Copilot, Cursor, Windsurf) |
| **Teams & Attribution** | S3 | Per-team/user spend, provider mix per team, project drill-down |
| **Budget & Forecast** | S4 | Monthly budget utilisation, threshold state machine |
| **Coding Effectiveness** | S5 | 6 tools · acceptance rate · code quality · PR metrics · ROI |
| **API Playground** | S5 | Live Claude calls with real-time cost recording |
| **Optimization Insights** | S6 | Config-driven model routing, cache strategy, arbitrage |
| **RBAC & Policies** | S7 | 4 roles · 9 permissions · JWT auth · audit trail |
| **Alerts & Incidents** | S8 | Persisted alerts, auto-resolve, Slack + HTTP webhook delivery |
| **Integrations** | S7 | 5 API providers · seat tools · webhook config |
| **User Management** | S9 | Invite · role assignment · deactivate · audit trail |
| **Spend Forecast** | S10 | OLS regression · 60-day projection · budget runway |
| **Settings** | S6 | 17 live-editable runtime config keys |

---

## Quick Start

```bash
git clone https://github.com/your-org/apex-pulse
cd apex-pulse
npm install
cp .env.example .env.local
# edit .env.local — set NEXTAUTH_SECRET, NEXTAUTH_URL, ADMIN_EMAIL, ADMIN_PASSWORD
npm run db:setup   # creates DB + seeds demo data + creates 4 test users
npm run dev
```

See **[docs/SETUP.md](docs/SETUP.md)** for the complete setup guide including enterprise deployment.

---

## Test Users (seeded by `npm run db:setup`)

| Role | Email | Password |
|------|-------|----------|
| admin | admin@example.com | Admin@Pulse1 |
| finance | finance@example.com | Finance@Pulse1 |
| manager | manager@example.com | Manager@Pulse1 |
| viewer | viewer@example.com | Viewer@Pulse1 |

> Change these passwords before any internet-facing deployment.

---

## Authentication & RBAC

APEX Pulse uses **NextAuth v4** (JWT sessions) with two providers:

- **Email + password** — credentials validated against the database (bcrypt hash, cost 12)
- **GitHub OAuth** — optional; activate by setting `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET`
- **Env bootstrap** — `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars for first-run setup (no DB required)

When `NEXTAUTH_SECRET` is **not set**, the app runs in open mode (no login required). **Set this variable for any non-local deployment.**

See **[docs/SECURITY.md](docs/SECURITY.md)** for the full security model.

---

## Enterprise Deployment (Docker + PostgreSQL + Nginx)

```bash
cp .env.example .env
# Set NEXTAUTH_SECRET, NEXTAUTH_URL, POSTGRES_PASSWORD, ADMIN_PASSWORD

# Place TLS certs in nginx/ssl/fullchain.pem + nginx/ssl/privkey.pem
# Update nginx/nginx.conf — replace YOUR_DOMAIN

docker compose -f docker-compose.pg.yml up -d --build
```

The stack includes:
- **PostgreSQL 16** for persistent storage
- **Nginx** for TLS termination, HTTP→HTTPS redirect, security headers, rate limiting
- **APEX Pulse** app with health checks and rolling update strategy

See **[docs/SETUP.md](docs/SETUP.md)** for step-by-step enterprise setup.

---

## Recording Usage from Your Code

After any AI API call, POST to `/api/usage` (replace `YOUR_APEX_URL` with your deployed URL):

```typescript
// Anthropic
await fetch(`${YOUR_APEX_URL}/api/usage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider:         'anthropic',
    model:            response.model,
    inputTokens:      response.usage.input_tokens,
    outputTokens:     response.usage.output_tokens,
    cacheReadTokens:  response.usage.cache_read_input_tokens  ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
    userId: 'alice', teamId: 'platform', projectId: 'my-project',
  }),
})

// OpenAI
await fetch(`${YOUR_APEX_URL}/api/usage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider:     'openai',
    model:        response.model,
    inputTokens:  response.usage.prompt_tokens,
    outputTokens: response.usage.completion_tokens,
    userId: 'alice', teamId: 'platform', projectId: 'my-project',
  }),
})
```

See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for all 5 providers.

---

## Exporting Data

```bash
# JSON export (last 10k records)
curl -H "Cookie: ..." https://your-domain.com/api/export

# CSV export filtered by team and date range
curl -H "Cookie: ..." "https://your-domain.com/api/export?format=csv&team=platform&from=2026-01-01" -o usage.csv
```

Export requires `manager` role or above.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | SQLite path or PostgreSQL connection string |
| `NEXTAUTH_SECRET` | **Yes (prod)** | Random 32-char secret for JWT signing |
| `NEXTAUTH_URL` | **Yes (prod)** | Public URL (e.g. `https://apex.yourcompany.com`) |
| `NEXT_PUBLIC_AUTH_ENABLED` | Prod | Set to `1` when auth is enabled |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First run | Bootstrap admin credentials |
| `ANTHROPIC_API_KEY` | No | Enables Live Demo tab |
| `OPENAI_API_KEY` | No | Enables OpenAI ingestion |
| `GOOGLE_API_KEY` | No | Enables Gemini ingestion |
| `AZURE_OPENAI_API_KEY` | No | Enables Azure OpenAI ingestion |
| `AWS_ACCESS_KEY_ID` | No | Enables Bedrock ingestion |
| `SLACK_WEBHOOK_URL` | No | Budget threshold Slack alerts |
| `ALERT_WEBHOOK_URL` | No | Generic HTTP alert webhook |

Full list in [`.env.example`](.env.example).

---

## Database Commands

```bash
npm run db:setup    # fresh DB + seed (includes test users)
npm run db:reset    # wipe + reseed
npm run db:studio   # Prisma Studio GUI (check terminal for URL)
npm run db:migrate  # run pending migrations (production)
```

---

## Tech Stack

- **Next.js 15** App Router · TypeScript · Tailwind CSS
- **Prisma 5** ORM · SQLite (dev) / PostgreSQL (prod)
- **NextAuth v4** · JWT sessions · bcryptjs password hashing
- **Recharts** for charts · **@anthropic-ai/sdk** for Live Demo
- **Plus Jakarta Sans** + **JetBrains Mono** typography
- **Nginx** TLS termination (enterprise stack)

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/SETUP.md](docs/SETUP.md) | Complete setup and deployment guide |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, RBAC, TLS, secrets, audit trail |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Platform-specific deployment (Vercel, Railway, Render, k8s) |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Provider integration code examples |
| [docs/API.md](docs/API.md) | REST API reference |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Future sprint planning (S11–S20) |
