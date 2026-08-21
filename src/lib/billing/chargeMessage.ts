import { formatBRL } from '../currency'
import { weekdayName } from '../dates'
import { formatOrderSummary } from '../orders/summary'
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
  const lines: string[] = [
    `Olá, ${input.employeeName}! Segue link para pagamento da semana:`,
    '',
  ]

  const activeDays = input.days.filter(
    (day) =>
      day.items.some((item) => item.quantity > 0) ||
      (day.adjustments?.length ?? 0) > 0,
  )

  for (const day of activeDays) {
    const summary = formatOrderSummary(day.items)
    if (summary) {
      lines.push(`${weekdayName(day.weekday)}: ${summary} — ${formatBRL(day.amount)}`)
    }
    for (const adj of day.adjustments ?? []) {
      const sign = adj.amount > 0 ? '+' : ''
      lines.push(`Ajuste: ${sign}${formatBRL(adj.amount)} — ${adj.reason}`)
    }
  }

  lines.push('')

  if (input.creditApplied > 0) {
    lines.push(`Crédito aplicado: - ${formatBRL(input.creditApplied)}`)
  }
  if (input.paymentsApplied > 0) {
    lines.push(`Pagamentos aplicados: - ${formatBRL(input.paymentsApplied)}`)
  }

  const total =
    input.balanceDue > 0
      ? input.balanceDue
      : input.chargesTotal + input.adjustmentsTotal - input.creditApplied - input.paymentsApplied

  lines.push(`*Total*: ${formatBRL(Math.max(total, 0))}`)
  lines.push('', 'Detalhamento e pagamento:', input.detailUrl.replace(/\/$/, ''))

  return lines.join('\n')
}
