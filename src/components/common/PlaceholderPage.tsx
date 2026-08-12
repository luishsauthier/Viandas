import type { ReactNode } from 'react'

type PlaceholderPageProps = {
  title: string
  description: string
  phaseHint?: string
}

export function PlaceholderPage({
  title,
  description,
  phaseHint = 'Em breve.',
}: PlaceholderPageProps) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
        Controle de Viandas
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-muted">{description}</p>
      <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">{phaseHint}</p>
    </section>
  )
}

type BadgeProps = {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

const badgeToneClass: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-brand-50 text-brand-800',
  success: 'bg-brand-100 text-brand-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
}

export function StatusBadge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${badgeToneClass[tone]}`}
    >
      {children}
    </span>
  )
}
