import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { formatDateRangeBR } from '@/lib/dates'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import { EmptyState, ErrorBanner, LoadingState } from '@/components/common/PageStates'
import type { Week, WeekStatus } from '@/types'

type Filter = 'all' | WeekStatus

type WeekRow = Week & { pendingCount: number }

export function AdminHistoryPage() {
  const [rows, setRows] = useState<WeekRow[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      if (!supabase) return
      setLoading(true)
      setError(null)
      try {
        const { data: weeks, error: weeksError } = await supabase
          .from('weeks')
          .select('*')
          .order('start_date', { ascending: false })
        if (weeksError) throw weeksError
        const list = (weeks ?? []) as Week[]
        const withPending = await Promise.all(
          list.map(async (week) => {
            const { data: accounts, error: accountsError } = await supabase!
              .from('weekly_accounts')
              .select('balance_due')
              .eq('week_id', week.id)
              .gt('balance_due', 0)
            if (accountsError) throw accountsError
            return {
              ...week,
              pendingCount: (accounts ?? []).length,
            }
          }),
        )
        setRows(withPending)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar histórico')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    return rows.filter((row) => row.status === filter)
  }, [rows, filter])

  if (loading) return <LoadingState label="Carregando histórico…" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Histórico de semanas</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Semanas atuais, em aberto e encerradas, com pendências financeiras.
        </p>
      </div>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'Todas'],
            ['current', 'Atual'],
            ['open', 'Em aberto'],
            ['closed', 'Encerradas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={[
              'rounded-xl px-3 py-2 text-sm font-medium',
              filter === value
                ? 'bg-brand-600 text-white'
                : 'border border-border hover:bg-brand-50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma semana neste filtro"
          description="Crie uma semana no dashboard ou ajuste o filtro."
          action={
            <Link to="/admin" className="text-sm font-medium text-brand-700 hover:underline">
              Ir ao dashboard
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((week) => (
            <li key={week.id}>
              <Link
                to={`/admin/semana/${week.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated px-4 py-3 shadow-sm hover:bg-brand-50"
              >
                <div>
                  <p className="font-medium text-ink">
                    {formatDateRangeBR(week.start_date, week.end_date)}
                  </p>
                  {week.pendingCount > 0 ? (
                    <p className="text-sm text-amber-800">
                      {week.pendingCount} pendência{week.pendingCount > 1 ? 's' : ''} financeira
                      {week.pendingCount > 1 ? 's' : ''}
                    </p>
                  ) : (
                    <p className="text-sm text-ink-muted">Sem pendências</p>
                  )}
                </div>
                <StatusBadge
                  tone={
                    week.status === 'current'
                      ? 'success'
                      : week.status === 'open'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {week.status === 'current'
                    ? 'Atual'
                    : week.status === 'open'
                      ? 'Em aberto'
                      : 'Encerrada'}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
