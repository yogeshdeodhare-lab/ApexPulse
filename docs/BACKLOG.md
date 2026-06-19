# APEX Pulse — Product Backlog & Sprint Planning

> Future sprints S11–S20. All items below are **planned but not yet implemented**.
> No code changes are required to plan this backlog.

---

## Guiding Principle

Every feature in this backlog aims to **eliminate the need for code changes** to manage the platform. Integrations should be connected through the UI, subscriptions managed through dashboards, and users invited and governed through the admin console — not by editing `.env` files or restarting containers.

---

## S11 — In-App Provider Connection UI

**Goal:** Connect AI provider API keys from the Integrations page — no env var edits required.

### Features
- **Provider connection modal** — form with encrypted key input field per provider (Anthropic, OpenAI, Google, Azure, Bedrock)
- **Connection test** — validate the key against the provider's API before saving
- **Key vault storage** — store encrypted API keys in the `AppConfig` DB table (AES-256-GCM, encryption key from `APP_ENCRYPTION_KEY` env var)
- **Connection status indicators** — live green/red/pending badges per provider on the Integrations page
- **Key rotation** — re-enter a new key to replace the old one; old key is zeroed immediately
- **Audit trail** — all key additions and removals logged (never log the key value itself)

### API additions
- `PUT /api/integrations/providers` — store/update encrypted provider key (admin only)
- `GET /api/integrations/providers` — return connection status for each provider (never return the key)
- `POST /api/integrations/providers/test` — fire a cheap test call to validate the key

### Acceptance criteria
- New admin can connect Anthropic and OpenAI from the browser without touching the server
- Disconnecting a provider removes the key from the DB and marks that provider as inactive
- All provider key operations appear in the audit log

---

## S12 — Subscription & Billing Management

**Goal:** Track team subscriptions, plan tiers, and renewal dates inside APEX Pulse.

### Features
- **Subscription registry** — manage records: provider, plan name, seats, cost/month, renewal date, billing contact
- **Renewal calendar** — dashboard widget showing upcoming renewals in the next 30/60/90 days
- **Cost reconciliation** — compare actual API spend against subscription commitments; flag over/under-utilisation
- **Committed spend tracker** — annual commitments (AWS Savings Plans, Azure Reserved, Anthropic volume deal) with burn-down gauge
- **Subscription alerts** — notify (Slack/webhook) when a renewal is <30 days away, or when actual spend deviates >20% from committed
- **CSV/JSON export** — export subscription registry for procurement/finance

