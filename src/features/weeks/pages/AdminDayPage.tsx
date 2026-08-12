import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchAppSettings } from '@/features/settings/api'
import { fetchMenuForWeekDay } from '@/features/menus/api'
import {
  adminSetDayStatus,
  adminUpsertOrder,
  fetchActiveMealTypes,
  fetchOrdersForDay,
  fetchParticipantProfiles,
  isOrderWindowOpen,
  type OrderWithItems,
} from '@/features/orders/api'
import { adminAddOrderAdjustment, fetchAdjustmentsForOrders } from '@/features/billing/api'
import { buildDailyWhatsAppMessage, buildRestaurantOrderMessage } from '@/lib/whatsapp'
import { getAppBaseUrl } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency'
import { formatDateBR, weekdayName } from '@/lib/dates'
import { formatOrderSummary } from '@/lib/orders/summary'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import type { MealType, MenuItem, OrderAdjustment, Profile, WeekDay } from '@/types'

export function AdminDayPage() {
  const { weekDayId = '' } = useParams()
  const [day, setDay] = useState<WeekDay | null>(null)
  const [items, setItems] = useState<MenuItem[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [closeTime, setCloseTime] = useState('10:30')
  const [openTime, setOpenTime] = useState('08:30')
  const [windowOpen, setWindowOpen] = useState(false)
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [participants, setParticipants] = useState<Profile[]>([])
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [restaurantCopyFeedback, setRestaurantCopyFeedback] = useState<string | null>(null)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState<Record<string, number>>({})
  const [editObs, setEditObs] = useState('')
  const [adjustments, setAdjustments] = useState<OrderAdjustment[]>([])
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [settings, menu, participantsRows, meals] = await Promise.all([
        fetchAppSettings(),
        fetchMenuForWeekDay(weekDayId),
        fetchParticipantProfiles(),
        fetchActiveMealTypes(),
      ])
      setOpenTime(settings.order_open_time.slice(0, 5))
      setCloseTime(settings.order_close_time.slice(0, 5))
      setParticipants(participantsRows)
      setMealTypes(meals)
      if (!menu) {
        setError('Dia não encontrado')
        setDay(null)
        return
      }
      setDay(menu.weekDay)
      setItems(menu.items)
      setConfirmed(menu.confirmed)
      const [open, dayOrders] = await Promise.all([
        isOrderWindowOpen(menu.weekDay.id),
        fetchOrdersForDay(menu.weekDay.id),
      ])
      setWindowOpen(open)
      setOrders(dayOrders)
      setDay(menu.weekDay)
      const dayAdjustments = await fetchAdjustmentsForOrders(dayOrders.map((order) => order.id))
      setAdjustments(dayAdjustments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dia')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDayId])

  const message = useMemo(() => {
    if (!day) return ''
    return buildDailyWhatsAppMessage({
      weekday: day.weekday,
      dateISO: day.date,
      items: items.map((item) => item.name),
      closeTime,
      orderUrl: `${getAppBaseUrl()}/pedido`,
    })
  }, [day, items, closeTime])

  const restaurantMessage = useMemo(() => {
    const ordered = orders.filter((order) => order.response_status === 'ordered')
    return buildRestaurantOrderMessage(
      ordered.map((order) => ({
        observation: order.observation,
        items: order.items.map((item) => ({
          code: item.meal_type?.code ?? '?',
          quantity: item.quantity,
        })),
      })),
    )
  }, [orders])

  const stats = useMemo(() => {
    const ordered = orders.filter((order) => order.response_status === 'ordered')
    const declined = orders.filter((order) => order.response_status === 'declined')
    const answeredIds = new Set(orders.map((order) => order.profile_id))
    const pending = participants.filter((profile) => !answeredIds.has(profile.id)).length
    const totals: Record<string, number> = {}
    for (const meal of mealTypes) totals[meal.code] = 0
    for (const order of ordered) {
      for (const item of order.items) {
        const code = item.meal_type?.code
        if (code) totals[code] = (totals[code] ?? 0) + item.quantity
      }
    }
    return {
      ordered: ordered.length,
      declined: declined.length,
      pending,
      totals,
    }
  }, [orders, participants, mealTypes])

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message)
      setCopyFeedback('Mensagem copiada.')
    } catch {
      setCopyFeedback('Não foi possível copiar automaticamente.')
    }
  }

  async function copyRestaurantOrder() {
    try {
      await navigator.clipboard.writeText(restaurantMessage)
      setRestaurantCopyFeedback('Pedido do restaurante copiado.')
    } catch {
      setRestaurantCopyFeedback('Não foi possível copiar automaticamente.')
    }
  }

  async function setStatus(status: WeekDay['status']) {
    if (!day) return
    setBusy(true)
    setError(null)
    try {
      const updated = await adminSetDayStatus(day.id, status)
      setDay(updated)
      setWindowOpen(await isOrderWindowOpen(day.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao alterar status')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(profile: Profile) {
    const existing = orders.find((order) => order.profile_id === profile.id)
    const next: Record<string, number> = {}
    for (const meal of mealTypes) next[meal.id] = 0
    if (existing?.response_status === 'ordered') {
      for (const item of existing.items) next[item.meal_type_id] = item.quantity
      setEditObs(existing.observation ?? '')
    } else {
      setEditObs('')
    }
    setEditQty(next)
    setEditingProfileId(profile.id)
    setAdjAmount('')
    setAdjReason('')
  }

  async function saveAdjustment() {
    if (!editingProfileId) return
    const order = orders.find(
      (item) => item.profile_id === editingProfileId && item.response_status === 'ordered',
    )
    if (!order) {
      setError('Só é possível ajustar pedidos confirmados')
      return
    }
    const amount = Number(adjAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount === 0) {
      setError('Informe um valor de ajuste diferente de zero')
      return
    }
    if (!adjReason.trim()) {
      setError('Informe a justificativa do ajuste')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminAddOrderAdjustment({
        orderId: order.id,
        amount,
        reason: adjReason.trim(),
      })
      setAdjAmount('')
      setAdjReason('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar ajuste')
    } finally {
      setBusy(false)
    }
  }

  async function saveAdminOrder(responseStatus: 'ordered' | 'declined') {
    if (!day || !editingProfileId) return
    setBusy(true)
    setError(null)
    try {
      await adminUpsertOrder({
        weekDayId: day.id,
        profileId: editingProfileId,
        responseStatus,
        items:
          responseStatus === 'ordered'
            ? mealTypes.map((meal) => ({
                meal_type_id: meal.id,
                quantity: editQty[meal.id] ?? 0,
              }))
            : [],
        observation: responseStatus === 'ordered' ? editObs : null,
      })
      setEditingProfileId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar pedido')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-ink-muted">Carregando…</p>
  if (!day) {
    return (
      <div className="space-y-3">
        <p className="text-danger">{error || 'Dia não encontrado'}</p>
        <Link to="/admin" className="text-brand-700 hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/admin/semana/${day.week_id}`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          ← Semana
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-ink">
            {weekdayName(day.weekday)} — {formatDateBR(day.date)}
          </h1>
          <StatusBadge>{day.status}</StatusBadge>
          <StatusBadge tone={windowOpen ? 'success' : 'warning'}>
            {windowOpen ? 'Janela aberta' : 'Janela fechada'}
          </StatusBadge>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Horário padrão: {openTime} – {closeTime}
        </p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pedidos" value={String(stats.ordered)} />
        <Stat label="Não pedirão" value={String(stats.declined)} />
        <Stat label="Sem resposta" value={String(stats.pending)} />
        <Stat
          label="Totais"
          value={mealTypes.map((meal) => `${stats.totals[meal.code] ?? 0}${meal.code === 'SALADA' ? 'S' : meal.code}`).join(' · ')}
        />
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void copyMessage()}
            className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Copiar mensagem do dia
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void copyRestaurantOrder()}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
          >
            Copiar pedido do restaurante
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void setStatus('reopened')}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
          >
            Reabrir pedidos
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void setStatus('closed')}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
          >
            Fechar pedidos
          </button>
          {day.status !== 'scheduled' ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void setStatus('scheduled')}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
            >
              Horário normal
            </button>
          ) : null}
          <Link
            to={`/admin/cardapio/${day.week_id}`}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
          >
            Editar cardápio
          </Link>
        </div>
        {copyFeedback ? <p className="mt-2 text-sm text-brand-800">{copyFeedback}</p> : null}
        {restaurantCopyFeedback ? (
          <p className="mt-2 text-sm text-brand-800">{restaurantCopyFeedback}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Pedido do restaurante</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Normais agrupados; pedidos com observação em linhas separadas.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-white p-4 text-sm whitespace-pre-wrap text-ink">
          {restaurantMessage}
        </pre>
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Cardápio</h2>
        <StatusBadge tone={confirmed && items.length > 0 ? 'success' : 'warning'}>
          {confirmed && items.length > 0 ? 'Confirmado' : 'Pendente'}
        </StatusBadge>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Sem itens.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {items.map((item) => (
              <li key={item.id}>• {item.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm overflow-x-auto">
        <h2 className="text-lg font-semibold text-ink">Pedidos do dia</h2>
        <table className="mt-4 w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-ink-muted">
              <th className="py-2 pr-3 font-medium">Funcionário</th>
              {mealTypes.map((meal) => (
                <th key={meal.id} className="px-2 py-2 font-medium">
                  {meal.code === 'SALADA' ? 'Salada' : meal.code}
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Observação</th>
              <th className="px-2 py-2 font-medium">Situação</th>
              <th className="px-2 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((profile) => {
              const order = orders.find((item) => item.profile_id === profile.id)
              return (
                <tr key={profile.id} className="border-b border-border/70">
                  <td className="py-3 pr-3 font-medium text-ink">{profile.name}</td>
                  {mealTypes.map((meal) => {
                    const qty =
                      order?.items.find((item) => item.meal_type_id === meal.id)?.quantity ?? 0
                    return (
                      <td key={meal.id} className="px-2 py-3">
                        {order?.response_status === 'ordered' ? qty : '—'}
                      </td>
                    )
                  })}
                  <td className="px-2 py-3 text-ink-muted">
                    <div>{order?.observation || '—'}</div>
                    {order?.response_status === 'ordered'
                      ? adjustments
                          .filter((adj) => adj.order_id === order.id)
                          .map((adj) => (
                            <div key={adj.id} className="mt-1 text-xs text-amber-800">
                              Ajuste {formatBRL(adj.amount)}: {adj.reason}
                            </div>
                          ))
                      : null}
                  </td>
                  <td className="px-2 py-3">
                    {!order
                      ? 'Não respondeu'
                      : order.response_status === 'declined'
                        ? 'Não pediu'
                        : formatOrderSummary(
                            order.items.map((item) => ({
                              code: item.meal_type?.code ?? '?',
                              quantity: item.quantity,
                            })),
                          )}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      className="text-brand-700 hover:underline"
                      onClick={() => startEdit(profile)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {editingProfileId ? (
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-ink">
            Editar pedido · {participants.find((p) => p.id === editingProfileId)?.name}
          </h3>
          {mealTypes.map((meal) => (
            <div key={meal.id} className="flex items-center justify-between gap-3">
              <span>{meal.name}</span>
              <input
                type="number"
                min={0}
                max={10}
                className="w-20 rounded-lg border border-border px-2 py-1"
                value={editQty[meal.id] ?? 0}
                onChange={(event) =>
                  setEditQty((prev) => ({
                    ...prev,
                    [meal.id]: Number(event.target.value),
                  }))
                }
              />
            </div>
          ))}
          <textarea
            className="min-h-20 w-full rounded-xl border border-border px-3 py-2"
            placeholder="Observação"
            value={editObs}
            onChange={(event) => setEditObs(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveAdminOrder('ordered')}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Salvar pedido
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveAdminOrder('declined')}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              Marcar não pediu
            </button>
            <button
              type="button"
              onClick={() => setEditingProfileId(null)}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium"
            >
              Cancelar
            </button>
          </div>

          {orders.find(
            (item) => item.profile_id === editingProfileId && item.response_status === 'ordered',
          ) ? (
            <div className="space-y-3 border-t border-border pt-4">
              <h4 className="font-medium text-ink">Ajuste financeiro do dia</h4>
              <p className="text-sm text-ink-muted">
                Valor positivo aumenta a cobrança; negativo reduz. Justificativa obrigatória.
              </p>
              <ul className="space-y-1 text-sm">
                {adjustments
                  .filter(
                    (adj) =>
                      adj.order_id ===
                      orders.find((item) => item.profile_id === editingProfileId)?.id,
                  )
                  .map((adj) => (
                    <li key={adj.id}>
                      {formatBRL(adj.amount)} — {adj.reason}
                    </li>
                  ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Valor (ex: 5 ou -2,50)"
                  className="rounded-xl border border-border px-3 py-2"
                  value={adjAmount}
                  onChange={(event) => setAdjAmount(event.target.value)}
                />
                <input
                  type="text"
                  placeholder="Justificativa"
                  className="rounded-xl border border-border px-3 py-2"
                  value={adjReason}
                  onChange={(event) => setAdjReason(event.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveAdjustment()}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
              >
                Adicionar ajuste
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
    </div>
  )
}
