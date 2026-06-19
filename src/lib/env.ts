// Validated runtime environment config — import this instead of process.env directly

function required(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing required env var: ${key}`)
  return v
}

function optional(key: string, fallback = ''): string {
  return process.env[key] ?? fallback
}

export const env = {
  // Database
  databaseUrl: required('DATABASE_URL'),

  // Key vault (S11) — AES-256-GCM encryption for stored provider keys
  encryptionKey: optional('ENCRYPTION_KEY'),

  // Provider API keys (all optional — features degrade gracefully)
  anthropicApiKey:     optional('ANTHROPIC_API_KEY'),
  openaiApiKey:        optional('OPENAI_API_KEY'),
  googleApiKey:        optional('GOOGLE_API_KEY'),
  azureOpenAiKey:      optional('AZURE_OPENAI_API_KEY'),
  azureOpenAiEndpoint: optional('AZURE_OPENAI_ENDPOINT'),
  awsAccessKeyId:      optional('AWS_ACCESS_KEY_ID'),
  awsSecretAccessKey:  optional('AWS_SECRET_ACCESS_KEY'),
  awsRegion:           optional('AWS_REGION', 'us-east-1'),

  // Seat provider keys
  githubToken:   optional('GITHUB_TOKEN'),

  // Alert webhooks
  slackWebhookUrl:  optional('SLACK_WEBHOOK_URL'),
  alertWebhookUrl:  optional('ALERT_WEBHOOK_URL'),

  // App config
  nodeEnv:   optional('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
} as const

// Return which providers are configured (for Settings page)
export function getProviderStatus(): Record<string, boolean> {
  return {
    anthropic:    !!env.anthropicApiKey,
    openai:       !!env.openaiApiKey,
    google:       !!env.googleApiKey,
    azure:        !!(env.azureOpenAiKey && env.azureOpenAiEndpoint),
    bedrock:      !!(env.awsAccessKeyId && env.awsSecretAccessKey),
    github:       !!env.githubToken,
    slackAlerts:  !!env.slackWebhookUrl,
    webhookAlerts:!!env.alertWebhookUrl,
  }
}
