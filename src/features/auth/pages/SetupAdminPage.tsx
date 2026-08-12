import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '@/features/auth/AuthProvider'
import { RedirectIfAuthenticated } from '@/features/auth/guards'
import { PhoneInput, PinInput } from '@/components/ui/MaskedInputs'

const schema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  phone: z.string().min(14, 'Informe o telefone completo'),
  pin: z.string().regex(/^\d{6}$/, 'PIN de 6 dígitos'),
  is_participant: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function SetupAdminPage() {
  return (
    <RedirectIfAuthenticated>
      <SetupAdminForm />
    </RedirectIfAuthenticated>
  )
}

function SetupAdminForm() {
  const { bootstrapAdmin } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      pin: '',
      is_participant: false,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      await bootstrapAdmin(values)
      navigate('/admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar administrador')
    }
  })

  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold tracking-wide text-brand-600 uppercase">
          Controle de Viandas
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Primeiro administrador</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Disponível apenas se ainda não existir nenhum admin neste projeto Supabase.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Nome</span>
            <input
              className="w-full rounded-xl border border-border bg-white px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
              {...register('name')}
            />
            {errors.name ? <span className="text-sm text-danger">{errors.name.message}</span> : null}
          </label>

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

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" {...register('is_participant')} />
            Também participa dos pedidos
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Criando…' : 'Criar administrador'}
          </button>
        </form>

        <p className="mt-4 text-sm">
          <Link className="font-medium text-brand-700 hover:underline" to="/login">
            Voltar ao login
          </Link>
        </p>
      </section>
    </div>
  )
}
