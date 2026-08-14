import { Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchAppSettings } from '@/features/settings/api'
import {
  buildPixQrDataUrl,
  fetchMyPaymentsForWeek,
  submitPayment,
  uploadPaymentReceipt,
} from '@/features/payments/api'
import { buildPixPayload } from '@/lib/pix/payload'
import { resolvePixDescriptionTemplate } from '@/lib/pix/descriptionTemplate'
import { formatBRL } from '@/lib/currency'
import { useAuth } from '@/features/auth/AuthProvider'
import { StatusBadge } from '@/components/common/PlaceholderPage'
import type { Payment } from '@/types'

type Props = {
  weekId: string
  weekStartDate: string
  weekEndDate: string
  balanceDue: number
  onSubmitted: () => void
}

export function WeekPaymentPanel({
  weekId,
  weekStartDate,
  weekEndDate,
  balanceDue,
  onSubmitted,
}: Props) {
  const { profile } = useAuth()
  const amount = balanceDue
  const [pixKey, setPixKey] = useState('')
  const [recipient, setRecipient] = useState('')
  const [city, setCity] = useState('')
  const [descriptionTemplate, setDescriptionTemplate] = useState<string | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [payload, setPayload] = useState('')
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [note, setNote] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pixError, setPixError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [settings, myPayments] = await Promise.all([
          fetchAppSettings(),
          fetchMyPaymentsForWeek(weekId),
        ])
        setPixKey(settings.pix_key)
        setRecipient(settings.pix_recipient_name)
        setCity(settings.pix_city)
        setDescriptionTemplate(settings.pix_description)
        setPayments(myPayments)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar PIX')
      }
    })()
  }, [weekId])

  useEffect(() => {
    void (async () => {
      if (!pixKey || !recipient || !city || !Number.isFinite(amount) || amount <= 0) {
        setPayload('')
        setQrUrl(null)
        setPixError(
          !pixKey || !recipient || !city
            ? 'PIX ainda não configurado pelo administrador.'
            : null,
        )
        return
      }
      try {
        const description = resolvePixDescriptionTemplate(descriptionTemplate, {
          employeeName: profile?.name ?? '',
          weekStartDate,
          weekEndDate,
          amount,
        })
        const nextPayload = buildPixPayload({
          pixKey,
          recipientName: recipient,
          city,
          amount,
          description: description || null,
          txid: weekId.replace(/-/g, '').slice(0, 25),
        })
        setPayload(nextPayload)
        setQrUrl(await buildPixQrDataUrl(nextPayload))
        setPixError(null)
      } catch (err) {
        setPayload('')
        setQrUrl(null)
        setPixError(err instanceof Error ? err.message : 'Falha ao gerar PIX')
      }
    })()
  }, [
    pixKey,
    recipient,
    city,
    amount,
    descriptionTemplate,
    weekId,
    weekStartDate,
    weekEndDate,
    profile?.name,
  ])

  const pendingExists = payments.some((payment) => payment.status === 'pending')

  async function copyPix() {
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
      setCopyFeedback('PIX Copia e Cola copiado.')
    } catch {
      setCopyFeedback('Não foi possível copiar automaticamente.')
    }
  }

  async function handleSubmit() {
    if (!file) {
      setError('Anexe o comprovante')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Não há saldo a pagar nesta semana')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const paymentId = crypto.randomUUID()
      const path = await uploadPaymentReceipt({ paymentId, file })
      await submitPayment({
        paymentId,
        weekId,
        amount,
        receiptPath: path,
        userNote: note,
      })
      setFile(null)
      setFileInputKey((value) => value + 1)
      setNote('')
      onSubmitted()
      setPayments(await fetchMyPaymentsForWeek(weekId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar pagamento')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface-elevated p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-ink">Pagamento PIX</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Gere o PIX, pague e envie o comprovante. O saldo só muda após aprovação do admin.
        </p>
      </div>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {pixError ? <p className="text-sm text-amber-800">{pixError}</p> : null}

      <p className="text-sm text-ink">
        <span className="font-medium">Valor a pagar:</span> {formatBRL(amount)}
      </p>

      {qrUrl && payload ? (
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
          <img src={qrUrl} alt="QR Code PIX" className="h-48 w-48 rounded-xl border border-border bg-white p-2" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">PIX Copia e Cola</p>
            <pre className="max-h-28 overflow-auto rounded-xl border border-border bg-white p-3 text-xs break-all whitespace-pre-wrap">
              {payload}
            </pre>
            <button
              type="button"
              onClick={() => void copyPix()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Copiar PIX
            </button>
            {copyFeedback ? <p className="text-sm text-brand-800">{copyFeedback}</p> : null}
            {pixKey ? (
              <p className="text-xs text-ink-muted">Chave PIX (fallback): {pixKey}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingExists ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Já existe comprovante aguardando validação. Você pode enviar outro se for um pagamento
          separado.
        </p>
      ) : null}

      <div className="space-y-3 border-t border-border pt-4">
        <h3 className="font-medium text-ink">Enviar comprovante</h3>
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:bg-brand-50">
            <Upload className="size-4 text-brand-700" aria-hidden />
            {file ? 'Trocar arquivo' : 'Escolher comprovante'}
            <input
              key={fileInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-sm text-ink-muted">
            {file ? file.name : 'JPG, PNG, WEBP ou PDF'}
          </p>
        </div>
        <textarea
          className="min-h-20 w-full rounded-xl border border-border px-3 py-2 text-sm"
          placeholder="Observação (opcional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button
          type="button"
          disabled={busy || !file}
          onClick={() => void handleSubmit()}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? 'Enviando…' : 'Enviar comprovante'}
        </button>
      </div>

      {payments.length > 0 ? (
        <div className="border-t border-border pt-4">
          <h3 className="font-medium text-ink">Seus envios nesta semana</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-white px-3 py-2"
              >
                <span>
                  {formatBRL(payment.amount)} ·{' '}
                  {new Date(payment.submitted_at).toLocaleString('pt-BR')}
                </span>
                <PaymentStatusBadge status={payment.status} />
                {payment.status === 'rejected' && payment.rejection_reason ? (
                  <span className="w-full text-xs text-danger">Motivo: {payment.rejection_reason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function PaymentStatusBadge({ status }: { status: Payment['status'] }) {
  if (status === 'pending') {
    return <StatusBadge tone="warning">Aguardando validação</StatusBadge>
  }
  if (status === 'approved') {
    return <StatusBadge tone="success">Aprovado</StatusBadge>
  }
  if (status === 'rejected') {
    return <StatusBadge tone="danger">Rejeitado</StatusBadge>
  }
  return <StatusBadge>Revertido</StatusBadge>
}
