import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { fetchAppSettings } from '@/features/settings/api'
import { fetchTodayMenu } from '@/features/menus/api'
import {
  declineDailyOrder,
  fetchActiveMealTypes,
  fetchMyOrderForDay,
  fetchMyRecentOrderedOrders,
  isOrderWindowOpen,
  submitDailyOrder,
  updateMyDefaultOrder,
  type OrderWithItems,
} from '@/features/orders/api'
import { DefaultOrderPrompt } from '@/features/orders/components/DefaultOrderPrompt'
import { formatDateBR, weekdayName } from '@/lib/dates'
import {
  formatOrderSummary,
  isSameOrderItems,
  orderItemsFingerprint,
  orderStatusLabel,
  singleMealDefaultFromItems,
  validateOrderQuantities,
} from '@/lib/orders/summary'
import { APP_LIMITS } from '@/lib/constants'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import type { MealType, MenuItem, WeekDay } from '@/types'

export function DailyOrderPage() {
  const { profile, isAdmin, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [weekDay, setWeekDay] = useState<WeekDay | null>(null)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [menuConfirmed, setMenuConfirmed] = useState(false)
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [observation, setObservation] = useState('')
  const [windowOpen, setWindowOpen] = useState(false)
  const [myOrder, setMyOrder] = useState<OrderWithItems | null>(null)
  const [closeTime, setCloseTime] = useState('10:30')
  const [defaultPrompt, setDefaultPrompt] = useState<{
    summary: string
    mealTypeId: string
    quantity: number
    fingerprint: string
  } | null>(null)
  const [defaultPromptBusy, setDefaultPromptBusy] = useState(false)

  function dismissedKey(fingerprint: string) {
    return `viandas:default-order-dismissed:${fingerprint}`
  }

  async function maybeSuggestDefaultOrder() {
    if (!profile) return
    try {
      const recent = await fetchMyRecentOrderedOrders(3)
      if (recent.length < 3) return

      const itemSets = recent.map((order) =>
        order.items.map((item) => ({
          meal_type_id: item.meal_type_id,
          quantity: item.quantity,
        })),
      )
      const [first, second, third] = itemSets
      if (!first || !second || !third) return
      if (!isSameOrderItems(first, second) || !isSameOrderItems(first, third)) return

      const asDefault = singleMealDefaultFromItems(first)
      if (!asDefault) return

      // Já é o padrão atual
      if (
        profile.default_meal_type_id === asDefault.mealTypeId &&
        (profile.default_quantity || 1) === asDefault.quantity
      ) {
        return
      }

      const fingerprint = orderItemsFingerprint(first)
      if (localStorage.getItem(dismissedKey(fingerprint)) === '1') return

      const mealFromOrder = recent[0]?.items.find(
        (item) => item.meal_type_id === asDefault.mealTypeId,
      )?.meal_type
      const meal = mealFromOrder ?? mealTypes.find((item) => item.id === asDefault.mealTypeId)
      const summary = meal
        ? formatOrderSummary([{ code: meal.code, quantity: asDefault.quantity }])
        : 'este pedido'

      setDefaultPrompt({
        summary,
        mealTypeId: asDefault.mealTypeId,
        quantity: asDefault.quantity,
        fingerprint,
      })
    } catch {
      // Silencioso: sugestão não deve quebrar o fluxo do pedido
    }
  }

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const settings = await fetchAppSettings()
      setCloseTime(settings.order_close_time.slice(0, 5))
      const [today, meals] = await Promise.all([
        fetchTodayMenu(settings.timezone),
        fetchActiveMealTypes(),
      ])
      setWeekDay(today?.weekDay ?? null)
      setMenuItems(today?.items ?? [])
      setMenuConfirmed(Boolean(today?.confirmed))
      setMealTypes(meals)

      if (today?.weekDay) {
        const [open, order] = await Promise.all([
          isOrderWindowOpen(today.weekDay.id),
          fetchMyOrderForDay(today.weekDay.id),
        ])
        setWindowOpen(open)
        setMyOrder(order)
        const nextQty: Record<string, number> = {}
        for (const meal of meals) nextQty[meal.id] = 0
        if (order?.response_status === 'ordered') {
          for (const item of order.items) {
            nextQty[item.meal_type_id] = item.quantity
          }
          setObservation(order.observation ?? '')
        } else {
          // Sem pedido confirmado: já vem com o pedido padrão selecionado
          if (profile?.default_meal_type_id) {
            const defaultMeal = meals.find((meal) => meal.id === profile.default_meal_type_id)
            if (defaultMeal) {
              nextQty[defaultMeal.id] = profile.default_quantity || 1
            }
          }
          setObservation('')
        }
        setQuantities(nextQty)
      } else {
        setWindowOpen(false)
        setMyOrder(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar o dia')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.default_meal_type_id, profile?.default_quantity])

  const defaultLabel = useMemo(() => {
    if (!profile?.default_meal_type_id) return null
    const meal = mealTypes.find((item) => item.id === profile.default_meal_type_id)
    if (!meal) return null
    return formatOrderSummary([
      { code: meal.code, quantity: profile.default_quantity || 1 },
    ])
  }, [profile, mealTypes])

  const responseStatus: 'none' | 'ordered' | 'declined' = !myOrder
    ? 'none'
    : myOrder.response_status
  const canEdit = Boolean(weekDay) && (windowOpen || isAdmin)

  function bump(mealId: string, delta: number) {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min(APP_LIMITS.maxQuantityPerMealType, (prev[mealId] ?? 0) + delta))
      return { ...prev, [mealId]: next }
    })
  }

  async function confirmOrder(nextQuantities = quantities, nextObservation = observation) {
    if (!weekDay) return
    const items = mealTypes.map((meal) => ({
      meal_type_id: meal.id,
      quantity: nextQuantities[meal.id] ?? 0,
    }))
    const validation = validateOrderQuantities(items)
    if (!validation.ok) {
      setError(validation.error)
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await submitDailyOrder({
        weekDayId: weekDay.id,
        items,
        observation: nextObservation,
      })
      setSuccess(responseStatus === 'ordered' ? 'Pedido atualizado.' : 'Pedido confirmado.')
      await reload()
      await maybeSuggestDefaultOrder()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao confirmar pedido')
    } finally {
      setSaving(false)
    }
  }

  async function acceptDefaultPrompt() {
    if (!defaultPrompt) return
    setDefaultPromptBusy(true)
    try {
      await updateMyDefaultOrder({
        defaultMealTypeId: defaultPrompt.mealTypeId,
        defaultQuantity: defaultPrompt.quantity,
      })
      await refreshProfile()
      setDefaultPrompt(null)
      setSuccess('Pedido padrão atualizado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar pedido padrão')
    } finally {
      setDefaultPromptBusy(false)
    }
  }

  function dismissDefaultPrompt() {
    if (defaultPrompt) {
      localStorage.setItem(dismissedKey(defaultPrompt.fingerprint), '1')
    }
    setDefaultPrompt(null)
  }

  async function decline() {
    if (!weekDay) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await declineDailyOrder(weekDay.id)
      setSuccess('Registrado: não vai pedir hoje.')
      await reload()
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-ink-muted">Carregando pedido do dia…</p>

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header className="space-y-2">
        <p className="text-sm text-ink-muted">Olá, {profile?.name}</p>
        <h1 className="text-2xl font-bold text-ink">
          {weekDay
            ? `${weekdayName(weekDay.weekday)} — ${formatDateBR(weekDay.date)}`
            : 'Hoje'}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={windowOpen ? 'success' : 'danger'}>
            {windowOpen ? `Pedidos abertos até ${closeTime}` : 'Pedidos fechados'}
          </StatusBadge>
          <StatusBadge
            tone={
              responseStatus === 'ordered'
                ? 'success'
                : responseStatus === 'declined'
                  ? 'warning'
                  : 'neutral'
            }
          >
            {orderStatusLabel(responseStatus)}
          </StatusBadge>
        </div>
        {!windowOpen && !isAdmin ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
            A janela de pedidos está fechada. Se precisar alterar, peça ao administrador para
            reabrir o dia.
          </p>
        ) : null}
        {!windowOpen && isAdmin ? (
          <p className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-900">
            Janela fechada para funcionários. Como admin, você ainda pode alterar este pedido.
          </p>
        ) : null}
      </header>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {success ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">{success}</p>
      ) : null}

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">Cardápio</h2>
          {weekDay ? (
            <StatusBadge tone={menuConfirmed && menuItems.length > 0 ? 'success' : 'warning'}>
              {menuConfirmed && menuItems.length > 0 ? 'Disponível' : 'Pendente'}
            </StatusBadge>
          ) : null}
        </div>
        {!weekDay ? (
          <p className="mt-3 text-sm text-ink-muted">Não há dia ativo para hoje.</p>
        ) : menuItems.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Cardápio ainda não cadastrado para hoje.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {menuItems.map((item) => (
              <li key={item.id} className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink">
                {item.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {weekDay && profile?.is_participant ? (
        <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-ink">Pedido</h2>
          {responseStatus === 'ordered' && canEdit ? (
            <p className="text-sm text-ink-muted">
              Pedido já confirmado. Ajuste as quantidades ou a observação e salve a alteração.
            </p>
          ) : null}
          {defaultLabel && responseStatus !== 'ordered' ? (
            <p className="text-sm text-ink-muted">
              Pedido padrão pré-selecionado: <span className="font-medium text-ink">{defaultLabel}</span>
              . Ajuste se quiser e confirme.
            </p>
          ) : null}

          <div className="space-y-3">
            {mealTypes.map((meal) => (
              <div key={meal.id} className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink">{meal.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!canEdit || saving}
                    onClick={() => bump(meal.id, -1)}
                    className="size-10 rounded-lg border border-border text-lg disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold">{quantities[meal.id] ?? 0}</span>
                  <button
                    type="button"
                    disabled={!canEdit || saving}
                    onClick={() => bump(meal.id, 1)}
                    className="size-10 rounded-lg border border-border text-lg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Observação para o restaurante</span>
            <textarea
              className="min-h-24 w-full rounded-xl border border-border px-3 py-2.5 outline-none ring-brand-500 focus:ring-2 disabled:opacity-50"
              placeholder="Ex.: sem massa, colocar mais salada"
              maxLength={APP_LIMITS.maxObservationLength}
              disabled={!canEdit || saving}
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
            />
            <span className="text-xs text-ink-muted">
              {observation.length}/{APP_LIMITS.maxObservationLength}
            </span>
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!canEdit || saving}
              onClick={() => void confirmOrder()}
              className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving
                ? 'Salvando…'
                : responseStatus === 'ordered'
                  ? 'Salvar alteração'
                  : 'Confirmar pedido'}
            </button>
            <button
              type="button"
              disabled={!canEdit || saving}
              onClick={() => void decline()}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-brand-50 disabled:opacity-60"
            >
              Não vou pedir hoje
            </button>
          </div>

          {!canEdit ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950">
              Pedidos fechados — alterações só após o administrador reabrir o dia.
            </p>
          ) : null}
        </section>
      ) : profile && !profile.is_participant ? (
        <p className="rounded-xl border border-border bg-white p-4 text-sm text-ink-muted">
          Seu perfil não participa dos pedidos.
          {profile.role === 'admin'
            ? ' Em Funcionários → seu usuário, marque “Participa dos pedidos”.'
            : ''}
        </p>
      ) : null}

      {defaultPrompt ? (
        <DefaultOrderPrompt
          summary={defaultPrompt.summary}
          busy={defaultPromptBusy}
          onAccept={() => void acceptDefaultPrompt()}
          onDismiss={dismissDefaultPrompt}
        />
      ) : null}
    </div>
  )
}
