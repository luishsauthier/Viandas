import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchWeekDays } from '@/features/settings/api'
import { fetchOrdersForWeek, type OrderWithItems } from '@/features/orders/api'
import {
  fetchAdjustmentsForOrders,
  fetchMyCreditBalance,
  fetchMyWeeklyAccount,
  fetchWeekById,
  fetchWeeksForEmployee,
  applyMyAvailableCredit,
  recalculateMyWeeklyAccount,
} from '@/features/billing/api'
import { WeekPaymentPanel } from '@/features/payments/components/WeekPaymentPanel'
import { financialStatusLabel, financialStatusTone } from '@/lib/billing/status'
import { formatBRL } from '@/lib/currency'
import { formatDateRangeBR, weekdayName } from '@/lib/dates'
import { formatOrderSummary } from '@/lib/orders/summary'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import type { OrderAdjustment, Week, WeekDay, WeeklyAccount } from '@/types'

export function MyWeekPage() {
  const { weekId } = useParams()

  if (!weekId) {
    return <MyWeekList />
  }

  return <MyWeekDetail weekId={weekId} />
}

function MyWeekList() {
  const [weeks, setWeeks] = useState<Week[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        setWeeks(await fetchWeeksForEmployee())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar semanas')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <p className="text-ink-muted">Carregando…</p>
  if (error) return <p className="text-danger">{error}</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Minha semana</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Detalhamento de pedidos, ajustes e saldo. Pagamento PIX na próxima fase.
        </p>
      </div>
      {weeks.length === 0 ? (
        <p className="text-sm text-ink-muted">Nenhuma semana encontrada.</p>
      ) : (
        <ul className="space-y-3">
          {weeks.map((week) => (
            <li key={week.id}>
              <Link
                to={`/minha-semana/${week.id}`}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 shadow-sm hover:bg-brand-50"
              >
                <span className="font-medium text-ink">
                  {formatDateRangeBR(week.start_date, week.end_date)}
                </span>
                <StatusBadge tone={week.status === 'current' ? 'success' : 'neutral'}>
                  {week.status === 'current' ? 'Atual' : week.status === 'open' ? 'Aberta' : 'Encerrada'}
                </StatusBadge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MyWeekDetail({ weekId }: { weekId: string }) {
  const [week, setWeek] = useState<Week | null>(null)
  const [days, setDays] = useState<WeekDay[]>([])
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [adjustments, setAdjustments] = useState<OrderAdjustment[]>([])
  const [account, setAccount] = useState<WeeklyAccount | null>(null)
  const [creditBalance, setCreditBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const found = await fetchWeekById(weekId)
        if (!found) {
          setError('Semana não encontrada')
          setWeek(null)
          return
        }
        const [weekDays, weekOrders, existingAccount, credit] = await Promise.all([
          fetchWeekDays(weekId),
          fetchOrdersForWeek(weekId),
          fetchMyWeeklyAccount(weekId),
          fetchMyCreditBalance(),
        ])
        const myOrders = weekOrders
        const adjs = await fetchAdjustmentsForOrders(myOrders.map((order) => order.id))
        let nextAccount = existingAccount
        if (!nextAccount) {
          nextAccount = await recalculateMyWeeklyAccount(weekId)
        } else {
          nextAccount = await applyMyAvailableCredit(weekId)
        }
        setWeek(found)
        setDays(weekDays)
        setOrders(myOrders)
        setAdjustments(adjs)
        setAccount(nextAccount)
        setCreditBalance(credit)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar detalhamento')
      } finally {
        setLoading(false)
      }
    })()
  }, [weekId, reloadKey])

  const dayRows = useMemo(() => {
    return days.map((day) => {
      const order = orders.find((item) => item.week_day_id === day.id) ?? null
      const dayAdjustments = order
        ? adjustments.filter((adj) => adj.order_id === order.id)
        : []
      const amount =
        order?.response_status === 'ordered'
          ? order.items.reduce(
              (sum, item) => sum + item.quantity * Number(item.unit_price_snapshot),
              0,
            )
          : 0
      return { day, order, amount, dayAdjustments }
    })
  }, [days, orders, adjustments])

  if (loading) return <p className="text-ink-muted">Carregando…</p>
  if (!week) {
    return (
      <div className="space-y-3">
        <p className="text-danger">{error || 'Semana não encontrada'}</p>
        <Link to="/minha-semana" className="text-brand-700 hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  const status = account?.status ?? 'paid'
  const charges = Number(account?.charges_total ?? 0)
  const adjTotal = Number(account?.adjustments_total ?? 0)
  const credit = Number(account?.credit_applied ?? 0)
  const payments = Number(account?.payments_applied ?? 0)
  const balance = Number(account?.balance_due ?? 0)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/minha-semana" className="text-sm font-medium text-brand-700 hover:underline">
          ← Minhas semanas
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-ink">
            Semana {formatDateRangeBR(week.start_date, week.end_date)}
          </h1>
          <StatusBadge tone={financialStatusTone(status)}>
            {financialStatusLabel(status)}
          </StatusBadge>
        </div>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        <Summary label="Consumo" value={formatBRL(charges)} />
        <Summary label="Ajustes" value={formatBRL(adjTotal)} />
        <Summary label="Crédito aplicado" value={formatBRL(credit)} />
        <Summary label="Pagamentos" value={formatBRL(payments)} />
        <Summary label="Saldo da semana" value={formatBRL(balance)} />
        <Summary label="Crédito disponível" value={formatBRL(creditBalance)} />
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Pedidos por dia</h2>
        <ul className="mt-4 space-y-3">
          {dayRows.map(({ day, order, amount, dayAdjustments }) => (
            <li
              key={day.id}
              className="rounded-xl border border-border bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">
                    {weekdayName(day.weekday)} · {day.date.split('-').reverse().join('/')}
                  </p>
                  <p className="mt-1 text-ink-muted">
                    {!order
                      ? 'Sem resposta'
                      : order.response_status === 'declined'
                        ? 'Não pediu'
                        : formatOrderSummary(
                            order.items.map((item) => ({
                              code: item.meal_type?.code ?? '?',
                              quantity: item.quantity,
                            })),
                          )}
                  </p>
                  {order?.observation ? (
                    <p className="mt-1 text-xs text-ink-muted">Obs.: {order.observation}</p>
                  ) : null}
                  {dayAdjustments.map((adj) => (
                    <p key={adj.id} className="mt-1 text-xs text-amber-800">
                      Ajuste {formatBRL(adj.amount)} — {adj.reason}
                    </p>
                  ))}
                </div>
                <p className="font-medium text-ink">
                  {order?.response_status === 'ordered' ? formatBRL(amount) : '—'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {balance > 0 || status === 'waiting_validation' || status === 'partial' ? (
        <WeekPaymentPanel
          weekId={week.id}
          weekStartDate={week.start_date}
          weekEndDate={week.end_date}
          balanceDue={Math.max(balance, 0)}
          onSubmitted={() => setReloadKey((value) => value + 1)}
        />
      ) : null}
    </div>
  )
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}
