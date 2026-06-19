# APEX Pulse -- Integration Guide

Record AI usage from any provider by POSTing to `/api/usage`.
Cost is calculated server-side -- never send cost values.

> Replace `${APEX_PULSE_URL}` with your deployed URL (e.g. `https://apex.yourcompany.com`).

---

## 1. Anthropic Claude

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const response = await client.messages.create({
  model:      'claude-sonnet-4-6',
  max_tokens: 1024,
  messages:   [{ role: 'user', content: prompt }],
})

await fetch(`${APEX_PULSE_URL}/api/usage`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider:         'anthropic',
    model:            response.model,
    inputTokens:      response.usage.input_tokens,
    outputTokens:     response.usage.output_tokens,
    cacheReadTokens:  response.usage.cache_read_input_tokens       ?? 0,
    cacheWriteTokens: response.usage.cache_creation_input_tokens   ?? 0,
    userId:    'alice',
    teamId:    'platform',
    projectId: 'rag-search',
    latencyMs: Date.now() - startTime,
  }),
})
```

**Prompt caching note:** Anthropic charges `cacheWriteTokens` at 1.25x input price and `cacheReadTokens` at 0.1x input price. APEX Pulse tracks both and surfaces cache hit rate and savings on the Overview page.

---

## 2. OpenAI

```typescript
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const response = await client.chat.completions.create({
  model:    'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
})

await fetch(`${APEX_PULSE_URL}/api/usage`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider:     'openai',
    model:        response.model,
    inputTokens:  response.usage?.prompt_tokens     ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    userId: 'alice', teamId: 'platform', projectId: 'rag-search',
  }),
})
```

**Supported models:** `gpt-4o` · `gpt-4o-mini` · `o1` · `o3-mini`

---

## 3. Google Gemini

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

const result = await model.generateContent(prompt)
const meta   = result.response.usageMetadata

await fetch(`${APEX_PULSE_URL}/api/usage`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider:     'google',
    model:        'gemini-2.0-flash',
    inputTokens:  meta?.promptTokenCount     ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
    userId: 'alice', teamId: 'platform', projectId: 'rag-search',
  }),
})
```

**Supported models:** `gemini-2.0-flash` · `gemini-1.5-pro` · `gemini-1.5-flash`

---

## 4. Azure OpenAI

```typescript
import { AzureOpenAI } from 'openai'

const client = new AzureOpenAI({
  apiKey:     process.env.AZURE_OPENAI_API_KEY,
  endpoint:   process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: '2024-05-01-preview',
})

const response = await client.chat.completions.create({
  model:    'gpt-4o',   // Azure deployment name
  messages: [{ role: 'user', content: prompt }],
})

await fetch(`${APEX_PULSE_URL}/api/usage`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider:     'azure',
    model:        'gpt-4o',
    inputTokens:  response.usage?.prompt_tokens     ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    userId: 'alice', teamId: 'platform', projectId: 'rag-search',
  }),
})
```

**Supported models:** `gpt-4o` · `gpt-4o-mini`

---

## 5. AWS Bedrock

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

const modelId = 'anthropic.claude-3-5-sonnet-20241022-v2:0'
const response = await client.send(new InvokeModelCommand({
  modelId,
  contentType: 'application/json',
  body: JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    messages:   [{ role: 'user', content: prompt }],
  }),
}))

const body  = JSON.parse(new TextDecoder().decode(response.body))
const usage = body.usage

await fetch(`${APEX_PULSE_URL}/api/usage`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider:     'bedrock',
    model:        'claude-3-5-sonnet-20241022',
    inputTokens:  usage.input_tokens  ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    userId: 'alice', teamId: 'platform', projectId: 'rag-search',
  }),
})
```

**Supported models:** `claude-3-5-sonnet-20241022` · `claude-3-haiku-20240307`

---

## 6. LiteLLM Gateway (proxy all providers)

If you route all AI calls through a LiteLLM proxy, use the response metadata to detect the provider:

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  apiKey:  'sk-anything',
  baseURL: 'https://your-litellm-proxy/v1',
})

const response = await client.chat.completions.create({
  model:    'claude-sonnet-4-6',
  messages: [{ role: 'user', content: prompt }],
})

const [provider, ...modelParts] = response.model.includes('/')
  ? response.model.split('/')
  : ['anthropic', response.model]

await fetch(`${APEX_PULSE_URL}/api/usage`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider,
    model:        modelParts.join('/'),
    inputTokens:  response.usage?.prompt_tokens     ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    userId: 'alice', teamId: 'platform', projectId: 'rag-search',
  }),
})
```

---

## 7. Seat-based providers (GitHub Copilot, Cursor, Windsurf)

Billed monthly per seat. Record once per billing period:

```typescript
await prisma.seatAllocation.upsert({
  where:  { period_provider: { period: '2026-06', provider: 'github_copilot' } },
  update: { seats: 210, pricePerSeat: 19 },
  create: { period: '2026-06', provider: 'github_copilot', seats: 210, pricePerSeat: 19 },
})
```

Visible on the Providers page under "Seat billing".

---

## 8. Slack budget alerts

Set `SLACK_WEBHOOK_URL` in your environment. Alerts fire automatically when budget utilization hits 80%, 90%, or 100%.

Create a webhook: **Slack App Directory -> Incoming Webhooks -> Add to Slack**

---

## 9. Generic webhook alerts

Set `ALERT_WEBHOOK_URL`. Your endpoint receives:

```json
{
  "type":      "budget_threshold",
  "title":     "Budget Critical -- 91%",
  "message":   "MTD spend $7,280 has reached 91% of $8,000 budget for 2026-06.",
  "value":     7280,
  "limit":     8000,
  "pct":       91,
  "timestamp": "2026-06-14T10:00:00Z",
  "source":    "apex-pulse"
}
```
