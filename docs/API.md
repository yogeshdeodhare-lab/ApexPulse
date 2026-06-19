# APEX Pulse™ — API Reference

All endpoints are under `/api/`. All responses are `application/json` unless noted. All routes are `force-dynamic` (no caching).

---

## GET /api/health

Health check. Returns DB ping latency.

```json
{ "status": "ok", "version": "5.0.0", "sprint": 5, "db": "ok", "latencyMs": 2, "timestamp": "2026-06-14T10:00:00Z" }
```

Status `503` when DB is unreachable.

---

## GET /api/stats

Executive dashboard summary for the current month.

**Response fields**

| Field | Type | Description |
|-------|------|-------------|
| `mtdSpend` | number | Month-to-date total cost (USD) |
| `mtdTokens` | number | Total input + output tokens MTD |
| `mtdRequests` | number | Total API calls MTD |
| `cacheHitRate` | number | % of tokens served from cache |
| `cacheSavings` | number | USD saved by caching |
| `avgCostPerRequest` | number | MTD spend / MTD requests |
| `dailyTrend` | array | Last 14 days, `{ date, billable, cached }` |
| `topModels` | array | Top models by cost with pricing |
| `projectBreakdown` | array | Cost/tokens/requests per project |
| `providerMix` | array | Cost share per provider |
| `budget` | object | `{ amount, consumed, remaining, utilizationPct }` |

---

## GET /api/usage

Paginated usage record log.

**Query params**

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | 100 | Max records returned |
| `offset` | 0 | Pagination offset |
| `provider` | — | Filter by provider slug |
| `model` | — | Filter by model ID |
| `teamId` | — | Filter by team |
| `projectId` | — | Filter by project |

---

## POST /api/usage

Record a single AI API call.

**Body**

```json
{
  "provider":         "anthropic",
  "model":            "claude-sonnet-4-6",
  "inputTokens":      5000,
  "outputTokens":     800,
  "cacheReadTokens":  12000,
  "cacheWriteTokens": 750,
  "userId":           "alice",
  "teamId":           "platform",
  "projectId":        "rag-search",
  "latencyMs":        1240
}
```

`provider` defaults to `"anthropic"`. Cost is calculated server-side from the pricing table — do not send `totalCost`.

**Supported provider values:** `anthropic` · `openai` · `google` · `azure` · `bedrock`

---

## GET /api/providers

Multi-provider billing summary (token + seat).

**Response**

```json
{
  "tokenProviders": [{ "provider": "anthropic", "name": "...", "color": "...", "mtdSpend": 258.97, "requests": 544, "tokens": 37100000, "models": [...] }],
  "seatProviders":  [{ "provider": "github_copilot", "seats": 210, "pricePerSeat": 19, "monthlyCost": 3990 }],
  "totalMtdSpend":  6840,
  "totalTokenSpend": 290,
  "totalSeatSpend":  6490,
  "totalSeats":      350
}
```

---

## GET /api/teams

Team & attribution breakdown for the current month.

**Response**

```json
{
  "summary": { "totalTeams": 4, "totalSpend": 290.35, "totalDevs": 6, "avgCostPerDev": 48.39, "topTeam": "Platform" },
  "teams": [{
    "id": "platform", "displayName": "Platform", "color": "#378ADD",
    "devs": 2, "mtdSpend": 104.16, "mtdTokens": 16100000, "mtdRequests": 274,
    "avgCostPerDev": 52.08, "spendPct": 36,
    "members":  [{ "userId": "u-a-rao", "displayName": "A. Rao", "cost": 56.46, "pct": 54, ... }],
    "projects": [{ "projectId": "platform-shared", "cost": 95.42, "pct": 92, ... }],
    "providers":[{ "provider": "anthropic", "cost": 91.82 }]
  }]
}
```

---

## GET /api/budget

Get budget for a period.

**Query params:** `period` (default: current month, format `YYYY-MM`)

---

## POST /api/budget

Set or update budget. Fires Slack/webhook alert if MTD spend ≥ 80% of new limit.

**Body:** `{ "amount": 8000, "period": "2026-06" }`

---

## DELETE /api/budget

Delete budget for a period. **Query params:** `period`

---

## GET /api/export

Export usage records as JSON or CSV.

**Query params**

| Param | Default | Description |
|-------|---------|-------------|
| `format` | `json` | `json` or `csv` |
| `from` | — | ISO date string start |
| `to` | — | ISO date string end |
| `provider` | — | Filter by provider |
| `team` | — | Filter by teamId |
| `limit` | 10000 | Max 50,000 |

CSV response has `Content-Disposition: attachment` header for browser download.

---

## GET /api/effectiveness

Coding tool effectiveness snapshots.

**Query params:** `days` (default 30), `tool` (filter by tool ID)

---

## POST /api/claude

Live Demo tab — sends a real prompt to Claude and records the cost.

**Body:** `{ "prompt": "Explain prompt caching", "model": "claude-haiku-4-5-20251001" }`

Requires `ANTHROPIC_API_KEY` to be set.
