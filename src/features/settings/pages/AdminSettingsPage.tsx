import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  fetchAppSettings,
  fetchMealTypes,
  updateAppSettings,
  updateMealType,
} from '@/features/settings/api'
import { formatBRL } from '@/lib/currency'
import { timeDbFromInput, timeInputFromDb, weekdayName } from '@/lib/dates'
import { timezoneSelectOptions } from '@/lib/constants'
import {
  PIX_DESCRIPTION_VARIABLES,
  previewPixDescriptionTemplate,
} from '@/lib/pix/descriptionTemplate'
import { PhoneInput } from '@/components/ui/MaskedInputs'
import { maskPhoneBR } from '@/lib/phone'
import type { AppSettings, MealType } from '@/types'

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

const settingsSchema = z
  .object({
    app_name: z.string().min(2, 'Informe o nome'),
    timezone: z.string().min(1),
    restaurant_name: z.string(),
    restaurant_phone: z.string(),
    restaurant_notes: z.string(),
    pix_key: z.string(),
    pix_recipient_name: z.string(),
    pix_city: z.string(),
    pix_description: z.string(),
    order_open_time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
    order_close_time: z.string().regex(/^\d{2}:\d{2}$/, 'Horário inválido'),
    active_weekdays: z.array(z.number()).min(1, 'Selecione ao menos um dia'),
  })
  .refine((values) => values.order_open_time < values.order_close_time, {
    message: 'Abertura deve ser antes do fechamento',
    path: ['order_close_time'],
  })

type SettingsForm = z.infer<typeof settingsSchema>

