import { NextRequest } from 'next/server'
import type { User } from '@prisma/client'

// ── Auth — static Bearer token configured in both the IdP's SCIM app and our env ─

export function verifyScimAuth(req: NextRequest): boolean {
  const expected = process.env.SCIM_BEARER_TOKEN
  if (!expected) return false
  return req.headers.get('authorization') === `Bearer ${expected}`
}

export function scimError(status: number, detail: string) {
  return {
    status,
    body: { schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: String(status), detail },
  }
}

// ── Resource shaping ──────────────────────────────────────────────────────────

export function toScimUser(u: User) {
  return {
    schemas:    ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id:         u.id,
    externalId: u.externalId ?? undefined,
    userName:   u.email,
    displayName: u.name ?? u.email,
    name:       { formatted: u.name ?? u.email },
    emails:     [{ value: u.email, primary: true }],
    active:     u.active,
    'urn:apexpulse:scim:1.0:role': u.role, // non-standard extension — surfaces the resolved APEX Pulse role
    meta: {
      resourceType: 'User',
      created:      u.createdAt.toISOString(),
      lastModified: u.updatedAt.toISOString(),
    },
  }
}

// ── Request parsing — tolerant of the minor shape variations Okta/Azure AD send ─

interface ScimUserPayload {
  userName?:   string
  externalId?: string
  active?:     boolean
  displayName?: string
  name?:       { givenName?: string; familyName?: string; formatted?: string }
  emails?:     { value: string; primary?: boolean }[]
  groups?:     (string | { value: string })[]
}

export function extractEmail(body: ScimUserPayload): string | null {
  return body.userName
    ?? body.emails?.find(e => e.primary)?.value
    ?? body.emails?.[0]?.value
    ?? null
}

export function extractName(body: ScimUserPayload, fallback: string): string {
  const composed = [body.name?.givenName, body.name?.familyName].filter(Boolean).join(' ')
  return body.displayName ?? body.name?.formatted ?? (composed || fallback)
}

export function extractGroups(body: ScimUserPayload): string[] {
  return (body.groups ?? []).map(g => typeof g === 'string' ? g : g.value).filter(Boolean)
}

// Parses the common `userName eq "..."` / `emails.value eq "..."` SCIM filter syntax
// (used by Okta/Azure AD to check for an existing user before provisioning a new one).
export function parseFilterEmail(filter: string | null): string | null {
  if (!filter) return null
  const m = filter.match(/(?:userName|emails(?:\.value)?)\s+eq\s+"([^"]+)"/i)
  return m ? m[1] : null
}
