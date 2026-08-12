import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthProvider'
import { RedirectIfAuthenticated } from '@/features/auth/guards'
import { PhoneInput, PinInput } from '@/components/ui/MaskedInputs'

const schema = z.object({
  phone: z.string().min(14, 'Informe o telefone completo'),
  pin: z.string().regex(/^\d{6}$/, 'PIN de 6 dígitos'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  return (
    <RedirectIfAuthenticated>
      <LoginForm />
    </RedirectIfAuthenticated>
  )
}

function LoginForm() {
  const { signInWithPhonePin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', pin: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const profile = await signInWithPhonePin(values.phone, values.pin)
      const from = (location.state as { from?: string } | null)?.from
      if (from) {
        navigate(from, { replace: true })
        return
      }
      navigate(profile.role === 'admin' ? '/admin' : '/pedido', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login')
    }
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
          Controle de Viandas
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Entrar</h1>
        <p className="mt-2 text-sm text-ink-muted">Use seu telefone e PIN de 6 dígitos.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Telefone</span>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
              )}
            />
            {errors.phone ? <span className="text-sm text-danger">{errors.phone.message}</span> : null}
          </label>

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

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-sm text-ink-muted">
          Esqueceu o PIN? Peça ao administrador para redefinir o acesso.
        </p>
      </section>
    </div>
  )
}
