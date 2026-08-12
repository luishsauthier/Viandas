import { formatBRL } from '../currency'
import { weekdayName } from '../dates'
import { formatOrderSummary } from '../orders/summary'
import { financialStatusLabel } from './status'
import type { FinancialStatus } from '../../types'

export type ChargeDayLine = {
  weekday: number
  items: Array<{ code: string; quantity: number }>
  amount: number
  adjustments?: Array<{ amount: number; reason: string }>
}

export type ChargeMessageInput = {
  employeeName: string
  status: FinancialStatus
  chargesTotal: number
  adjustmentsTotal: number
  creditApplied: number
  paymentsApplied: number
  balanceDue: number
  days: ChargeDayLine[]
  detailUrl: string
}

/**
 * Mensagem de cobrança copiável (painel semanal / WhatsApp).
 * Omite dias sem pedido; o site mostra o detalhamento completo.
 */
export function buildChargeMessage(input: ChargeMessageInput): string {
  const headerAmount = formatBRL(input.balanceDue > 0 ? input.balanceDue : input.chargesTotal + input.adjustmentsTotal)
  const lines: string[] = [
    `${input.employeeName} — ${headerAmount} — ${financialStatusLabel(input.status)}`,
    '',
  ]

  const activeDays = input.days.filter(
    (day) =>
      day.items.some((item) => item.quantity > 0) ||
      (day.adjustments?.length ?? 0) > 0,
  )

  for (const day of activeDays) {
    const summary = formatOrderSummary(day.items)
    const dayAmount = day.amount
    if (summary) {
      lines.push(`${weekdayName(day.weekday)}: ${summary} — ${formatBRL(dayAmount)}`)
    }
    for (const adj of day.adjustments ?? []) {
      const sign = adj.amount > 0 ? '+' : ''
      lines.push(
        `  Ajuste (${weekdayName(day.weekday, true)}): ${sign}${formatBRL(adj.amount)} — ${adj.reason}`,
      )
    }
  }

  lines.push('')

  const hasCreditOrPayments = input.creditApplied > 0 || input.paymentsApplied > 0
  const consumption = input.chargesTotal + input.adjustmentsTotal

  if (hasCreditOrPayments) {
    lines.push(`Consumo da semana: ${formatBRL(consumption)}`)
    if (input.creditApplied > 0) {
      lines.push(`Crédito anterior aplicado: - ${formatBRL(input.creditApplied)}`)
    }
    if (input.paymentsApplied > 0) {
      lines.push(`Pagamentos aplicados: - ${formatBRL(input.paymentsApplied)}`)
    }
    lines.push(`Total a pagar: ${formatBRL(input.balanceDue)}`)
  } else {
    lines.push(`Total da semana: ${formatBRL(consumption)}`)
  }

  lines.push('', 'Detalhamento e pagamento:', input.detailUrl.replace(/\/$/, ''))

  return lines.join('\n')
}
