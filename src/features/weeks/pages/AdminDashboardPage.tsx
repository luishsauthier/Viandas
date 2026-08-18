import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  countActiveEmployees,
  createWeek,
  fetchAppSettings,
  fetchCurrentWeek,
  fetchMealTypes,
  fetchWeekDays,
} from '@/features/settings/api'
import { formatDateRangeBR, suggestWeekStartDate, timeInputFromDb, weekdayName } from '@/lib/dates'
import { formatBRL } from '@/lib/currency'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import { ErrorBanner, LoadingState, SuccessBanner } from '@/components/common/PageStates'
import type { AppSettings, MealType, Week, WeekDay } from '@/types'

type ChecklistItem = {
  id: string
  label: string
  done: boolean
  to: string
}

export function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [employeeCount, setEmployeeCount] = useState(0)
  const [currentWeek, setCurrentWeek] = useState<Week | null>(null)
  const [weekDays, setWeekDays] = useState<WeekDay[]>([])
  const [startDate, setStartDate] = useState(suggestWeekStartDate())
  const [creating, setCreating] = useState(false)
  const [pendingPayments, setPendingPayments] = useState(0)

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [nextSettings, meals, employees, week] = await Promise.all([
        fetchAppSettings(),
        fetchMealTypes(),
        countActiveEmployees(),
        fetchCurrentWeek(),
      ])
      setSettings(nextSettings)
      setMealTypes(meals)
      setEmployeeCount(employees)
      setCurrentWeek(week)
      if (week) {
        setWeekDays(await fetchWeekDays(week.id))
      } else {
        setWeekDays([])
      }
      if (supabase) {
        const { count } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        setPendingPayments(count ?? 0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!settings) return []
    const pricesConfigured = mealTypes.some((meal) => Number(meal.current_price) > 0)
    return [
      {
        id: 'restaurant',
        label: 'Configurar restaurante',
        done: Boolean(settings.restaurant_name.trim()),
        to: '/admin/configuracoes',
      },
      {
        id: 'pix',
        label: 'Configurar PIX',
        done: Boolean(
          settings.pix_key.trim() &&
            settings.pix_recipient_name.trim() &&
            settings.pix_city.trim(),
        ),
        to: '/admin/configuracoes',
      },
      {
        id: 'prices',
        label: 'Configurar preços',
        done: pricesConfigured,
        to: '/admin/configuracoes',
      },
      {
        id: 'employees',
        label: 'Cadastrar funcionários',
        done: employeeCount > 0,
        to: '/admin/funcionarios',
      },
      {
        id: 'week',
        label: 'Iniciar primeira semana',
        done: Boolean(currentWeek),
        to: '/admin',
      },
    ]
  }, [settings, mealTypes, employeeCount, currentWeek])

  const pendingSetup = checklist.filter((item) => !item.done)

  async function onCreateWeek() {
    setCreating(true)
    setError(null)
    setSuccess(null)
    try {
      const week = await createWeek(startDate)
      setSuccess(`Semana ${formatDateRangeBR(week.start_date, week.end_date)} iniciada.`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar semana')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <LoadingState label="Carregando dashboard…" />
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Visão inicial da semana e pendências de configuração.
        </p>
      </header>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}

      {pendingSetup.length > 0 ? (
        <Card title="Onboarding">
          <p className="text-sm text-ink-muted">
            Itens pendentes — a navegação permanece liberada.
          </p>
          <ul className="mt-3 space-y-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={item.done ? 'text-ink-muted line-through' : 'text-ink'}>
                  {item.label}
                </span>
                {item.done ? (
                  <StatusBadge tone="success">Pronto</StatusBadge>
                ) : (
                  <Link to={item.to} className="font-medium text-brand-700 hover:underline">
                    Configurar
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {pendingPayments > 0 ? (
        <Card title="Pagamentos">
          <p className="text-sm text-ink-muted">
            {pendingPayments} comprovante{pendingPayments > 1 ? 's' : ''} aguardando validação.
          </p>
          <Link
            to="/admin/pagamentos"
            className="mt-3 inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Revisar pagamentos
          </Link>
        </Card>
      ) : null}

      <Card title="Semana atual">
        {currentWeek ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-ink">
                {formatDateRangeBR(currentWeek.start_date, currentWeek.end_date)}
              </p>
              <StatusBadge tone="success">Atual</StatusBadge>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {weekDays.map((day) => (
                <Link
                  key={day.id}
                  to={`/admin/dia/${day.id}`}
                  className="rounded-xl border border-border bg-white px-3 py-3 hover:border-brand-400 hover:bg-brand-50"
                >
                  <p className="font-medium text-ink">
                    {weekdayName(day.weekday)} · {day.date.slice(8)}/{day.date.slice(5, 7)}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted capitalize">{statusLabel(day.status)}</p>
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/admin/semana/${currentWeek.id}`}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
              >
                Ver semana
              </Link>
              <Link
                to={`/admin/cardapio/${currentWeek.id}`}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
              >
                Cardápio
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">Nenhuma semana atual. Inicie uma nova semana.</p>
            <label className="block max-w-xs space-y-1.5">
              <span className="text-sm font-medium">Data inicial</span>
              <input
                type="date"
                className="w-full rounded-xl border border-border px-3 py-2.5"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={creating || !startDate}
              onClick={() => void onCreateWeek()}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {creating ? 'Criando…' : 'Iniciar nova semana'}
            </button>
          </div>
        )}
      </Card>

      {currentWeek ? (
        <Card title="Iniciar outra semana">
          <p className="text-sm text-ink-muted">
            Ao iniciar uma nova semana, a atual deixa de ser current e passa para open/closed
            conforme pendências financeiras.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Data inicial</span>
              <input
                type="date"
                className="rounded-xl border border-border px-3 py-2.5"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={creating || !startDate}
              onClick={() => void onCreateWeek()}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
            >
              {creating ? 'Criando…' : 'Iniciar nova semana'}
            </button>
          </div>
        </Card>
      ) : null}

      {settings ? (
        <Card title="Resumo rápido">
          <ul className="space-y-1 text-sm text-ink-muted">
            <li>
              Pedidos: {timeInputFromDb(settings.order_open_time)} –{' '}
              {timeInputFromDb(settings.order_close_time)}
            </li>
            <li>
              Dias ativos:{' '}
              {settings.active_weekdays.map((day) => weekdayName(Number(day), true)).join(', ')}
            </li>
            <li>
              Preços:{' '}
              {mealTypes
                .filter((meal) => meal.is_active)
                .map((meal) => `${meal.code} ${formatBRL(meal.current_price)}`)
                .join(' · ') || '—'}
            </li>
            <li>Funcionários ativos: {employeeCount}</li>
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function statusLabel(status: WeekDay['status']): string {
  switch (status) {
    case 'scheduled':
      return 'agendado'
    case 'open':
      return 'aberto'
    case 'closed':
      return 'fechado'
    case 'reopened':
      return 'reaberto'
  }
}
