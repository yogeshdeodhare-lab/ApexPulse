# APEX Pulse — Security Reference

> Authentication, RBAC, secrets management, network security, and audit trail.

---

## Authentication

### Mechanism

APEX Pulse uses **NextAuth v4** with stateless JWT sessions (no server-side session store required).

| Property | Value |
|----------|-------|
| Token format | Signed JWT (HS256, NEXTAUTH_SECRET) |
| Session lifetime | 24 hours |
| Transport | HTTP-only cookie (`__Secure-next-auth.session-token`) |
| Strategy | `jwt` — no DB session rows |

### Auth providers

| Provider | Trigger | Default role |
|----------|---------|--------------|
| Credentials (email + password) | Always | DB-stored role |
| GitHub OAuth | When `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` are set | `viewer` |
| Env bootstrap admin | When `ADMIN_EMAIL` + `ADMIN_PASSWORD` are set | `admin` |

### Token propagation

The middleware (`src/middleware.ts`) validates the JWT on every non-public request and forwards identity headers to API routes:

```
x-user-id    — UUID from User table
x-user-email — email string
x-user-role  — admin | finance | manager | viewer
```

API routes read role from `x-user-role` rather than re-verifying the JWT, which avoids redundant DB lookups.

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Level | Description |
|------|-------|-------------|
| `admin` | 3 | Full platform access, user management, config write |
| `finance` | 2 | Budget management, audit log, all read permissions |
| `manager` | 1 | All read + data export |
| `viewer` | 0 | Read-only access to dashboards |

Roles are **additive and hierarchical** — a higher role inherits all lower-role permissions.

### Permissions

| Permission | viewer | manager | finance | admin |
|------------|--------|---------|---------|-------|
| `usage:read` | ✓ | ✓ | ✓ | ✓ |
| `budget:read` | ✓ | ✓ | ✓ | ✓ |
| `optimization:read` | ✓ | ✓ | ✓ | ✓ |
| `config:read` | ✓ | ✓ | ✓ | ✓ |
| `export:read` | — | ✓ | ✓ | ✓ |
| `audit:read` | — | — | ✓ | ✓ |
| `budget:write` | — | — | ✓ | ✓ |
| `config:write` | — | — | — | ✓ |
| `user:write` | — | — | — | ✓ |

### Enforcement points

| Layer | Mechanism |
|-------|-----------|
| **Middleware** (`src/middleware.ts`) | JWT check → 401/redirect on unauthenticated |
| **API routes** | `hasRole(req.headers['x-user-role'], 'required-role')` |
| **Specific permission** | `can(role, 'permission:name')` from `src/lib/rbac.ts` |
| **UI** | Role-gated nav items and action buttons (enforced client-side only — API is the authoritative gate) |

### Adding a new protected route

```typescript
import { hasRole } from '@/lib/rbac'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const role = req.headers.get('x-user-role')
  if (!hasRole(role, 'finance')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // ...
}
```

---

## Audit Trail

Every write operation and auth event is logged to the `AuditLog` table:

| Event | Trigger |
|-------|---------|
| `LOGIN` | Successful sign-in |
| `LOGOUT` | Sign-out (when NextAuth signOut callback fires) |
| `ACCESS_DENIED` | 403 returned from any API route |
| `CREATE` | New user, budget, config key |
| `UPDATE` | Role change, budget update, config value edit |
| `DELETE` | User deactivation, record removal |

### Audit log schema

```prisma
model AuditLog {
  id        String   @id
  timestamp DateTime
  action    String   // CREATE | UPDATE | DELETE | LOGIN | LOGOUT | ACCESS_DENIED
  resource  String   // budget | config | user | usage | export
  userId    String?
  userEmail String?
  ipAddress String?
  before    String?  // JSON
  after     String?  // JSON
}
```

### Querying the audit log

```
GET /api/audit?action=LOGIN&from=2026-01-01&to=2026-06-30
→ Requires finance or admin role
```

Audit writes are fire-and-forget — they never block the main operation if the DB is slow.