### New DB model
```prisma
model Subscription {
  id           String   @id @default(uuid())
  provider     String   // anthropic | openai | azure | aws | github_copilot | cursor ...
  planName     String
  seats        Int?
  monthlyCost  Float
  annualCommit Float?
  renewalDate  DateTime
  billingEmail String?
  notes        String?
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Acceptance criteria
- Finance user can view all subscriptions without logging into each provider portal
- Renewal alerts fire to Slack ≥30 days before renewal date
- Committed spend burn-down is visible on the Overview page

---

## S13 — Advanced User Management & SSO

**Goal:** Enterprise identity management without manual user creation.

### Features
- **SAML 2.0 / OIDC SSO** — integrate with Okta, Azure AD, Google Workspace, or any SAML IdP; uses `next-auth` OIDC provider
- **SCIM 2.0 provisioning** — auto-provision and deprovision users from Okta/Azure AD; REST endpoint at `/api/scim/v2/Users`
- **Group-to-role mapping** — map IdP groups (e.g., `finops-admins`) to APEX Pulse roles (`admin`) at the tenant level
- **Bulk invite** — CSV upload to invite many users at once
- **Session management** — admin can see active sessions per user and force-expire individual sessions
- **MFA enforcement** — flag at the tenant level to require MFA (delegated to IdP in SSO mode, enforced via session metadata in credentials mode)
- **Password reset flow** — email-based reset with time-limited tokens (`/api/auth/reset-password`)

### New API additions
- `POST /api/scim/v2/Users` — SCIM user provisioning
- `PATCH /api/scim/v2/Users/:id` — SCIM role/active update
- `DELETE /api/scim/v2/Users/:id` — SCIM deprovisioning
- `POST /api/auth/reset-password/request` — send reset email
- `POST /api/auth/reset-password/confirm` — validate token + set new password

### Acceptance criteria
- An Okta administrator can push a user to APEX Pulse by assigning the app in Okta
- SSO login shows the provider name on the login page instead of credential fields
- Deprovisioning in Okta sets `active = false` in APEX Pulse within 60 seconds

---

## S14 — Webhook & Alert Management UI

**Goal:** Create, test, and monitor webhooks from the app without env var changes.

### Features
- **Webhook registry** — create named webhooks (Slack, HTTP, PagerDuty, Teams) from the Integrations page
- **Event type mapping** — choose which alert types trigger each webhook (budget threshold, cache alert, security)
- **Test delivery** — "Send test" button fires a sample payload immediately and shows the HTTP response
- **Delivery log** — per-webhook history: status code, latency, payload, timestamp, retry count
- **Retry policy** — configurable: up to 3 retries with exponential backoff on non-2xx responses
- **Signature verification** — outbound requests include `X-Apex-Signature` (HMAC-SHA256 of the payload)

### New DB model
```prisma
model Webhook {
  id         String   @id @default(uuid())
  name       String
  url        String
  type       String   // slack | http | pagerduty | teams
  events     String   // JSON array: ["budget_threshold","security"]
  secret     String   // for HMAC signing
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())
}
model WebhookDelivery {
  id         String   @id @default(uuid())
  webhookId  String
  alertId    String?
  statusCode Int?
  latencyMs  Int?
  success    Boolean
  sentAt     DateTime @default(now())
  error      String?
}
```

### Acceptance criteria
- Admin can add a Slack webhook from the browser; it fires on the next budget alert
- Delivery log shows all past deliveries with status codes and timestamps
- Failed deliveries are retried up to 3 times with exponential backoff

---

## S15 — Integration Marketplace

**Goal:** One-click connections to the tools teams already use, from the UI.

### Integrations planned

| Tool | Data exchanged | Auth method |
|------|---------------|-------------|
| **Jira** | Create issues for anomalies; tag spend by Jira project | OAuth 2.0 |
| **Linear** | Create Linear issues for budget alerts | API key (stored encrypted) |
| **GitHub** | Copilot seat counts; link spend to repo/team | GitHub App or token |
| **Slack** | Rich block messages for alerts; daily digest | OAuth or incoming webhook |
| **Datadog** | Push cost metrics as custom metrics | API key |
| **Grafana** | Expose `/api/metrics` Prometheus endpoint | Token-based |
| **ServiceNow** | Create ITSM tickets for critical alerts | Basic auth / OAuth |

### Architecture
- Each integration is a plug-in module in `src/lib/integrations/`
- Common interface: `connect(config)`, `test()`, `sync()`, `disconnect()`
- Credentials stored encrypted in `AppConfig` under namespaced keys (`integration.jira.token`)
- Sync runs on a configurable schedule via a background job (or triggered manually)

### Acceptance criteria
- Admin connects Jira in 3 clicks (OAuth flow); no code changes
- Next alert automatically creates a Jira issue
- Integration status is visible on the Integrations page with last-sync timestamp

---

## S16 — Budget Automation & Rules Engine

**Goal:** React to spend automatically — not just alert.

### Features
- **Budget rules** — `IF spend > 90% THEN notify channel #finops AND disable non-essential projects`
- **Project spend caps** — hard-stop or soft-warn when a project exceeds its monthly cap
- **Auto-scale down** — when budget threshold is hit, automatically lower `model_routing.default_model` from opus to sonnet via config write
- **Approval workflows** — budget increase requests require finance-role approval (stored as `PendingAction` rows)
- **Scheduled reports** — weekly/monthly spend digest emailed to configured recipients

### New DB model
```prisma
model BudgetRule {
  id          String   @id @default(uuid())
  name        String
  triggerPct  Float    // e.g. 90.0
  actions     String   // JSON: [{type:"notify",channel:"#finops"},{type:"config_write",key:"...",value:"..."}]
  active      Boolean  @default(true)
  lastFiredAt DateTime?
}
```

### Acceptance criteria
- Finance user creates a rule "at 85% warn #finops" from the UI
- Rule fires the Slack notification at the configured threshold without admin intervention

---

## S17 — AI-Powered Optimization Engine

**Goal:** Move from static recommendations to live, AI-generated, context-aware suggestions.

### Features
- **Continuous analysis** — background job (every 6 hours) runs Claude Haiku over the last 7 days of usage data
- **Pattern detection** — identify: unused seat allocations, over-provisioned models for low-complexity tasks, cache hit rate degradation, team spend anomalies vs. historical baseline
- **Actionable recommendations** — each suggestion includes estimated savings, confidence level, and a one-click "apply" button (for safe config changes) or "create ticket" (for process changes)
- **Recommendation history** — track which suggestions were applied, dismissed, or expired
- **ROI tracking** — after applying a suggestion, measure actual savings vs. projected for the next 30 days

