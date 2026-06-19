# APEX Pulse — Deployment Guide

> Platform-specific instructions for Vercel, Railway, Render, Docker, and Kubernetes.
> For full enterprise setup (Docker + PostgreSQL + Nginx TLS), see [SETUP.md](SETUP.md).

---

## Option 1: Docker + PostgreSQL + Nginx (Enterprise)

The recommended production path. Full details in [SETUP.md](SETUP.md).

```bash
cp .env.example .env
# Set: NEXTAUTH_SECRET, NEXTAUTH_URL, POSTGRES_PASSWORD, ADMIN_PASSWORD
# Place TLS certs in nginx/ssl/ and set YOUR_DOMAIN in nginx/nginx.conf
docker compose -f docker-compose.pg.yml up -d --build
curl -f https://your-domain.com/api/health
```

---

## Option 2: Docker (SQLite, single-node)

For teams that don't need PostgreSQL or Nginx — runs out of the box.

```bash
cp .env.example .env.local
# edit with your keys
docker compose up -d
```

Data persists in the `apexdata` Docker volume between restarts.

**Upgrading:**
```bash
docker compose pull
docker compose up -d --build
```

---

## Option 3: Vercel

Best for: teams already on Vercel + a managed Postgres like Neon or Supabase.

1. **Fork / push** the repo to GitHub.

2. **Create a Neon (or Supabase) PostgreSQL database** and copy the connection string.

3. **Import to Vercel**
   - New Project → Import Git Repository
   - Framework: Next.js (auto-detected)
   - Build command: `npx prisma generate && next build`

4. **Set environment variables** in Vercel dashboard:
   ```
   DATABASE_URL=postgresql://...
   NEXTAUTH_SECRET=<openssl rand -base64 32>
   NEXTAUTH_URL=https://your-project.vercel.app
   NEXT_PUBLIC_AUTH_ENABLED=1
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=<strong-password>
   ANTHROPIC_API_KEY=sk-ant-...
   ```

5. **Deploy.** First deploy runs `prisma db push` via the build step.

6. **Seed data** (optional):
   ```bash
   DATABASE_URL="postgresql://..." npm run db:setup
   ```

### Schema note

Switch `schema.prisma` datasource to `postgresql` before pushing:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Option 4: Railway

Railway automatically provisions a PostgreSQL database alongside the app.

1. **Create a new Railway project** at railway.app.

2. **Add a PostgreSQL service** — Railway provisions it and sets `DATABASE_URL` automatically.

3. **Deploy from GitHub** — Railway detects `railway.json` and uses the Dockerfile.

4. **Set environment variables** in Railway dashboard:
   ```
   NEXTAUTH_SECRET=<openssl rand -base64 32>
   NEXTAUTH_URL=https://your-app.railway.app
   NEXT_PUBLIC_AUTH_ENABLED=1
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=<strong-password>
   ANTHROPIC_API_KEY=sk-ant-...
   ```

5. **After first deploy**, seed from Railway's shell tab:
   ```bash
   node_modules/tsx/dist/cli.mjs scripts/seed.ts
   ```

Health check is configured at `/api/health` — Railway shows the green badge when it passes.

---

## Option 5: Render

Render uses `render.yaml` for infrastructure-as-code.

1. **Connect your repo** at render.com → New → Blueprint.

2. **Render reads `render.yaml`** and creates the web service automatically.

3. **Set secret env vars** in Render dashboard:
   ```
   NEXTAUTH_SECRET=<openssl rand -base64 32>
   NEXTAUTH_URL=https://your-app.onrender.com
   NEXT_PUBLIC_AUTH_ENABLED=1
   ADMIN_EMAIL=admin@yourcompany.com
   ADMIN_PASSWORD=<strong-password>
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. **Deploy.** The persistent disk at `/app/data` keeps `prod.db` between deploys.

---

## Option 6: Kubernetes

The `k8s/` directory contains manifests for a production-grade Kubernetes deployment.

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Create secrets (edit k8s/secret.yaml first — base64-encode values)
kubectl apply -f k8s/secret.yaml

# 3. Create config map
kubectl apply -f k8s/configmap.yaml

# 4. Deploy app + service
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 5. Monitor rollout
kubectl rollout status deployment/apex-pulse -n apex-pulse
```

For external access, add an Ingress resource pointing to the `apex-pulse` Service on port 3000 and configure TLS via cert-manager.

---

## PostgreSQL Schema Migration

When switching from SQLite to PostgreSQL in production:

1. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Run migration:
   ```bash
   DATABASE_URL="postgresql://..." npx prisma db push
   # or for managed migrations:
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

3. Reseed (optional):
   ```bash
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

---

## Health Check

All deployment targets poll `/api/health`:

```
GET /api/health
→ 200 { "status": "ok",       "db": "ok",    "latencyMs": 2  }
→ 503 { "status": "degraded", "db": "error", "latencyMs": null }
```

No authentication is required. The endpoint is excluded from rate limiting.

---

## Environment Variables Summary

| Variable | Required | Used by |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | Prisma, all API routes |
| `NEXTAUTH_SECRET` | **Yes (prod)** | JWT signing |
| `NEXTAUTH_URL` | **Yes (prod)** | OAuth callback URLs |
| `NEXT_PUBLIC_AUTH_ENABLED` | Prod | Shows auth UI |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First run | Bootstrap admin |
| `ANTHROPIC_API_KEY` | No | Live Demo tab, `/api/claude` |
| `OPENAI_API_KEY` | No | OpenAI cost ingestion |
| `GOOGLE_API_KEY` | No | Gemini cost ingestion |
| `AZURE_OPENAI_API_KEY` + `ENDPOINT` | No | Azure cost ingestion |
| `AWS_ACCESS_KEY_ID` + `SECRET` | No | Bedrock cost ingestion |
| `SLACK_WEBHOOK_URL` | No | Alert notifications |
| `ALERT_WEBHOOK_URL` | No | Generic alert webhook |

See [`.env.example`](../.env.example) for the full template.
