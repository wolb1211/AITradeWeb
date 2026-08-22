import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

export function PageHeading({ eyebrow, title, description, action, className = '' }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`page-heading ${className}`.trim()}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  )
}

export function StatCard({ label, value, note, icon, tone = 'green' }: { label: string; value: string; note: string; icon: ReactNode; tone?: 'green' | 'blue' | 'amber' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

export function StatusPill({ children, tone = 'active' }: { children: ReactNode; tone?: 'active' | 'paused' | 'neutral' }) {
  return <span className={`status-pill status-${tone}`}><i />{children}</span>
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function TextLink({ children }: { children: ReactNode }) {
  return <span className="text-link">{children}<ChevronRight size={14} /></span>
}
