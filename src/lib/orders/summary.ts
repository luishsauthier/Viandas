import { APP_LIMITS } from '../constants'

export type OrderQtyItem = {
  mealTypeId: string
  code: string
  name: string
  quantity: number
}

/** Ex.: 2P + 1 Salada */
export function formatOrderSummary(items: Array<{ code: string; quantity: number }>): string {
  const parts = items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.quantity}${item.code === 'SALADA' ? ' Salada' : item.code}`)
  return parts.join(' + ')
}

export function validateOrderQuantities(
  items: Array<{ quantity: number }>,
): { ok: true } | { ok: false; error: string } {
  let total = 0
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      return { ok: false, error: 'Quantidade inválida' }
    }
    if (item.quantity > APP_LIMITS.maxQuantityPerMealType) {
      return {
        ok: false,
        error: `Máximo de ${APP_LIMITS.maxQuantityPerMealType} por tipo`,
      }
    }
    total += item.quantity
  }
  if (total <= 0) {
    return { ok: false, error: 'Informe ao menos um item ou use Não vou pedir hoje' }
  }
  return { ok: true }
}

export function orderStatusLabel(
  status: 'none' | 'ordered' | 'declined',
): string {
  switch (status) {
    case 'ordered':
      return 'Pedido confirmado'
    case 'declined':
      return 'Não pediu'
    default:
      return 'Não respondeu'
  }
}

/** Assinatura estável dos itens (ignora observação). */
export function orderItemsFingerprint(
  items: Array<{ meal_type_id: string; quantity: number }>,
): string {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.meal_type_id}:${item.quantity}`)
    .sort()
    .join('|')
}

export function isSameOrderItems(
  a: Array<{ meal_type_id: string; quantity: number }>,
  b: Array<{ meal_type_id: string; quantity: number }>,
): boolean {
  return orderItemsFingerprint(a) === orderItemsFingerprint(b)
}

/** Pedido padrão atual só guarda 1 tipo + quantidade. */
export function singleMealDefaultFromItems(
  items: Array<{ meal_type_id: string; quantity: number }>,
): { mealTypeId: string; quantity: number } | null {
  const positive = items.filter((item) => item.quantity > 0)
  if (positive.length !== 1) return null
  const only = positive[0]
  if (!only || only.quantity < 1) return null
  return { mealTypeId: only.meal_type_id, quantity: only.quantity }
}