export function AdminSettingsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [mealTypes, setMealTypes] = useState<MealType[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [savingMealId, setSavingMealId] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
  })

  const activeWeekdays = watch('active_weekdays') ?? []
  const currentTimezone = watch('timezone')
  const pixDescription = watch('pix_description') ?? ''
  const timezoneOptions = useMemo(
    () => timezoneSelectOptions(currentTimezone),
    [currentTimezone],
  )
  const pixDescriptionPreview = useMemo(
    () => previewPixDescriptionTemplate(pixDescription),
    [pixDescription],
  )

  function insertPixVariable(token: string) {
    const current = pixDescription
    const next = current.trim().length === 0 ? token : `${current.trim()} ${token}`
    setValue('pix_description', next, { shouldDirty: true })
  }

  useEffect(() => {
    void (async () => {
      try {
        const [settings, meals] = await Promise.all([fetchAppSettings(), fetchMealTypes()])
        reset(toFormValues(settings))
        setMealTypes(meals)
        setPriceDrafts(
          Object.fromEntries(meals.map((meal) => [meal.id, String(meal.current_price)])),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar configurações')
      } finally {
        setLoading(false)
      }
    })()
  }, [reset])

  const onSaveSettings = handleSubmit(async (values) => {
    if (!profile) return
    setError(null)
    setSuccess(null)
    try {
      const updated = await updateAppSettings(
        {
          app_name: values.app_name.trim(),
          timezone: values.timezone.trim(),
          restaurant_name: values.restaurant_name.trim(),
          restaurant_phone: values.restaurant_phone.trim() || null,
          restaurant_notes: values.restaurant_notes.trim() || null,
          pix_key: values.pix_key.trim(),
          pix_recipient_name: values.pix_recipient_name.trim(),
          pix_city: values.pix_city.trim(),
          pix_description: values.pix_description.trim() || null,
          order_open_time: timeDbFromInput(values.order_open_time),
          order_close_time: timeDbFromInput(values.order_close_time),
          active_weekdays: values.active_weekdays,
        },
        profile.id,
      )
      reset(toFormValues(updated))
      setSuccess('Configurações salvas.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar')
    }
  })

  function toggleWeekday(day: number) {
    const current = new Set(activeWeekdays)
    if (current.has(day)) current.delete(day)
    else current.add(day)
    setValue('active_weekdays', Array.from(current).sort((a, b) => a - b), {
      shouldValidate: true,
    })
  }

  async function saveMealPrice(meal: MealType) {
    setSavingMealId(meal.id)
    setError(null)
    setSuccess(null)
    try {
      const raw = priceDrafts[meal.id] ?? '0'
      const price = Number(raw.replace(',', '.'))
      if (Number.isNaN(price) || price < 0) {
        throw new Error(`Preço inválido para ${meal.name}`)
      }
      const updated = await updateMealType(meal.id, {
        current_price: price,
      })
      setMealTypes((prev) => prev.map((item) => (item.id === meal.id ? updated : item)))
      setSuccess(`Preço de ${meal.name} atualizado.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar preço')
    } finally {
      setSavingMealId(null)
    }
  }

  async function toggleMealActive(meal: MealType) {
    setSavingMealId(meal.id)
    setError(null)
    try {
      const updated = await updateMealType(meal.id, { is_active: !meal.is_active })
      setMealTypes((prev) => prev.map((item) => (item.id === meal.id ? updated : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar tipo')
    } finally {
      setSavingMealId(null)
    }
  }

  if (loading) {
    return <p className="text-ink-muted">Carregando configurações…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink">Configurações</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Restaurante, PIX, horários, dias ativos e preços atuais.
        </p>
      </header>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {success ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">{success}</p>
      ) : null}

      <form className="space-y-6" onSubmit={onSaveSettings}>
        <Section title="Aplicação">
          <Field label="Nome de exibição" error={errors.app_name?.message}>
            <input className={inputClass} {...register('app_name')} />
          </Field>
          <Field label="Timezone" error={errors.timezone?.message}>
            <select className={inputClass} {...register('timezone')}>
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section title="Restaurante">
          <Field label="Nome">
            <input className={inputClass} {...register('restaurant_name')} />
          </Field>
          <Field label="Telefone (opcional)">
            <Controller
              name="restaurant_phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </Field>
          <Field label="Observações internas (opcional)">
            <textarea className={`${inputClass} min-h-24`} {...register('restaurant_notes')} />
          </Field>
        </Section>

        <Section title="PIX">
          <Field label="Chave PIX">
            <input className={inputClass} {...register('pix_key')} />
          </Field>
          <Field label="Nome do favorecido">
            <input className={inputClass} {...register('pix_recipient_name')} />
          </Field>
          <Field label="Cidade">
            <input className={inputClass} {...register('pix_city')} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">Descrição padrão (opcional)</span>
            <input
              className={inputClass}
              placeholder="Viandas {{nome}} {{semana}}"
              {...register('pix_description')}
            />
            <div className="flex flex-wrap gap-2">
              {PIX_DESCRIPTION_VARIABLES.map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  onClick={() => insertPixVariable(variable.token)}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-brand-50"
                  title={`Ex.: ${variable.example}`}
                >
                  {variable.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              Variáveis viram texto no QR do funcionário. Prévia:{' '}
              <span className="font-medium text-ink">
                {pixDescriptionPreview || '—'}
              </span>
            </p>
          </div>
        </Section>

        <Section title="Horários dos pedidos">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Abertura" error={errors.order_open_time?.message}>
              <input type="time" className={inputClass} {...register('order_open_time')} />
            </Field>
            <Field label="Fechamento" error={errors.order_close_time?.message}>
              <input type="time" className={inputClass} {...register('order_close_time')} />
            </Field>
          </div>
        </Section>

        <Section title="Dias ativos">
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_OPTIONS.map((day) => {
              const selected = activeWeekdays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(day)}
                  className={[
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    selected
                      ? 'bg-brand-600 text-white'
                      : 'border border-border bg-white text-ink-muted hover:bg-brand-50',
                  ].join(' ')}
                >
                  {weekdayName(day, true)}
                </button>
              )
            })}
          </div>
          {errors.active_weekdays ? (
            <p className="mt-2 text-sm text-danger">{errors.active_weekdays.message}</p>
          ) : null}
        </Section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </form>

      <Section title="Tipos e preços">
        <p className="mb-4 text-sm text-ink-muted">
          Alterar o preço atual não muda pedidos históricos (o valor fica gravado no pedido).
        </p>
        <div className="space-y-3">
          {mealTypes.map((meal) => (
            <div
              key={meal.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-ink">
                  {meal.code.toLowerCase() === meal.name.toLowerCase()
                    ? meal.name
                    : `${meal.code} · ${meal.name}`}
                </p>
                <p className="text-sm text-ink-muted">
                  Atual: {formatBRL(meal.current_price)} ·{' '}
                  {meal.is_active ? 'Ativo' : 'Inativo'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
                  value={priceDrafts[meal.id] ?? ''}
                  onChange={(event) =>
                    setPriceDrafts((prev) => ({ ...prev, [meal.id]: event.target.value }))
                  }
                  inputMode="decimal"
                />
                <button
                  type="button"
                  disabled={savingMealId === meal.id}
                  onClick={() => void saveMealPrice(meal)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
                >
                  Salvar preço
                </button>
                <button
                  type="button"
                  disabled={savingMealId === meal.id}
                  onClick={() => void toggleMealActive(meal)}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
                >
                  {meal.is_active ? 'Inativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function toFormValues(settings: AppSettings): SettingsForm {
  return {
    app_name: settings.app_name,
    timezone: settings.timezone,
    restaurant_name: settings.restaurant_name,
    restaurant_phone: settings.restaurant_phone ? maskPhoneBR(settings.restaurant_phone) : '',
    restaurant_notes: settings.restaurant_notes ?? '',
    pix_key: settings.pix_key,
    pix_recipient_name: settings.pix_recipient_name,
    pix_city: settings.pix_city,
    pix_description: settings.pix_description ?? '',
    order_open_time: timeInputFromDb(settings.order_open_time),
    order_close_time: timeInputFromDb(settings.order_close_time),
    active_weekdays: settings.active_weekdays.map(Number),
  }
}

const inputClass =
  'w-full rounded-xl border border-border bg-white px-3 py-2.5 outline-none ring-brand-500 focus:ring-2'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </label>
  )
}
