# APEX Pulse — Setup Guide

> Complete setup instructions for development, staging, and enterprise production deployments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (Development)](#quick-start-development)
3. [Test Credentials](#test-credentials)
4. [Authentication Setup](#authentication-setup)
5. [Enterprise Deployment (Docker + PostgreSQL + Nginx)](#enterprise-deployment)
6. [Environment Variables Reference](#environment-variables-reference)
7. [First Login & Initial Configuration](#first-login--initial-configuration)
8. [Connecting Integrations](#connecting-integrations)
9. [Health Checks](#health-checks)

---

## Prerequisites

| Dependency | Minimum | Notes |
|------------|---------|-------|
| Node.js | 20 LTS | [nodejs.org](https://nodejs.org) |
| npm | 10+ | Bundled with Node 20 |
| Docker | 24+ | For containerised deployment |
| PostgreSQL | 14+ | Production only (SQLite used in dev) |
| OpenSSL | any | For generating secrets |

---

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/apex-pulse
cd apex-pulse

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local — at minimum set:
#   NEXTAUTH_SECRET  (openssl rand -base64 32)
#   NEXTAUTH_URL     (https://your-domain.com or use env default for dev)
#   ADMIN_EMAIL / ADMIN_PASSWORD  (bootstrap admin credentials)

# 4. Set up database and seed demo data (includes test users)
npm run db:setup

# 5. Start the development server
npm run dev
```

The app is available at the URL printed by `npm run dev`.

---

## Test Credentials

The seed script (`npm run db:setup`) creates four test accounts, one per RBAC role:

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| **admin** | admin@example.com | Admin@Pulse1 | All 9 permissions · user management · config write |
| **finance** | finance@example.com | Finance@Pulse1 | Budget write · audit read · all read permissions |
| **manager** | manager@example.com | Manager@Pulse1 | All read permissions · data export |
| **viewer** | viewer@example.com | Viewer@Pulse1 | Read-only: usage, budget, optimization, config |

> **Important:** Change all passwords before any internet-facing deployment. The `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars provide an additional bootstrap account that bypasses the database — remove or rotate these in production.

### Quick credential change

```bash
# Generate a new bcrypt hash for a custom password
npm run auth:hash-password
# → Interactive prompt, outputs the hash
# → Then update via POST /api/users (admin role required)
```

---

## Authentication Setup

APEX Pulse uses [NextAuth v4](https://next-auth.js.org/) with two supported providers:

### 1. Email + Password (always available)

Credentials are validated against:
1. The `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (bootstrap fallback, no DB required)
2. `User` rows in the database with `active = true` and a bcrypt `passwordHash`

### 2. GitHub OAuth (optional)

Enabled when both `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set.

Setup:
1. Go to **GitHub → Settings → Developer settings → OAuth Apps → New OAuth App**
2. Set **Authorization callback URL** to: `https://your-domain.com/api/auth/callback/github`
3. Copy the Client ID and Client Secret to your `.env.local`
4. Set `NEXT_PUBLIC_GITHUB_OAUTH_ENABLED=1` to show the button on the login page

GitHub users are assigned the `viewer` role by default. Promote them via **Admin → Users** (requires admin role).

### Open Mode (no auth — dev convenience)

If `NEXTAUTH_SECRET` is **not set**, the middleware skips authentication entirely. This is suitable for local development without the login friction, but must **never** be used in production.

---

## Enterprise Deployment

### Architecture overview

```
Internet → Nginx (TLS) → APEX Pulse App → PostgreSQL
                              ↓
                      External APIs (Anthropic, OpenAI, etc.)
                              ↓
                      Webhooks (Slack, HTTP)
```

### Step 1: Generate secrets

```bash
# NextAuth secret — must be at least 32 chars
openssl rand -base64 32

# Strong admin password
openssl rand -base64 24
```

### Step 2: Prepare environment file

```bash
cp .env.example .env
```

Edit `.env` with production values. All **required** fields:

```bash
DATABASE_URL="postgresql://apex:YOUR_DB_PASS@db:5432/apex_pulse?sslmode=disable"
NEXTAUTH_SECRET="your-openssl-rand-base64-32-output"
NEXTAUTH_URL="https://your-domain.com"
NEXT_PUBLIC_AUTH_ENABLED=1
ADMIN_EMAIL="admin@yourcompany.com"
ADMIN_PASSWORD="your-strong-admin-password"
POSTGRES_PASSWORD="your-strong-db-password"
```

### Step 3: TLS certificates

Place your TLS certificate and private key in `nginx/ssl/`:

```
nginx/
  ssl/
    fullchain.pem   # certificate chain (cert + intermediates)
    privkey.pem     # private key
```

**Let's Encrypt (recommended):**
```bash
# Install certbot
sudo apt install certbot

# Obtain cert (before starting nginx, in standalone mode)
sudo certbot certonly --standalone -d your-domain.com

# Copy certs
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem   nginx/ssl/
sudo chown $(whoami) nginx/ssl/*.pem
```

**Self-signed (internal/staging only):**
```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out    nginx/ssl/fullchain.pem \
  -subj "/CN=your-domain.com"
```

### Step 4: Update nginx domain

Edit `nginx/nginx.conf` — replace `YOUR_DOMAIN` with your actual FQDN in two places:

```nginx
server_name YOUR_DOMAIN;   # line ~57 (HTTP server)
server_name YOUR_DOMAIN;   # line ~67 (HTTPS server)
```

### Step 5: Deploy

```bash
docker compose -f docker-compose.pg.yml up -d --build

# Verify all three services are healthy
docker compose -f docker-compose.pg.yml ps

# Seed initial data (first deploy only)
docker compose -f docker-compose.pg.yml exec app \
  node_modules/tsx/dist/cli.mjs scripts/seed.ts

# View logs
docker compose -f docker-compose.pg.yml logs -f app
```

### Step 6: Verify

```bash
# HTTPS health check
curl -f https://your-domain.com/api/health
# → {"status":"ok","db":"ok","latencyMs":2}

# Check security headers
curl -I https://your-domain.com
# → Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

---

## Environment Variables Reference

### Required for production

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string with `sslmode=require` |
| `NEXTAUTH_SECRET` | Random 32-char secret for JWT signing |
| `NEXTAUTH_URL` | Public URL of the app (no trailing slash) |
| `NEXT_PUBLIC_AUTH_ENABLED` | Set to `1` to enable auth UI (login page, role badges) |
| `ADMIN_EMAIL` | Bootstrap admin email |
| `ADMIN_PASSWORD` | Bootstrap admin password — rotate after first login |

### Optional — AI provider integrations

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) — Live Demo + cost ingestion |
| `OPENAI_API_KEY` | OpenAI (GPT-4o, o1, o3) |
| `GOOGLE_API_KEY` | Google Gemini |
| `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` | Azure OpenAI |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION` | AWS Bedrock |

### Optional — GitHub OAuth

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App Client Secret |
| `NEXT_PUBLIC_GITHUB_OAUTH_ENABLED` | Set to `1` to show GitHub button on login page |

### Optional — Webhooks

| Variable | Description |
|----------|-------------|
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for alert notifications |
| `ALERT_WEBHOOK_URL` | Generic HTTP endpoint for JSON alert payloads |

### Optional — Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_RPM` | `120` | Max API requests per minute per IP |

---

## First Login & Initial Configuration

1. **Sign in** at `https://your-domain.com/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`

2. **Create permanent admin user**
   - Navigate to **Admin → Users**
   - Click **+ Invite** → set email, name, role = `admin`
   - Log out, log in with the new account

3. **Remove bootstrap credentials**
   - Remove `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your environment file
   - Restart the app container: `docker compose -f docker-compose.pg.yml restart app`

4. **Set monthly budget**
   - Navigate to **Budget & Forecast**
   - Click **Set Budget** → enter your monthly AI spend target

5. **Tune alert thresholds** (optional)
   - Navigate to **Settings → Runtime Config**
   - Adjust `budget.warn_pct`, `budget.critical_pct`, `opt.cache.target_hit_rate`

---

## Connecting Integrations

All provider API keys are read from environment variables — no code changes required.

| Integration | Env var to add | What it enables |
|-------------|---------------|-----------------|
| Anthropic Claude | `ANTHROPIC_API_KEY` | API Playground tab, real usage recording |
| OpenAI | `OPENAI_API_KEY` | OpenAI cost ingestion via `/api/usage` |
| Google Gemini | `GOOGLE_API_KEY` | Gemini cost ingestion |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `ENDPOINT` | Azure cost ingestion |
| AWS Bedrock | `AWS_*` vars | Bedrock cost ingestion |
| GitHub Copilot seats | `GITHUB_TOKEN` | Live seat count via GitHub API |
| Slack alerts | `SLACK_WEBHOOK_URL` | Budget and anomaly notifications |

After adding a new key, restart the container:
```bash
docker compose -f docker-compose.pg.yml restart app
```

See [INTEGRATIONS.md](INTEGRATIONS.md) for code examples and payload formats.

---

## Health Checks

The `/api/health` endpoint is used by Docker, Kubernetes, and load balancers:

```
GET /api/health
→ 200 { "status": "ok",       "db": "ok",    "latencyMs": 2  }
→ 503 { "status": "degraded", "db": "error", "latencyMs": null }
```

No authentication is required for this endpoint. It probes the database on every call (lightweight `SELECT 1`) to catch connection issues early.

---

## Upgrading

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime rolling update)
docker compose -f docker-compose.pg.yml up -d --build

# Schema migrations (if Prisma schema changed)
docker compose -f docker-compose.pg.yml exec app npx prisma db push
```
