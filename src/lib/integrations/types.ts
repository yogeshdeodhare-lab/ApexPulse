export interface IntegrationField {
  key:         string
  label:       string
  placeholder?: string
}

export interface IntegrationCreds {
  config: Record<string, string>
  secret?: string
}

export interface TestResult { ok: boolean; message: string; latencyMs: number }
export interface SyncResult { ok: boolean; message: string; count?: number }
export interface TicketResult { ok: boolean; url?: string; error?: string }

export interface AlertPayload {
  title:    string
  message:  string
  severity: string
  source:   string
}

export interface IntegrationModule {
  id:          string
  label:       string
  category:    string
  authMethod:  string
  description: string
  fields:      IntegrationField[]   // non-secret config fields
  secretLabel: string | null        // label for the secret field, or null if no secret is user-provided
  test(creds: IntegrationCreds): Promise<TestResult>
  createTicket?(creds: IntegrationCreds, alert: AlertPayload): Promise<TicketResult>
  sync?(creds: IntegrationCreds): Promise<SyncResult>
}
