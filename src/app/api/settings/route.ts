import { NextResponse } from 'next/server'
import { getProviderStatus } from '@/lib/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    version:     '16.0.0',
    sprint:      16,
    providers:   getProviderStatus(),
    nodeEnv:     process.env.NODE_ENV,
    dbType:      (process.env.DATABASE_URL ?? '').startsWith('postgresql') ? 'postgresql' : 'sqlite',
    authEnabled: !!process.env.NEXTAUTH_SECRET,
    sso: {
      enabled: !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
      name:    process.env.OIDC_PROVIDER_NAME || 'SSO',
    },
    scimEnabled: !!process.env.SCIM_BEARER_TOKEN,
  })
}
