import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyCreditBalance, fetchMyWeeklyAccounts } from '@/features/billing/api'
import { financialStatusLabel, financialStatusTone } from '@/lib/billing/status'
import { formatBRL } from '@/lib/currency'
import { formatDateRangeBR } from '@/lib/dates'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import { EmptyState, ErrorBanner, LoadingState } from '@/components/common/PageStates'
import type { Week, WeeklyAccount } from '@/types'

type Row = WeeklyAccount & {
  week?: Pick<Week, 'id' | 'start_date' | 'end_date' | 'status'> | null
}

export function MyHistoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [credit, setCredit] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const [accounts, balance] = await Promise.all([
          fetchMyWeeklyAccounts(),
          fetchMyCreditBalance(),
        ])
        setRows(accounts)
        setCredit(balance)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar histórico')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <LoadingState label="Carregando histórico…" />
  if (error) return <ErrorBanner>{error}</ErrorBanner>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Meu histórico</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Contas semanais, saldos e crédito disponível.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          Crédito disponível
        </p>
        <p className="mt-1 text-xl font-semibold text-ink">{formatBRL(credit)}</p>
      </section>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma conta semanal ainda"
          description="Quando houver consumo, as semanas aparecerão aqui."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to={`/minha-semana/${row.week_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-elevated px-4 py-3 shadow-sm hover:bg-brand-50"
              >
                <div>
                  <p className="font-medium text-ink">
                    {row.week
                      ? formatDateRangeBR(row.week.start_date, row.week.end_date)
                      : row.week_id}
                  </p>
                  <p className="text-sm text-ink-muted">
                    Consumo {formatBRL(row.charges_total)}
                    {Number(row.credit_applied) > 0
                      ? ` · Crédito ${formatBRL(row.credit_applied)}`
                      : ''}
                    {Number(row.payments_applied) > 0
                      ? ` · Pagamentos ${formatBRL(row.payments_applied)}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatBRL(row.balance_due)}</span>
                  <StatusBadge tone={financialStatusTone(row.status)}>
                    {financialStatusLabel(row.status)}
                  </StatusBadge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
