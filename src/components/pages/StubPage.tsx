'use client'

import { mono } from '@/components/ui'

const PAGE_CONTEXT: Record<string, { icon: string; desc: string; sprint: string }> = {
  providers: {
    icon: '⬡',
    desc: 'Multi-provider cost tracking — OpenAI, Gemini, Azure OpenAI, AWS Bedrock, GitHub Copilot, Cursor, Windsurf, Cline, Roo Code, and LangChain — alongside Claude.',
    sprint: 'Sprint 2 · Multi-provider ingestion',
  },
  teams: {
    icon: '◎',
    desc: 'Team & project management — per-team budgets, member attribution, project-level drill-down, and cross-team spend comparison.',
    sprint: 'Sprint 3 · Teams & attribution',
  },
  optimization: {
    icon: '↗',
    desc: 'AI-generated optimization recommendations — model routing rules, cache strategy improvements, and estimated monthly savings.',
    sprint: 'Sprint 4 · Optimization engine',
  },
  governance: {
    icon: '◉',
    desc: 'RBAC permission matrix — 7 roles (Platform Admin, FinOps Manager, Executive, Eng Manager, Developer, Governance Analyst, Auditor) with granular capability controls.',
    sprint: 'Sprint 5 · Governance & RBAC',
  },
  alerts: {
    icon: '◈',
    desc: 'Budget threshold alerts, anomaly detection, and incident tracking with SLA-based escalation policies.',
    sprint: 'Sprint 5 · Alert engine',
  },
  integrations: {
    icon: '⊞',
    desc: 'Connected provider integrations, LiteLLM gateway configuration, Langfuse observability, and webhook management.',
    sprint: 'Sprint 6 · Integration hub',
  },
  settings: {
    icon: '⚙',
    desc: 'Organization settings — API keys, tenant configuration, notification preferences, and audit log export.',
    sprint: 'Sprint 6 · Settings & config',
  },
}

export default function StubPage({ pageId }: { pageId: string }) {
  const ctx = PAGE_CONTEXT[pageId] ?? {
    icon: '⬜',
    desc: 'This page is under construction.',
    sprint: 'Upcoming sprint',
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fadeIn">
      <div className="text-[48px] mb-4 opacity-30">{ctx.icon}</div>
      <h2 className="text-[18px] font-semibold mb-2 capitalize">{pageId.replace(/_/g, ' ')}</h2>
      <p className="text-muted text-[13px] text-center max-w-md leading-relaxed mb-4">{ctx.desc}</p>
      <span className={`${mono} text-[10px] px-3 py-1.5 rounded-full bg-panel border border-line text-dim`}>
        {ctx.sprint}
      </span>
    </div>
  )
}
