/**
 * Planejamento FIFO de alocação de pagamento (espelha a regra SQL).
 * Contas devem estar ordenadas da mais antiga para a mais recente.
 */

export type FifoAccount = {
  accountId: string
  weekId: string
  balanceDue: number
}

export type FifoPlan = {
  allocations: Array<{ accountId: string; weekId: string; amount: number }>
  creditGenerated: number
  remainingUnallocated: number
}

export function planPaymentFifo(paymentAmount: number, accounts: FifoAccount[]): FifoPlan {
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error('Valor de pagamento inválido')
  }

  let remaining = Math.round(paymentAmount * 100) / 100
  const allocations: FifoPlan['allocations'] = []

  for (const account of accounts) {
    if (remaining <= 0) break
    const due = Math.round(Number(account.balanceDue) * 100) / 100
    if (due <= 0) continue
    const amount = Math.min(remaining, due)
    if (amount > 0) {
      allocations.push({
        accountId: account.accountId,
        weekId: account.weekId,
        amount: Math.round(amount * 100) / 100,
      })
      remaining = Math.round((remaining - amount) * 100) / 100
    }
  }

  const creditGenerated = remaining > 0 ? remaining : 0
  return {
    allocations,
    creditGenerated,
    remainingUnallocated: 0,
  }
}

export function planCreditApplication(
  availableCredit: number,
  balanceDue: number,
): number {
  if (availableCredit <= 0 || balanceDue <= 0) return 0
  return Math.round(Math.min(availableCredit, balanceDue) * 100) / 100
}
