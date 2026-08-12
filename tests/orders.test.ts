import {
  formatOrderSummary,
  isSameOrderItems,
  orderItemsFingerprint,
  singleMealDefaultFromItems,
  validateOrderQuantities,
} from '../src/lib/orders/summary'

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

const zero = validateOrderQuantities([{ quantity: 0 }, { quantity: 0 }])
assertEqual(zero.ok, false, 'zero invalid')

const ok = validateOrderQuantities([{ quantity: 1 }, { quantity: 0 }])
assertEqual(ok.ok, true, 'one item ok')

const tooMany = validateOrderQuantities([{ quantity: 11 }])
assertEqual(tooMany.ok, false, 'max 10')

assertEqual(
  orderItemsFingerprint([
    { meal_type_id: 'b', quantity: 1 },
    { meal_type_id: 'a', quantity: 2 },
  ]),
  'a:2|b:1',
  'fingerprint sorted',
)
assertEqual(
  isSameOrderItems([{ meal_type_id: 'a', quantity: 1 }], [{ meal_type_id: 'a', quantity: 1 }]),
  true,
  'same items',
)
assertEqual(
  singleMealDefaultFromItems([
    { meal_type_id: 'a', quantity: 1 },
    { meal_type_id: 'b', quantity: 0 },
  ])?.mealTypeId,
  'a',
  'single meal default',
)
assertEqual(
  singleMealDefaultFromItems([
    { meal_type_id: 'a', quantity: 1 },
    { meal_type_id: 'b', quantity: 1 },
  ]),
  null,
  'multi meal not defaultable',
)

console.log('order summary tests passed')
