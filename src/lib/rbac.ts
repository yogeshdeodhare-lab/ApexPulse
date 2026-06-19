// Role hierarchy — higher index = more permission
export type Role = 'viewer' | 'manager' | 'finance' | 'admin'

const HIERARCHY: Record<Role, number> = {
  viewer:  0,
  manager: 1,
  finance: 2,
  admin:   3,
}

export function hasRole(userRole: string | undefined | null, required: Role): boolean {
  if (!userRole) return false
  return (HIERARCHY[userRole as Role] ?? -1) >= HIERARCHY[required]
}

// Permission map — what each role can do
export const PERMISSIONS = {
  // Read access
  'usage:read':        ['viewer', 'manager', 'finance', 'admin'] as Role[],
  'budget:read':       ['viewer', 'manager', 'finance', 'admin'] as Role[],
  'optimization:read': ['viewer', 'manager', 'finance', 'admin'] as Role[],
  'config:read':       ['viewer', 'manager', 'finance', 'admin'] as Role[],
  'audit:read':        ['finance', 'admin'] as Role[],
  'export:read':       ['manager', 'finance', 'admin'] as Role[],

  // Write access
  'budget:write':      ['finance', 'admin'] as Role[],
  'config:write':      ['admin'] as Role[],
  'user:write':        ['admin'] as Role[],
} as const

export type Permission = keyof typeof PERMISSIONS

export function can(userRole: string | undefined | null, permission: Permission): boolean {
  if (!userRole) return false
  const allowed = PERMISSIONS[permission] as readonly string[]
  return allowed.includes(userRole)
}

// Role display metadata for UI
export const ROLE_META: Record<Role, { label: string; color: string; description: string }> = {
  viewer:  { label: 'Viewer',  color: '#85B7EB', description: 'Read-only access to all dashboards' },
  manager: { label: 'Manager', color: '#22A06B', description: 'Read access + data export' },
  finance: { label: 'Finance', color: '#C98A20', description: 'Budget management + audit log access' },
  admin:   { label: 'Admin',   color: '#E24B4A', description: 'Full access including config and user management' },
}
