import { prisma } from '@/lib/db'

export interface AuditParams {
  action:      'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED' | 'EXPORT'
  resource:    'budget' | 'config' | 'user' | 'usage' | 'export' | 'optimization' | 'auth' | 'provider_credential' | 'subscription' | 'budget_rule' | 'project_budget' | 'webhook'
  resourceId?: string
  userId?:     string
  userEmail?:  string
  ipAddress?:  string
  before?:     unknown
  after?:      unknown
  metadata?:   unknown
}

// Best-effort — never throws, never blocks the caller
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action:     params.action,
        resource:   params.resource,
        resourceId: params.resourceId,
        userId:     params.userId,
        userEmail:  params.userEmail,
        ipAddress:  params.ipAddress,
        before:     params.before    != null ? JSON.stringify(params.before)   : undefined,
        after:      params.after     != null ? JSON.stringify(params.after)    : undefined,
        metadata:   params.metadata  != null ? JSON.stringify(params.metadata) : undefined,
      },
    })
  } catch {
    // Silently swallow — audit failure must not block business operations
  }
}

// Helper to extract client IP from Next.js request headers
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
