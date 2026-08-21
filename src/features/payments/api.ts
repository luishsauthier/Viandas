import QRCode from 'qrcode'
import { supabase } from '@/lib/supabase'
import { APP_LIMITS } from '@/lib/constants'
import type { Payment, Profile, Week, WeeklyAccount } from '@/types'

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

export type PaymentWithProfile = Payment & {
  profile?: Pick<Profile, 'id' | 'name' | 'phone'> | null
  week?: Pick<Week, 'id' | 'start_date' | 'end_date'> | null
}

export async function fetchMyPaymentsForWeek(weekId: string): Promise<Payment[]> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')
  const { data, error } = await client
    .from('payments')
    .select('*')
    .eq('profile_id', userId)
    .eq('submitted_from_week_id', weekId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Payment[]
}

export async function fetchPendingPayments(): Promise<PaymentWithProfile[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('payments')
    .select(
      '*, profile:profiles!profile_id(id, name, phone), week:weeks!submitted_from_week_id(id, start_date, end_date)',
    )
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PaymentWithProfile[]
}

export async function fetchRecentPayments(limit = 30): Promise<PaymentWithProfile[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('payments')
    .select(
      '*, profile:profiles!profile_id(id, name, phone), week:weeks!submitted_from_week_id(id, start_date, end_date)',
    )
    .order('submitted_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as PaymentWithProfile[]
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'application/pdf':
      return 'pdf'
    default:
      return 'bin'
  }
}

export async function uploadPaymentReceipt(input: {
  paymentId: string
  file: File
}): Promise<string> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')

  if (!APP_LIMITS.receiptMimeTypes.includes(input.file.type as (typeof APP_LIMITS.receiptMimeTypes)[number])) {
    throw new Error('Formato inválido. Use JPEG, PNG, WEBP ou PDF.')
  }
  if (input.file.size > APP_LIMITS.maxReceiptBytes) {
    throw new Error('Arquivo maior que 10 MB')
  }

  const ext = extensionForMime(input.file.type)
  const path = `${userId}/${input.paymentId}/comprovante.${ext}`
  const { error } = await client.storage.from('payment-receipts').upload(path, input.file, {
    upsert: true,
    contentType: input.file.type,
  })
  if (error) throw error
  return path
}

export async function submitPayment(input: {
  paymentId: string
  weekId: string
  amount: number
  receiptPath: string
  userNote?: string | null
}): Promise<Payment> {
  const client = requireClient()
  const { data, error } = await client.rpc('submit_payment', {
    p_payment_id: input.paymentId,
    p_week_id: input.weekId,
    p_amount: input.amount,
    p_receipt_path: input.receiptPath,
    p_user_note: input.userNote ?? null,
  })
  if (error) throw error
  return data as Payment
}

/** Marcador de comprovante enviado pelo WhatsApp (sem arquivo no storage). */
export function whatsappReceiptPath(profileId: string, paymentId: string): string {
  return `${profileId}/${paymentId}/whatsapp`
}

export function isWhatsAppReceipt(path: string | null | undefined): boolean {
  return Boolean(path?.endsWith('/whatsapp'))
}

export async function approvePayment(paymentId: string): Promise<Payment> {
  const client = requireClient()
  const { data, error } = await client.rpc('approve_payment', { p_payment_id: paymentId })
  if (error) throw error
  return data as Payment
}

export async function rejectPayment(paymentId: string, reason?: string | null): Promise<Payment> {
  const client = requireClient()
  const { data, error } = await client.rpc('reject_payment', {
    p_payment_id: paymentId,
    p_reason: reason ?? null,
  })
  if (error) throw error
  return data as Payment
}

export async function reversePayment(paymentId: string, reason: string): Promise<Payment> {
  const client = requireClient()
  const { data, error } = await client.rpc('reverse_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  })
  if (error) throw error
  return data as Payment
}

export async function createReceiptSignedUrl(path: string): Promise<string> {
  const client = requireClient()
  const { data, error } = await client.storage
    .from('payment-receipts')
    .createSignedUrl(path, 60 * 10)
  if (error) throw error
  if (!data?.signedUrl) throw new Error('Não foi possível abrir o comprovante')
  return data.signedUrl
}

export async function buildPixQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  })
}

export type AccountSnapshot = Pick<
  WeeklyAccount,
  'balance_due' | 'charges_total' | 'payments_applied' | 'status'
>
