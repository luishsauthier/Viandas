import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  approvePayment,
  createReceiptSignedUrl,
  fetchPendingPayments,
  fetchRecentPayments,
  rejectPayment,
  reversePayment,
  type PaymentWithProfile,
} from '@/features/payments/api'
import { supabase } from '@/lib/supabase'
import { formatBRL } from '@/lib/currency'
import { formatDateRangeBR } from '@/lib/dates'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import { EmptyState, ErrorBanner, LoadingState } from '@/components/common/PageStates'

export function AdminPaymentsPage() {
  const [pending, setPending] = useState<PaymentWithProfile[]>([])
  const [recent, setRecent] = useState<PaymentWithProfile[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [reverseReasons, setReverseReasons] = useState<Record<string, string>>({})

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const [pendingRows, recentRows] = await Promise.all([
        fetchPendingPayments(),
        fetchRecentPayments(40),
      ])
      setPending(pendingRows)
      setRecent(recentRows.filter((row) => row.status !== 'pending'))

      const balanceEntries = await Promise.all(
        pendingRows.map(async (payment) => {
          if (!payment.submitted_from_week_id || !supabase) return [payment.id, 0] as const
          const { data } = await supabase
            .from('weekly_accounts')
            .select('balance_due')
            .eq('week_id', payment.submitted_from_week_id)
            .eq('profile_id', payment.profile_id)
            .maybeSingle()
          return [payment.id, Number(data?.balance_due ?? 0)] as const
        }),
      )
      setBalances(Object.fromEntries(balanceEntries))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar pagamentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  async function openReceipt(path: string) {
    try {
      const url = await createReceiptSignedUrl(path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir comprovante')
    }
  }

  async function onApprove(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await approvePayment(id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aprovar')
    } finally {
      setBusyId(null)
    }
  }

  async function onReject(id: string) {
    setBusyId(id)
    setError(null)
    try {
      await rejectPayment(id, rejectReasons[id] ?? '')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao rejeitar')
    } finally {
      setBusyId(null)
    }
  }

  async function onReverse(id: string) {
    const reason = (reverseReasons[id] ?? '').trim()
    if (!reason) {
      setError('Informe o motivo da reversão')
      return
    }
    setBusyId(id)
    setError(null)
    try {
      await reversePayment(id, reason)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reverter')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingState label="Carregando pagamentos…" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Pagamentos para validar</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Aprove ou rejeite comprovantes. O valor só entra no saldo após aprovação.
        </p>
      </div>

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <section className="space-y-3">
        {pending.length === 0 ? (
          <EmptyState
            title="Nenhum comprovante pendente"
            description="Quando um funcionário enviar PIX, ele aparece aqui."
          />
        ) : (
          pending.map((payment) => (
            <article
              key={payment.id}
              className="rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{payment.profile?.name ?? 'Funcionário'}</p>
                  <p className="text-sm text-ink-muted">
                    {payment.week
                      ? `Semana ${formatDateRangeBR(payment.week.start_date, payment.week.end_date)}`
                      : 'Semana —'}
                  </p>
                  <p className="mt-1 text-sm">
                    Valor declarado: <strong>{formatBRL(payment.amount)}</strong>
                  </p>
                  <p className="text-sm text-ink-muted">
                    Saldo atual (antes da aprovação): {formatBRL(balances[payment.id] ?? 0)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Enviado em {new Date(payment.submitted_at).toLocaleString('pt-BR')}
                  </p>
                  {payment.user_note ? (
                    <p className="mt-1 text-sm text-ink-muted">Obs.: {payment.user_note}</p>
                  ) : null}
                </div>
                <StatusBadge tone="warning">Pendente</StatusBadge>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-brand-50"
                  onClick={() => void openReceipt(payment.receipt_path)}
                >
                  Ver comprovante
                </button>
                <button
                  type="button"
                  disabled={busyId === payment.id}
                  className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  onClick={() => void onApprove(payment.id)}
                >
                  Aprovar
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="text"
                  placeholder="Motivo da rejeição (opcional)"
                  className="min-w-[220px] flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                  value={rejectReasons[payment.id] ?? ''}
                  onChange={(event) =>
                    setRejectReasons((prev) => ({ ...prev, [payment.id]: event.target.value }))
                  }
                />
                <button
                  type="button"
                  disabled={busyId === payment.id}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-60"
                  onClick={() => void onReject(payment.id)}
                >
                  Rejeitar
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">Histórico recente</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-muted">Sem revisões recentes.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((payment) => (
              <li
                key={payment.id}
                className="space-y-2 rounded-xl border border-border bg-white px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{payment.profile?.name}</p>
                    <p className="text-ink-muted">
                      {formatBRL(payment.amount)}
                      {payment.week
                        ? ` · ${formatDateRangeBR(payment.week.start_date, payment.week.end_date)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={
                        payment.status === 'approved'
                          ? 'success'
                          : payment.status === 'rejected'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {payment.status === 'approved'
                        ? 'Aprovado'
                        : payment.status === 'rejected'
                          ? 'Rejeitado'
                          : payment.status === 'reversed'
                            ? 'Revertido'
                            : payment.status}
                    </StatusBadge>
                    <button
                      type="button"
                      className="text-brand-700 hover:underline"
                      onClick={() => void openReceipt(payment.receipt_path)}
                    >
                      Comprovante
                    </button>
                  </div>
                </div>
                {payment.status === 'approved' ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <input
                      type="text"
                      placeholder="Motivo da reversão"
                      className="min-w-[220px] flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                      value={reverseReasons[payment.id] ?? ''}
                      onChange={(event) =>
                        setReverseReasons((prev) => ({
                          ...prev,
                          [payment.id]: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      disabled={busyId === payment.id}
                      className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-60"
                      onClick={() => void onReverse(payment.id)}
                    >
                      Reverter
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/admin" className="text-sm text-brand-700 hover:underline">
        ← Dashboard
      </Link>
    </div>
  )
}
