import { NextRequest, NextResponse } from 'next/server'
import { hasRole } from '@/lib/rbac'

function callerRole(req: NextRequest) { return req.headers.get('x-user-role') ?? null }

interface TestResult { ok: boolean; message: string; latencyMs: number }

async function testAnthropic(key: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'x-api-key':         key,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages:   [{ role: 'user', content: 'hi' }],
      }),
      signal: AbortSignal.timeout(10_000),
    })
    const latencyMs = Date.now() - start
    if (res.ok || res.status === 400) {
      // 400 may mean invalid params but key is valid
      const body = await res.json()
      if (res.ok || body.type === 'error' && body.error?.type !== 'authentication_error') {
        return { ok: true, message: 'Anthropic API key is valid', latencyMs }
      }
    }
    return { ok: false, message: `Anthropic: ${res.status} — check your API key`, latencyMs }
  } catch (e: unknown) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : 'timeout'}`, latencyMs: Date.now() - start }
  }
}

async function testOpenAI(key: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal:  AbortSignal.timeout(10_000),
    })
    const latencyMs = Date.now() - start
    if (res.ok) return { ok: true, message: 'OpenAI API key is valid', latencyMs }
    return { ok: false, message: `OpenAI: ${res.status} — check your API key`, latencyMs }
  } catch (e: unknown) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : 'timeout'}`, latencyMs: Date.now() - start }
  }
}

async function testGoogle(key: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      signal: AbortSignal.timeout(10_000),
    })
    const latencyMs = Date.now() - start
    if (res.ok) return { ok: true, message: 'Google API key is valid', latencyMs }
    return { ok: false, message: `Google: ${res.status} — check your API key`, latencyMs }
  } catch (e: unknown) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : 'timeout'}`, latencyMs: Date.now() - start }
  }
}

async function testGitHub(token: string): Promise<TestResult> {
  const start = Date.now()
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, 'User-Agent': 'apex-pulse/1.0' },
      signal:  AbortSignal.timeout(10_000),
    })
    const latencyMs = Date.now() - start
    if (res.ok) {
      const body = await res.json()
      return { ok: true, message: `GitHub token valid — authenticated as ${body.login}`, latencyMs }
    }
    return { ok: false, message: `GitHub: ${res.status} — check your token`, latencyMs }
  } catch (e: unknown) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : 'timeout'}`, latencyMs: Date.now() - start }
  }
}

async function testSlack(webhookUrl: string): Promise<TestResult> {
  if (!webhookUrl.startsWith('https://hooks.slack.com/services/')) {
    return { ok: false, message: 'Not a valid Slack webhook URL (must start with https://hooks.slack.com/services/)', latencyMs: 0 }
  }
  const start = Date.now()
  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ text: '_APEX Pulse: Slack webhook test — connection verified ✓_' }),
      signal:  AbortSignal.timeout(10_000),
    })
    const latencyMs = Date.now() - start
    if (res.ok) return { ok: true, message: 'Slack webhook delivered test message', latencyMs }
    return { ok: false, message: `Slack: ${res.status} — check webhook URL`, latencyMs }
  } catch (e: unknown) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : 'timeout'}`, latencyMs: Date.now() - start }
  }
}

async function testWebhook(url: string): Promise<TestResult> {
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    return { ok: false, message: 'Not a valid URL (must start with http:// or https://)', latencyMs: 0 }
  }
  const start = Date.now()
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'content-type': 'application/json', 'x-apex-pulse': 'test' },
      body:    JSON.stringify({ type: 'test', source: 'apex-pulse', timestamp: new Date().toISOString() }),
      signal:  AbortSignal.timeout(10_000),
    })
    const latencyMs = Date.now() - start
    if (res.ok) return { ok: true, message: `Webhook responded ${res.status}`, latencyMs }
    return { ok: false, message: `Webhook returned ${res.status}`, latencyMs }
  } catch (e: unknown) {
    return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : 'timeout'}`, latencyMs: Date.now() - start }
  }
}

function validateAzure(key: string, endpoint: string): TestResult {
  if (!key) return { ok: false, message: 'Azure API key is required', latencyMs: 0 }
  if (!endpoint?.includes('.openai.azure.com')) {
    return { ok: false, message: 'Endpoint must be https://<resource>.openai.azure.com/', latencyMs: 0 }
  }
  return { ok: true, message: 'Azure credentials format is valid — will be verified on first API call', latencyMs: 0 }
}

function validateBedrock(accessKeyId: string): TestResult {
  if (!accessKeyId.startsWith('AKIA') && !accessKeyId.startsWith('ASIA')) {
    return { ok: false, message: 'AWS Access Key ID must start with AKIA or ASIA', latencyMs: 0 }
  }
  if (accessKeyId.length !== 20) {
    return { ok: false, message: 'AWS Access Key ID must be 20 characters', latencyMs: 0 }
  }
  return { ok: true, message: 'AWS key format is valid — will be verified on first Bedrock call', latencyMs: 0 }
}

export const dynamic = 'force-dynamic'

// POST /api/integrations/providers/test
// Body: { provider: string, key: string, endpoint?: string }
export async function POST(req: NextRequest) {
  if (!hasRole(callerRole(req), 'admin')) {
    return NextResponse.json({ ok: false, message: 'Forbidden — admin role required', latencyMs: 0 }, { status: 403 })
  }

  const { provider, key, endpoint } = await req.json() as {
    provider: string
    key:      string
    endpoint?: string
  }

  if (!provider || !key) {
    return NextResponse.json({ ok: false, message: 'provider and key required', latencyMs: 0 }, { status: 400 })
  }

  let result: TestResult

  switch (provider) {
    case 'anthropic':    result = await testAnthropic(key); break
    case 'openai':       result = await testOpenAI(key);    break
    case 'google':       result = await testGoogle(key);    break
    case 'github':       result = await testGitHub(key);    break
    case 'slackAlerts':  result = await testSlack(key);     break
    case 'webhookAlerts':result = await testWebhook(key);   break
    case 'azure':        result = validateAzure(key, endpoint ?? ''); break
    case 'bedrock':      result = validateBedrock(key);     break
    default:
      result = { ok: false, message: `Unknown provider: ${provider}`, latencyMs: 0 }
  }

  // Update testOk in DB if vault key exists
  if (result.ok) {
    const { prisma } = await import('@/lib/db')
    await prisma.providerCredential.updateMany({
      where:  { provider },
      data:   { testOk: true, testedAt: new Date() },
    }).catch(() => {})
  }

  return NextResponse.json(result)
}
