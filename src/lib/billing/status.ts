import type { FinancialStatus } from '../../types'

export function financialStatusLabel(status: FinancialStatus): string {
  switch (status) {
    case 'pending':
      return 'Pendente'
    case 'partial':
      return 'Parcial'
    case 'waiting_validation':
      return 'Aguardando validação'
    case 'paid':
      return 'Pago'
    case 'credit':
      return 'Crédito'
    default:
      return status
  }
}

export function financialStatusTone(
  status: FinancialStatus,
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'paid':
      return 'success'
    case 'credit':
      return 'success'
    case 'partial':
      return 'warning'
    case 'waiting_validation':
      return 'warning'
    case 'pending':
      return 'danger'
    default:
      return 'neutral'
  }
}
