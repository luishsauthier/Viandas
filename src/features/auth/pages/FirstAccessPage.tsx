import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthProvider'
import { RedirectIfAuthenticated } from '@/features/auth/guards'
import { PinInput } from '@/components/ui/MaskedInputs'

const schema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, 'PIN de 6 dígitos'),
    pinConfirm: z.string().regex(/^\d{6}$/, 'Confirme o PIN'),
  })
  .refine((values) => values.pin === values.pinConfirm, {
    message: 'Os PINs não conferem',
    path: ['pinConfirm'],
  })

type FormValues = z.infer<typeof schema>

export function FirstAccessPage() {
  return (
    <RedirectIfAuthenticated>
      <FirstAccessForm />
    </RedirectIfAuthenticated>
  )
}

function FirstAccessForm() {
  const { token = '' } = useParams()
  const { activateWithToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { pin: '', pinConfirm: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const profile = await activateWithToken({
        token,
        pin: values.pin,
        pinConfirm: values.pinConfirm,
      })
      navigate(profile.role === 'admin' ? '/admin' : '/pedido', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na ativação')
    }
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
          Controle de Viandas
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Primeiro acesso</h1>
        <p className="mt-2 text-sm text-ink-muted">Defina um PIN numérico de 6 dígitos.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">PIN</span>
            <Controller
              name="pin"
              control={control}
              render={({ field }) => (
                <PinInput value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
              )}
            />
            {errors.pin ? <span className="text-sm text-danger">{errors.pin.message}</span> : null}
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Confirmar PIN</span>
            <Controller
              name="pinConfirm"
              control={control}
              render={({ field }) => (
                <PinInput
                  confirm
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            {errors.pinConfirm ? (
              <span className="text-sm text-danger">{errors.pinConfirm.message}</span>
            ) : null}
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Ativando…' : 'Ativar conta'}
          </button>
        </form>
      </section>
    </div>
  )
}
