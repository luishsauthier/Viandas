import { planCreditApplication, planPaymentFifo } from '../src/lib/billing/fifo'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)} got ${String(actual)}`)
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}:\nexpected ${e}\ngot ${a}`)
}

// parcial em uma semana
assertDeepEqual(
  planPaymentFifo(60, [{ accountId: 'a1', weekId: 'w1', balanceDue: 63 }]),
  {
    allocations: [{ accountId: 'a1', weekId: 'w1', amount: 60 }],
    creditGenerated: 0,
    remainingUnallocated: 0,
  },
  'pagamento parcial',
)

// excedente gera crédito
assertDeepEqual(
  planPaymentFifo(70, [{ accountId: 'a1', weekId: 'w1', balanceDue: 63 }]),
  {
    allocations: [{ accountId: 'a1', weekId: 'w1', amount: 63 }],
    creditGenerated: 7,
    remainingUnallocated: 0,
  },
  'pagamento excedente',
)

// FIFO multi-semana
assertDeepEqual(
  planPaymentFifo(100, [
    { accountId: 'a1', weekId: 'w1', balanceDue: 40 },
    { accountId: 'a2', weekId: 'w2', balanceDue: 50 },
    { accountId: 'a3', weekId: 'w3', balanceDue: 30 },
  ]),
  {
    allocations: [
      { accountId: 'a1', weekId: 'w1', amount: 40 },
      { accountId: 'a2', weekId: 'w2', amount: 50 },
      { accountId: 'a3', weekId: 'w3', amount: 10 },
    ],
    creditGenerated: 0,
    remainingUnallocated: 0,
  },
  'FIFO multi-semana',
)

assertEqual(planCreditApplication(7, 45), 7, 'aplica crédito parcial da dívida')
assertEqual(planCreditApplication(50, 45), 45, 'crédito maior que dívida')
assertEqual(planCreditApplication(0, 45), 0, 'sem crédito')
assertEqual(planCreditApplication(10, 0), 0, 'sem dívida')

console.log('fifo tests passed')
