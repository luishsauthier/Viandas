import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchWeekDays } from '@/features/settings/api'
import {
  fetchOrdersForWeek,
  fetchParticipantProfiles,
  type OrderWithItems,
} from '@/features/orders/api'
import {
  fetchAdjustmentsForOrders,
  fetchWeeklyAccountsForWeek,
} from '@/features/billing/api'
import { buildChargeMessage } from '@/lib/billing/chargeMessage'
import { financialStatusLabel, financialStatusTone } from '@/lib/billing/status'
import { supabase, getAppBaseUrl } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency'
import { formatDateRangeBR, weekdayName } from '@/lib/dates'
import { formatOrderSummary } from '@/lib/orders/summary'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import type { OrderAdjustment, Profile, Week, WeekDay, WeeklyAccount } from '@/types'

export function AdminWeekPage() {
  const { weekId = '' } = useParams()
  const [week, setWeek] = useState<Week | null>(null)
  const [days, setDays] = useState<WeekDay[]>([])
  const [participants, setParticipants] = useState<Profile[]>([])
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [accounts, setAccounts] = useState<WeeklyAccount[]>([])
  const [adjustments, setAdjustments] = useState<OrderAdjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      if (!supabase || !weekId) return
      setLoading(true)
      try {
        const { data, error: weekError } = await supabase
          .from('weeks')
          .select('*')
          .eq('id', weekId)
          .maybeSingle()
        if (weekError) throw weekError
        if (!data) {
          setError('Semana não encontrada')
          setLoading(false)
          return
        }
        const nextWeek = data as Week
        const [weekDays, people, weekOrders, weekAccounts] = await Promise.all([
          fetchWeekDays(weekId),
          fetchParticipantProfiles(),
          fetchOrdersForWeek(weekId),
          fetchWeeklyAccountsForWeek(weekId),
        ])
        const orderIds = weekOrders.map((order) => order.id)
        const weekAdjustments = await fetchAdjustmentsForOrders(orderIds)
        setWeek(nextWeek)
        setDays(weekDays)
        setParticipants(people)
        setOrders(weekOrders)
        setAccounts(weekAccounts)
        setAdjustments(weekAdjustments)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar semana')
      } finally {
        setLoading(false)
      }
    })()
  }, [weekId])

  const rows = useMemo(() => {
    return participants.map((profile) => {
      const cells = days.map((day) => {
        const order = orders.find(
          (item) => item.week_day_id === day.id && item.profile_id === profile.id,
        )
        if (!order) return { day, label: 'Não respondeu', hasObs: false, amount: 0, order: null as OrderWithItems | null }
        if (order.response_status === 'declined') {
          return { day, label: 'Não pediu', hasObs: false, amount: 0, order }
        }
        const amount = order.items.reduce(
          (sum, item) => sum + item.quantity * Number(item.unit_price_snapshot),
          0,
        )
        return {
          day,
          label: formatOrderSummary(
            order.items.map((item) => ({
              code: item.meal_type?.code ?? '?',
              quantity: item.quantity,
            })),
          ),
          hasObs: Boolean(order.observation),
          amount,
          order,
        }
      })
      const weekTotal = cells.reduce((sum, cell) => sum + cell.amount, 0)
      const account = accounts.find((item) => item.profile_id === profile.id) ?? null
      return { profile, cells, weekTotal, account }
    })
  }, [participants, days, orders, accounts])

  const dayTotals = useMemo(() => {
    return days.map((day) => {
      const dayOrders = orders.filter(
        (order) => order.week_day_id === day.id && order.response_status === 'ordered',
      )
      const byCode: Record<string, number> = {}
      for (const order of dayOrders) {
        for (const item of order.items) {
          const code = item.meal_type?.code ?? '?'
          byCode[code] = (byCode[code] ?? 0) + item.quantity
        }
      }
      return { day, byCode }
    })
  }, [days, orders])

  const grossTotal = rows.reduce((sum, row) => sum + row.weekTotal, 0)
  const pendingTotal = accounts.reduce((sum, account) => {
    const balance = Number(account.balance_due)
    return sum + (balance > 0 ? balance : 0)
  }, 0)
  const receivedTotal = accounts.reduce(
    (sum, account) => sum + Number(account.payments_applied),
    0,
  )
  const orderedCount = orders.filter((order) => order.response_status === 'ordered').length

  async function copyCharge(profile: Profile) {
    const row = rows.find((item) => item.profile.id === profile.id)
    if (!row || !week) return
    const account = row.account
    const chargeDays = days.map((day) => {
      const order = orders.find(
        (item) => item.week_day_id === day.id && item.profile_id === profile.id,
      )
      const dayAdjustments =
        order?.response_status === 'ordered'
          ? adjustments
              .filter((adj) => adj.order_id === order.id)
              .map((adj) => ({ amount: Number(adj.amount), reason: adj.reason }))
          : []
      const items =
        order?.response_status === 'ordered'
          ? order.items.map((item) => ({
              code: item.meal_type?.code ?? '?',
              quantity: item.quantity,
            }))
          : []
      const amount =
        order?.response_status === 'ordered'
          ? order.items.reduce(
              (sum, item) => sum + item.quantity * Number(item.unit_price_snapshot),
              0,
            )
          : 0
      return { weekday: day.weekday, items, amount, adjustments: dayAdjustments }
    })

    const message = buildChargeMessage({
      employeeName: profile.name,
      status: account?.status ?? 'pending',
      chargesTotal: Number(account?.charges_total ?? row.weekTotal),
      adjustmentsTotal: Number(account?.adjustments_total ?? 0),
      creditApplied: Number(account?.credit_applied ?? 0),
      paymentsApplied: Number(account?.payments_applied ?? 0),
      balanceDue: Number(account?.balance_due ?? row.weekTotal),
      days: chargeDays,
      detailUrl: `${getAppBaseUrl()}/minha-semana/${week.id}`,
    })

    try {
      await navigator.clipboard.writeText(message)
      setCopyFeedback(`Cobrança de ${profile.name} copiada.`)
    } catch {
      setCopyFeedback('Não foi possível copiar automaticamente.')
    }
  }

  if (loading) return <p className="text-ink-muted">Carregando…</p>
  if (!week) {
    return (
      <div className="space-y-3">
        <p className="text-danger">{error || 'Semana não encontrada'}</p>
        <Link to="/admin" className="text-brand-700 hover:underline">
          Voltar ao dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin" className="text-sm font-medium text-brand-700 hover:underline">
          ← Dashboard
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-ink">
            Semana {formatDateRangeBR(week.start_date, week.end_date)}
          </h1>
          <StatusBadge tone={week.status === 'current' ? 'success' : 'neutral'}>
            {week.status === 'current' ? 'Atual' : week.status === 'open' ? 'Em aberto' : 'Encerrada'}
          </StatusBadge>
        </div>
      </div>

      {copyFeedback ? <p className="text-sm text-brand-800">{copyFeedback}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Pedidos" value={String(orderedCount)} />
        <SummaryCard label="Valor bruto" value={formatBRL(grossTotal)} />
        <SummaryCard label="Recebido" value={formatBRL(receivedTotal)} />
        <SummaryCard label="Pendente" value={formatBRL(pendingTotal)} />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          to={`/admin/cardapio/${week.id}`}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
        >
          Cardápio
        </Link>
      </div>

      <section className="hidden overflow-x-auto rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm lg:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-ink-muted">
              <th className="py-2 pr-3 font-medium">Funcionário</th>
              {days.map((day) => (
                <th key={day.id} className="px-2 py-2 font-medium">
                  <Link className="hover:underline" to={`/admin/dia/${day.id}`}>
                    {weekdayName(day.weekday, true)}
                  </Link>
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Semana</th>
              <th className="px-2 py-2 font-medium">Pago</th>
              <th className="px-2 py-2 font-medium">Saldo</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const status = row.account?.status ?? (row.weekTotal > 0 ? 'pending' : 'paid')
              const balance = Number(row.account?.balance_due ?? row.weekTotal)
              const paid = Number(row.account?.payments_applied ?? 0)
              return (
                <tr key={row.profile.id} className="border-b border-border/70">
                  <td className="py-3 pr-3 font-medium">{row.profile.name}</td>
                  {row.cells.map((cell) => (
                    <td key={cell.day.id} className="px-2 py-3">
                      <span>{cell.label}</span>
                      {cell.hasObs ? <span className="ml-1 text-brand-600">*</span> : null}
                    </td>
                  ))}
                  <td className="px-2 py-3 font-medium">{formatBRL(row.weekTotal)}</td>
                  <td className="px-2 py-3">{formatBRL(paid)}</td>
                  <td className="px-2 py-3">{formatBRL(balance)}</td>
                  <td className="px-2 py-3">
                    <StatusBadge tone={financialStatusTone(status)}>
                      {financialStatusLabel(status)}
                    </StatusBadge>
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="text-brand-700 hover:underline"
                      onClick={() => void copyCharge(row.profile)}
                    >
                      Copiar cobrança
                    </button>
                  </td>
                </tr>
              )
            })}
            <tr className="bg-brand-50/50 font-medium">
              <td className="py-3 pr-3">Totais</td>
              {dayTotals.map(({ day, byCode }) => (
                <td key={day.id} className="px-2 py-3 text-xs">
                  {Object.entries(byCode)
                    .map(([code, qty]) => `${qty}${code === 'SALADA' ? 'S' : code}`)
                    .join(' ') || '—'}
                </td>
              ))}
              <td className="px-2 py-3">{formatBRL(grossTotal)}</td>
              <td className="px-2 py-3">{formatBRL(receivedTotal)}</td>
              <td className="px-2 py-3">{formatBRL(pendingTotal)}</td>
              <td className="px-2 py-3">—</td>
              <td className="px-2 py-3">—</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3 lg:hidden">
        {rows.map((row) => {
          const open = expandedId === row.profile.id
          const status = row.account?.status ?? (row.weekTotal > 0 ? 'pending' : 'paid')
          const balance = Number(row.account?.balance_due ?? row.weekTotal)
          return (
            <article
              key={row.profile.id}
              className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm"
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setExpandedId(open ? null : row.profile.id)}
              >
                <div>
                  <p className="font-semibold text-ink">{row.profile.name}</p>
                  <p className="text-sm text-ink-muted">
                    {formatBRL(balance)} · {financialStatusLabel(status)}
                  </p>
                </div>
                <span className="text-sm text-brand-700">{open ? 'Ocultar' : 'Expandir'}</span>
              </button>
              {open ? (
                <div className="mt-3 space-y-3 border-t border-border pt-3 text-sm">
                  <ul className="space-y-2">
                    {row.cells.map((cell) => (
                      <li key={cell.day.id} className="flex justify-between gap-3">
                        <Link
                          to={`/admin/dia/${cell.day.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {weekdayName(cell.day.weekday, true)}
                        </Link>
                        <span>
                          {cell.label}
                          {cell.hasObs ? ' *' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50"
                    onClick={() => void copyCharge(row.profile)}
                  >
                    Copiar cobrança
                  </button>
                </div>
              ) : null}
            </article>
          )
        })}
      </section>
    </div>
  )
}

function SummaryCard({
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