---

## Network Security

### TLS

All production traffic must be TLS-encrypted. The included `nginx/nginx.conf` enforces:

- **TLS 1.2 minimum** (TLS 1.0 and 1.1 disabled)
- **ECDHE cipher suites** only (forward secrecy)
- **OCSP stapling** enabled
- **HSTS** with 2-year max-age, includeSubDomains, preload

### Security headers

Set by the Nginx layer for all responses:

| Header | Value |
|--------|-------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | See nginx.conf |
| `Permissions-Policy` | camera, microphone, geolocation denied |

### Rate limiting

Two layers:

1. **Nginx** — 30 req/s for `/api/*`, 10 req/s for pages (burst allowed)
2. **Next.js middleware** — token-bucket limiter per IP, default 120 req/min (configurable via `RATE_LIMIT_RPM`)

The middleware limiter catches requests before Nginx (e.g. direct container access in Kubernetes). Nginx limiter protects the edge.

### Network isolation

In the Docker Compose stack, the `apex-internal` network isolates app and database:
- Only `nginx` is port-exposed (80, 443)
- `app` and `db` are reachable only within the Docker network
- Direct database access from the internet is not possible

---

## Secrets Management

### Do

- Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`
- Store secrets in a vault (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager) and inject as container env vars at deploy time
- Rotate `ADMIN_PASSWORD` after first login, then remove the env var entirely
- Use Kubernetes Secrets (or Sealed Secrets) for k8s deployments

### Don't

- Never commit `.env`, `.env.local`, or any file containing real secrets
- Never log `NEXTAUTH_SECRET`, `ADMIN_PASSWORD`, or API keys
- Never set `NEXTAUTH_SECRET` to a short or guessable string

### Secret rotation

1. Generate a new `NEXTAUTH_SECRET`
2. Update the environment (vault / k8s secret / compose env file)
3. Restart the app — all existing sessions are invalidated (users must log in again)
4. Optionally rotate DB passwords via `ALTER USER apex WITH PASSWORD 'new-pass'` and update `DATABASE_URL`

---

## Password Policy

Passwords are hashed with **bcrypt at cost 12** (`bcryptjs` library). Minimum password requirements are enforced at the API layer in `POST /api/users`:

- At least 8 characters
- Mix of upper, lower, digit recommended (not enforced, but documented)

Enforcing organisational password complexity should be done at the identity provider layer (GitHub OAuth, SSO) rather than in the application.

---

## API Security

### Protected endpoints

All API routes except `GET /api/health` and NextAuth routes require a valid JWT session when `NEXTAUTH_SECRET` is set.

### Input validation

- All `POST`/`PATCH` bodies are parsed and typed; unexpected fields are ignored
- Database queries use Prisma parameterised statements (no raw SQL injection risk)
- Amount and percentage fields are validated with `isNaN` / range checks

### Webhook outbound security

Outbound webhooks (`SLACK_WEBHOOK_URL`, `ALERT_WEBHOOK_URL`) use HTTPS only. No sensitive data (API keys, user PII beyond email) is included in webhook payloads.

---

## Kubernetes Security

The included k8s manifests (`k8s/`) enforce:

| Control | Setting |
|---------|---------|
| Non-root user | `runAsNonRoot: true`, `runAsUser: 1001` |
| FS group | `fsGroup: 1001` |
| Secrets | In `k8s/secret.yaml` (base64-encode values, prefer Sealed Secrets) |
| Replicas | 2 minimum for HA |
| Rolling update | `maxUnavailable: 0` (zero-downtime) |
| Health probes | Liveness + readiness on `/api/health` |

### Recommended additions (not included)

- Network policies to restrict pod-to-pod traffic
- Pod Security Admission (PSA) enforcement
- Image signing + admission webhook
- Runtime security (Falco or similar)

---

## Reporting Security Issues

Do not open public GitHub issues for security vulnerabilities. Contact the repository maintainers directly with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. (Optional) Suggested fix

Allow up to 72 hours for an initial response.
