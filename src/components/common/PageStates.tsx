import type { ReactNode } from 'react'
import { InteractiveRobot, RobotAttribution } from '@/components/rive/InteractiveRobot'

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return <p className="text-ink-muted">{label}</p>
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{children}</p>
}

export function SuccessBanner({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">{children}</p>
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-elevated/60 px-5 py-8 text-center">
      <InteractiveRobot className="mb-3" size={112} />
      <p className="font-semibold text-ink">{title}</p>
      {description ? <p className="mt-2 text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
      <RobotAttribution className="mt-4" />
    </div>
  )
}
