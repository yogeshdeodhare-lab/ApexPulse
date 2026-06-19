'use client'

import React from 'react'
import { Panel, KpiCard, mono } from '@/components/ui'
import { PERMISSIONS, ROLE_META, type Role, type Permission } from '@/lib/rbac'

const ROLES: Role[] = ['viewer', 'manager', 'finance', 'admin']

const PERMISSION_LABELS: Record<Permission, { label: string; section: string }> = {
  'usage:read':        { label: 'View usage data',        section: 'Read' },
  'budget:read':       { label: 'View budget',            section: 'Read' },
  'optimization:read': { label: 'View optimization',      section: 'Read' },
  'config:read':       { label: 'View config keys',       section: 'Read' },
  'export:read':       { label: 'Export data (CSV/JSON)', section: 'Read' },
  'audit:read':        { label: 'View audit log',         section: 'Read' },
  'budget:write':      { label: 'Set / edit budget',      section: 'Write' },
  'config:write':      { label: 'Edit runtime config',    section: 'Write' },
  'user:write':        { label: 'Manage users',           section: 'Write' },
}

function Cell({ allowed, color }: { allowed: boolean; color: string }) {
  return (
    <td className="py-2.5 px-3 text-center">
      {allowed
        ? <span className="text-[13px]" style={{ color }}>✓</span>
        : <span className="text-[11px]" style={{ color: 'rgba(133,183,235,0.18)' }}>—</span>
      }
    </td>
  )
}

export default function GovernancePage() {
  const permissions = Object.keys(PERMISSIONS) as Permission[]
  const sections = ['Read', 'Write']

  return (
    <div className="space-y-4 animate-slideUp">
      {/* Role cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {ROLES.map(role => {
          const meta = ROLE_META[role]
          const permCount = permissions.filter(p => PERMISSIONS[p].includes(role as never)).length
          return (
            <div
              key={role}
              className="rounded-[13px] p-4"
              style={{
                background: `${meta.color}0A`,
                border: `1px solid ${meta.color}25`,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[10px] font-bold"
                  style={{ background: `${meta.color}22`, color: meta.color }}
                >
                  {meta.label.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[12px] font-semibold" style={{ color: '#EBF4FF' }}>{meta.label}</span>
              </div>
              <p className={`${mono} text-[9.5px] leading-relaxed mb-2`} style={{ color: 'rgba(133,183,235,0.50)' }}>
                {meta.description}
              </p>
              <span className={`${mono} text-[9px] px-2 py-0.5 rounded-full`}
                style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}>
                {permCount} / {permissions.length} permissions
              </span>
            </div>
          )
        })}
      </div>

      {/* Permission matrix */}
      <Panel title="Permission Matrix" badge="RBAC · 4 ROLES · 9 PERMISSIONS">
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr>
                <th
                  className={`${mono} text-[9px] tracking-[.08em] uppercase text-left py-2 px-3`}
                  style={{ color: 'rgba(133,183,235,0.40)', borderBottom: '1px solid rgba(133,183,235,0.10)', minWidth: 200 }}
                >
                  Permission
                </th>
                {ROLES.map(role => {
                  const meta = ROLE_META[role]
                  return (
                    <th
                      key={role}
                      className={`${mono} text-[9px] tracking-[.08em] uppercase text-center py-2 px-3`}
                      style={{ color: meta.color, borderBottom: '1px solid rgba(133,183,235,0.10)', minWidth: 90 }}
                    >
                      {meta.label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sections.map(section => (
                <React.Fragment key={section}>
                  <tr>
                    <td
                      colSpan={5}
                      className={`${mono} text-[8.5px] tracking-[.10em] uppercase px-3 pt-4 pb-1`}
                      style={{ color: 'rgba(133,183,235,0.28)' }}
                    >
                      {section} access
                    </td>
                  </tr>
                  {permissions
                    .filter(p => PERMISSION_LABELS[p].section === section)
                    .map(p => {
                      const { label } = PERMISSION_LABELS[p]
                      return (
                        <tr
                          key={p}
                          style={{ borderBottom: '1px solid rgba(133,183,235,0.05)' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(55,138,221,0.04)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          <td className="py-2.5 px-3">
                            <div>
                              <span className="text-[11.5px]" style={{ color: '#EBF4FF' }}>{label}</span>
                              <span className={`${mono} text-[9px] block`} style={{ color: 'rgba(133,183,235,0.35)' }}>{p}</span>
                            </div>
                          </td>
                          {ROLES.map(role => (
                            <Cell
                              key={role}
                              allowed={PERMISSIONS[p].includes(role as never)}
                              color={ROLE_META[role].color}
                            />
                          ))}
                        </tr>
                      )
                    })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Role hierarchy note */}
      <Panel title="Role Hierarchy" badge="ADDITIVE · HIGHER INHERITS ALL LOWER">
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {ROLES.map((role, i) => {
            const meta = ROLE_META[role]
            return (
              <div key={role} className="flex items-center gap-2">
                <div
                  className={`${mono} text-[10px] px-3 py-1.5 rounded-full font-semibold`}
                  style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}
                >
                  {meta.label}
                </div>
                {i < ROLES.length - 1 && (
                  <span className="text-[12px]" style={{ color: 'rgba(133,183,235,0.25)' }}>→</span>
                )}
              </div>
            )
          })}
        </div>
        <p className={`${mono} text-[10px] mt-3`} style={{ color: 'rgba(133,183,235,0.35)' }}>
          Roles are enforced in middleware (JWT) and per-route via <code style={{ color: 'rgba(133,183,235,0.55)' }}>can(role, permission)</code> from <code style={{ color: 'rgba(133,183,235,0.55)' }}>src/lib/rbac.ts</code>.
          Assign roles to DB users via <code style={{ color: 'rgba(133,183,235,0.55)' }}>prisma studio</code> or the user management API (admin only).
        </p>
      </Panel>

      {/* Audit trail note */}
      <Panel title="Compliance & Audit" badge="ALWAYS ON">
        <div className="grid md:grid-cols-3 gap-3 mt-2">
          {[
            { icon: '◈', title: 'All write operations',   desc: 'Budget set, config change, user update — before/after values stored' },
            { icon: '⟳', title: 'Auth events',            desc: 'LOGIN, LOGOUT, ACCESS_DENIED recorded with IP and user identity' },
            { icon: '⊞', title: 'Best-effort writes',     desc: 'Audit failures never block business operations — fire-and-forget pattern' },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="p-3 rounded-[10px]"
              style={{ background: 'rgba(133,183,235,0.04)', border: '1px solid rgba(133,183,235,0.08)' }}
            >
              <div className="text-[16px] mb-1.5" style={{ color: 'rgba(133,183,235,0.45)' }}>{icon}</div>
              <p className="text-[12px] font-medium mb-1" style={{ color: '#EBF4FF' }}>{title}</p>
              <p className={`${mono} text-[9.5px]`} style={{ color: 'rgba(133,183,235,0.40)' }}>{desc}</p>
            </div>
          ))}
        </div>
        <p className={`${mono} text-[9.5px] mt-3`} style={{ color: 'rgba(133,183,235,0.30)' }}>
          Audit log accessible via <code style={{ color: 'rgba(133,183,235,0.50)' }}>GET /api/audit</code> (finance+ role) with filters: action, resource, userId, from/to dates.
        </p>
      </Panel>
    </div>
  )
}
