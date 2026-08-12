import { formatOrderSummary, validateOrderQuantities } from '../src/lib/orders/summary'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

assertEqual(formatOrderSummary([{ code: 'P', quantity: 1 }]), '1P', '1P')
assertEqual(formatOrderSummary([{ code: 'P', quantity: 2 }]), '2P', '2P')
assertEqual(
  formatOrderSummary([
    { code: 'P', quantity: 1 },
    { code: 'SALADA', quantity: 1 },
  ]),
  '1P + 1 Salada',
  'combo',
)

const zero = validateOrderQuantities([
  { quantity: 0 },
  { quantity: 0 },
])
assertEqual(zero.ok, false, 'zero invalid')

const ok = validateOrderQuantities([{ quantity: 1 }, { quantity: 0 }])
assertEqual(ok.ok, true, 'one item ok')

const tooMany = validateOrderQuantities([{ quantity: 11 }])
assertEqual(tooMany.ok, false, 'max 10')

console.log('order summary tests passed')
