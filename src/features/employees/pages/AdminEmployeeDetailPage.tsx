import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { formatPhoneBR } from '@/lib/phone'
import { formatBRL } from '@/lib/currency'
import { formatDateRangeBR } from '@/lib/dates'
import { financialStatusLabel, financialStatusTone } from '@/lib/billing/status'
import type { Profile, Week, WeeklyAccount } from '@/types'
import { invokeCreateActivation, invokeDeleteEmployee } from '@/features/auth/api'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from '@/components/common/PageStates'

const editSchema = z.object({
  name: z.string().min(2, 'Informe o nome'),
  is_participant: z.boolean(),
  is_active: z.boolean(),
  role: z.enum(['admin', 'employee']),
})

type EditValues = z.infer<typeof editSchema>

type AccountRow = WeeklyAccount & {
  week?: Pick<Week, 'id' | 'start_date' | 'end_date' | 'status'> | null
}

export function AdminEmployeeDetailPage() {
  const { profileId = '' } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [creditBalance, setCreditBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteMessage, setInviteMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    async function load() {
      if (!supabase || !profileId) return
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle()
      if (loadError) {
        setError(loadError.message)
        setLoading(false)
        return
      }
      if (!data) {
        setError('Funcionário não encontrado')
        setLoading(false)
        return
      }
      const next = data as Profile
      setProfile(next)
      reset({
        name: next.name,
        is_participant: next.is_participant,
        is_active: next.is_active,
        role: next.role,
      })

      const [{ data: accountRows }, { data: credit }] = await Promise.all([
        supabase
          .from('weekly_accounts')
          .select('*, week:weeks(id, start_date, end_date, status)')
          .eq('profile_id', profileId)
          .order('updated_at', { ascending: false }),
        supabase.rpc('get_credit_balance', { p_profile_id: profileId }),
      ])
      setAccounts((accountRows ?? []) as AccountRow[])
      setCreditBalance(Number(credit ?? 0))
      setLoading(false)
    }
    void load()
  }, [profileId, reset])

  const onSave = handleSubmit(async (values) => {
    if (!supabase || !profile) return
    setError(null)
    setSuccess(null)
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update(values)
      .eq('id', profile.id)
      .select('*')
      .single()
    if (updateError) {
      setError(updateError.message)
      return
    }
    setProfile(data as Profile)
    setSuccess('Dados atualizados.')
  })

  async function resetAccess() {
    if (!profile) return
    setError(null)
    setSuccess(null)
    try {
      const result = await invokeCreateActivation({
        profileId: profile.id,
        resetCredentials: true,
      })
      await navigator.clipboard.writeText(result.inviteMessage)
      setInviteMessage(result.inviteMessage)
      setSuccess('Acesso redefinido e convite copiado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao redefinir')
    }
  }

  async function deleteEmployee() {
    if (!profile) return
    const confirmed = window.confirm(
      `Excluir permanentemente "${profile.name}"?\n\nSó funciona sem histórico (pedidos/pagamentos). Em produção, prefira inativar.`,
    )
    if (!confirmed) return
    setDeleting(true)
    setError(null)
    setSuccess(null)
    try {
      await invokeDeleteEmployee({ profileId: profile.id })
      navigate('/admin/funcionarios', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <LoadingState />
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        <ErrorBanner>{error || 'Não encontrado'}</ErrorBanner>
        <Link to="/admin/funcionarios" className="text-brand-700 hover:underline">
          Voltar
        </Link>
      </div>
    )
  }

  const openBalance = accounts.reduce((sum, row) => {
    const due = Number(row.balance_due)
    return sum + (due > 0 ? due : 0)
  }, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/admin/funcionarios" className="text-sm font-medium text-brand-700 hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">{profile.name}</h1>
        <p className="text-sm text-ink-muted">{formatPhoneBR(profile.phone)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge tone={profile.is_active ? 'success' : 'warning'}>
            {profile.is_active ? 'Ativo' : 'Inativo'}
          </StatusBadge>
          <StatusBadge>{profile.role === 'admin' ? 'Admin' : 'Funcionário'}</StatusBadge>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Saldo em aberto</p>
          <p className="mt-1 text-lg font-semibold">{formatBRL(openBalance)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-sm">
          <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">Crédito disponível</p>
          <p className="mt-1 text-lg font-semibold">{formatBRL(creditBalance)}</p>
        </div>
      </section>

      <form className="space-y-4 rounded-2xl border border-border bg-surface-elevated p-5" onSubmit={onSave}>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Nome</span>
          <input
            className="w-full rounded-xl border border-border px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
            {...register('name')}
          />
          {errors.name ? <span className="text-sm text-danger">{errors.name.message}</span> : null}
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Papel</span>
          <select
            className="w-full rounded-xl border border-border px-3 py-2.5 outline-none ring-brand-500 focus:ring-2"
            {...register('role')}
          >
            <option value="employee">Funcionário</option>
            <option value="admin">Administrador</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_participant')} />
          Participa dos pedidos
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_active')} />
          Ativo
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? 'Salvando…' : 'Salvar'}
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-surface-elevated p-5">
        <h2 className="font-semibold text-ink">Acesso</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Telefone não pode ser alterado para preservar o identificador de login.
        </p>
        <button
          type="button"
          onClick={() => void resetAccess()}
          className="mt-4 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-brand-50"
        >
          Redefinir acesso
        </button>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Histórico financeiro</h2>
        {accounts.length === 0 ? (
          <EmptyState title="Sem contas semanais" description="Ainda não há consumo registrado." />
        ) : (
          <ul className="space-y-2">
            {accounts.map((row) => (
              <li key={row.id}>
                <Link
                  to={`/admin/semana/${row.week_id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-4 py-3 text-sm hover:bg-brand-50"
                >
                  <div>
                    <p className="font-medium">
                      {row.week
                        ? formatDateRangeBR(row.week.start_date, row.week.end_date)
                        : row.week_id}
                    </p>
                    <p className="text-ink-muted">
                      Consumo {formatBRL(row.charges_total)} · Pago {formatBRL(row.payments_applied)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>{formatBRL(row.balance_due)}</span>
                    <StatusBadge tone={financialStatusTone(row.status)}>
                      {financialStatusLabel(row.status)}
                    </StatusBadge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {success ? <SuccessBanner>{success}</SuccessBanner> : null}
      {inviteMessage ? (
        <pre className="overflow-x-auto rounded-xl border border-border bg-white p-4 text-sm whitespace-pre-wrap">
          {inviteMessage}
        </pre>
      ) : null}

      <section className="rounded-2xl border border-red-200 bg-red-50/60 p-5">
        <h2 className="font-semibold text-danger">Zona de risco</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Exclusão permanente só para testes ou cadastros sem histórico. No dia a dia, use
          inativação.
        </p>
        <button
          type="button"
          disabled={deleting}
          onClick={() => void deleteEmployee()}
          className="mt-4 rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {deleting ? 'Excluindo…' : 'Excluir funcionário'}
        </button>
      </section>
    </div>
  )
}
