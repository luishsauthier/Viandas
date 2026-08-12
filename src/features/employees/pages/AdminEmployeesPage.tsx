import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { formatPhoneBR } from '@/lib/phone'
import type { Profile } from '@/types'
import { invokeCreateActivation, invokeCreateEmployee } from '@/features/auth/api'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from '@/components/common/PageStates'
import { PhoneInput } from '@/components/ui/MaskedInputs'

const createSchema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  phone: z.string().min(14, 'Informe o telefone completo'),
  role: z.enum(['employee', 'admin']),
  is_participant: z.boolean(),
})

type CreateValues = z.infer<typeof createSchema>

export function AdminEmployeesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [participantFilter, setParticipantFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      phone: '',
      role: 'employee',
      is_participant: true,
    },
  })

  const loadProfiles = async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { data, error: loadError } = await supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true })
    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }
    setProfiles((data ?? []) as Profile[])
    setLoading(false)
  }

  useEffect(() => {
    void loadProfiles()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return profiles.filter((profile) => {
      if (statusFilter === 'active' && !profile.is_active) return false
      if (statusFilter === 'inactive' && profile.is_active) return false
      if (participantFilter === 'yes' && !profile.is_participant) return false
      if (participantFilter === 'no' && profile.is_participant) return false
      if (!q) return true
      return (
        profile.name.toLowerCase().includes(q) ||
        profile.phone.includes(q) ||
        formatPhoneBR(profile.phone).includes(q)
      )
    })
  }, [profiles, query, statusFilter, participantFilter])

  const onCreate = handleSubmit(async (values) => {
    setError(null)
    setSuccess(null)
    setInviteMessage(null)
    try {
      const result = await invokeCreateEmployee(values)
      setInviteMessage(result.inviteMessage)
      setSuccess('Funcionário cadastrado. Copie o convite abaixo.')
      reset({ name: '', phone: '', role: 'employee', is_participant: true })
      await loadProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao cadastrar')
    }
  })

  async function copyInvite(profileId: string) {
    const current = profiles.find((item) => item.id === profileId)
    if (current?.activated_at) {
      setError('Conta já ativada. Use Redefinir acesso.')
      return
    }
    setBusyId(profileId)
    setError(null)
    setSuccess(null)
    try {
      const result = await invokeCreateActivation({
        profileId,
        resetCredentials: false,
      })
      await navigator.clipboard.writeText(result.inviteMessage)
      setInviteMessage(result.inviteMessage)
      setSuccess('Convite copiado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar convite')
    } finally {
      setBusyId(null)
    }
  }

  async function resetAccess(profileId: string) {
    setBusyId(profileId)
    setError(null)
    setSuccess(null)
    try {
      const result = await invokeCreateActivation({
        profileId,
        resetCredentials: true,
      })
      await navigator.clipboard.writeText(result.inviteMessage)
      setInviteMessage(result.inviteMessage)
      setSuccess('Acesso redefinido e convite copiado.')
      await loadProfiles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao redefinir acesso')
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(profile: Profile) {
    if (!supabase) return
    setBusyId(profile.id)
    setError(null)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_active: !profile.is_active })
      .eq('id', profile.id)
    if (updateError) {
      setError(updateError.message)
    } else {
      await loadProfiles()
    }
    setBusyId(null)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-ink">Funcionários</h1>
        <p className="text-sm text-ink-muted">
          Cadastro fechado, convites de primeiro acesso e redefinição de PIN.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Novo funcionário</h2>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
          <label className="space-y-1.5 sm:col-span-1">
            <span className="text-sm font-medium">Nome</span>
            <input
              className="w-full rounded-xl border border-border px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
              {...register('name')}
            />
            {errors.name ? <span className="text-sm text-danger">{errors.name.message}</span> : null}
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Telefone</span>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} />
              )}
            />
            {errors.phone ? <span className="text-sm text-danger">{errors.phone.message}</span> : null}
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Papel</span>
            <select
              className="w-full rounded-xl border border-border px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
              {...register('role')}
            >
              <option value="employee">Funcionário</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" {...register('is_participant')} />
            Participa dos pedidos
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {isSubmitting ? 'Salvando…' : 'Cadastrar e gerar convite'}
            </button>
          </div>
        </form>
      </section>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}
      {inviteMessage ? (
        <pre className="overflow-x-auto rounded-xl border border-border bg-white p-4 text-sm whitespace-pre-wrap text-ink">
          {inviteMessage}
        </pre>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-ink">Lista</h2>
          <input
            className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2 sm:max-w-xs"
            placeholder="Buscar por nome ou telefone"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['all', 'Todos'],
              ['active', 'Ativos'],
              ['inactive', 'Inativos'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium',
                statusFilter === value
                  ? 'bg-brand-600 text-white'
                  : 'border border-border hover:bg-brand-50',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
          {(
            [
              ['all', 'Participação: todos'],
              ['yes', 'Participantes'],
              ['no', 'Não participantes'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setParticipantFilter(value)}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium',
                participantFilter === value
                  ? 'bg-brand-600 text-white'
                  : 'border border-border hover:bg-brand-50',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <LoadingState label="Carregando funcionários…" /> : null}

        <div className="space-y-3">
          {filtered.map((profile) => (
            <article
              key={profile.id}
              className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{profile.name}</h3>
                    <StatusBadge tone={profile.is_active ? 'success' : 'warning'}>
                      {profile.is_active ? 'Ativo' : 'Inativo'}
                    </StatusBadge>
                    <StatusBadge>{profile.role === 'admin' ? 'Admin' : 'Funcionário'}</StatusBadge>
                    <StatusBadge tone={profile.activated_at ? 'neutral' : 'warning'}>
                      {profile.activated_at ? 'Acesso ativo' : 'Aguardando ativação'}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{formatPhoneBR(profile.phone)}</p>
                  <p className="text-sm text-ink-muted">
                    {profile.is_participant ? 'Participa dos pedidos' : 'Não participa'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/admin/funcionarios/${profile.id}`}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50"
                  >
                    Ver
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === profile.id}
                    onClick={() => void copyInvite(profile.id)}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
                  >
                    Copiar convite
                  </button>
                  <button
                    type="button"
                    disabled={busyId === profile.id}
                    onClick={() => void resetAccess(profile.id)}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
                  >
                    Redefinir acesso
                  </button>
                  <button
                    type="button"
                    disabled={busyId === profile.id}
                    onClick={() => void toggleActive(profile)}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-60"
                  >
                    {profile.is_active ? 'Inativar' : 'Reativar'}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!loading && filtered.length === 0 ? (
            <EmptyState
              title="Nenhum funcionário encontrado"
              description="Ajuste os filtros ou cadastre um novo funcionário."
            />
          ) : null}
        </div>
      </section>
    </div>
  )
}
