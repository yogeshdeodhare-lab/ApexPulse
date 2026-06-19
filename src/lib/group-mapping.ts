import { prisma } from '@/lib/db'

const ROLE_RANK = ['viewer', 'manager', 'finance', 'admin']

// Pick the highest-privilege role among the IdP groups a user belongs to.
export async function resolveRoleFromGroups(groups: string[] | undefined): Promise<string | null> {
  if (!groups?.length) return null
  const mappings = await prisma.groupRoleMapping.findMany({ where: { idpGroup: { in: groups } } })
  if (mappings.length === 0) return null
  return mappings.reduce((best, m) => (ROLE_RANK.indexOf(m.role) > ROLE_RANK.indexOf(best) ? m.role : best), 'viewer')
}
