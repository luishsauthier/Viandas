import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { EmptyState, ErrorBanner, LoadingState } from '@/components/common/PageStates'

type AuditRow = {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: { name: string } | null
}

export function AdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      if (!supabase) return
      setLoading(true)
      try {
        const { data, error: loadError } = await supabase
          .from('audit_logs')
          .select('*, actor:profiles!actor_id(name)')
          .order('created_at', { ascending: false })
          .limit(80)
        if (loadError) throw loadError
        setRows((data ?? []) as AuditRow[])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar auditoria')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <LoadingState label="Carregando auditoria…" />

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/historico" className="text-sm font-medium text-brand-700 hover:underline">
          ← Histórico
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">Auditoria</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Últimas ações administrativas e financeiras registradas.
        </p>
      </div>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      {rows.length === 0 ? (
        <EmptyState title="Nenhum evento ainda" description="Ações relevantes aparecerão aqui." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{row.action}</p>
                  <p className="text-ink-muted">
                    {row.entity_type}
                    {row.actor?.name ? ` · ${row.actor.name}` : ''}
                  </p>
                </div>
                <p className="text-xs text-ink-muted">
                  {new Date(row.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              {row.metadata ? (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2 text-xs text-ink-muted">
                  {JSON.stringify(row.metadata)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