### API additions
- `GET /api/ai/recommendations` — returns live recommendations with savings estimates
- `POST /api/ai/recommendations/:id/apply` — applies the recommended config change
- `POST /api/ai/recommendations/:id/dismiss` — marks dismissed, won't resurface for 30 days

### Acceptance criteria
- At least 3 actionable recommendations are surfaced after seeding 30 days of data
- Applying a "switch model routing" recommendation changes the config value and logs to audit trail
- Recommendations refresh automatically every 6 hours

---

## S18 — Multi-Tenant & Organisation Hierarchy

**Goal:** Support multiple organisations or business units on a single APEX Pulse instance.

### Features
- **Tenant model** — each org has its own set of users, budgets, config, and provider keys
- **Tenant isolation** — all DB queries are scoped by `tenantId`; cross-tenant data access is impossible
- **Super-admin role** — platform operator can manage all tenants, create new orgs, set tenant-level quotas
- **Per-tenant RBAC** — each tenant has its own admin; cannot see other tenants' data
- **Tenant provisioning API** — `POST /api/tenants` for platform operators

### Schema impact
Most existing models gain a `tenantId String` column. A new `Tenant` model tracks subscription plan, quota, and feature flags.

### Acceptance criteria
- Two tenants on the same instance cannot see each other's usage data or users
- Super-admin can view a cross-tenant spend summary
- Tenant creation takes <60 seconds via API

---

## S19 — Mobile-Optimised Dashboard

**Goal:** Full feature parity on mobile browsers; native app shells optional.

### Features
- **Responsive overhaul** — all pages reflow correctly on 375px–428px viewports (iPhone SE → Pro Max)
- **Progressive Web App (PWA)** — manifest.json + service worker for "Add to Home Screen"
- **Push notifications** — budget alerts and critical incidents delivered as browser push notifications (Web Push API)
- **Touch-optimised charts** — Recharts tooltips and touch targets enlarged for finger input
- **Offline mode** — service worker caches the last known dashboard state; shows staleness indicator when offline

### Acceptance criteria
- All 13 pages usable on a 390px-wide screen without horizontal scroll
- Budget alert push notification delivered within 60 seconds of threshold crossing
- App works in Chrome, Safari iOS, and Firefox Android

---

## S20 — Enterprise Marketplace & ISV Listing

**Goal:** Package APEX Pulse for enterprise procurement channels.

### Features
- **AWS Marketplace listing** — AMI and ECS-based deployment; metered billing via AWS Marketplace Metering API
- **Azure Marketplace listing** — managed application or solution template
- **BYOL support** — license key validation for on-premises deployments
- **SOC 2 Type II readiness** — evidence package: access logs, change management, encryption-at-rest proof
- **ISO 27001 readiness** — risk register, asset inventory, policy templates
- **Penetration test report** — annual third-party pentest with remediation tracking

### Acceptance criteria
- A customer can deploy APEX Pulse from the AWS Marketplace in under 20 minutes
- Compliance evidence package is auto-generated from audit log exports

---

## Backlog Prioritisation Summary

| Sprint | Theme | Value | Complexity | Priority |
|--------|-------|-------|------------|----------|
| S11 | In-App Provider Connection | High | Medium | ★★★★★ |
| S12 | Subscription Management | High | Low | ★★★★☆ |
| S13 | SSO & SCIM | High | High | ★★★★☆ |
| S14 | Webhook Management UI | Medium | Medium | ★★★☆☆ |
| S15 | Integration Marketplace | High | High | ★★★★☆ |
| S16 | Budget Automation | High | Medium | ★★★★☆ |
| S17 | AI Optimization Engine | High | High | ★★★★☆ |
| S18 | Multi-Tenant | Medium | Very High | ★★★☆☆ |
| S19 | Mobile PWA | Medium | Medium | ★★★☆☆ |
| S20 | Marketplace Listing | Medium | Very High | ★★☆☆☆ |

**Recommended sprint order:** S11 → S12 → S16 → S14 → S13 → S15 → S17 → S19 → S18 → S20

This ordering delivers the highest user value (self-service integrations + budget automation) before the higher-complexity enterprise features (SSO, multi-tenant, marketplace).
