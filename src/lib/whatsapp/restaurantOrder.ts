import { formatOrderSummary } from '../orders/summary'

const MEAL_ORDER = ['P', 'M', 'G', 'SALADA'] as const

export type RestaurantOrderLineInput = {
  items: Array<{ code: string; quantity: number }>
  observation?: string | null
}

function sortMealEntries(entries: Array<[string, number]>): Array<[string, number]> {
  return [...entries].sort((a, b) => {
    const ai = MEAL_ORDER.indexOf(a[0] as (typeof MEAL_ORDER)[number])
    const bi = MEAL_ORDER.indexOf(b[0] as (typeof MEAL_ORDER)[number])
    const aRank = ai === -1 ? 99 : ai
    const bRank = bi === -1 ? 99 : bi
    return aRank - bRank
  })
}

function formatTypeQty(code: string, quantity: number): string {
  if (code === 'SALADA') return `${quantity} Salada`
  return `${quantity}${code}`
}

function formatNormalLines(orders: RestaurantOrderLineInput[]): string[] {
  const totals = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.items) {
      if (item.quantity <= 0) continue
      totals.set(item.code, (totals.get(item.code) ?? 0) + item.quantity)
    }
  }
  return sortMealEntries([...totals.entries()]).map(
    ([code, quantity]) => `${formatTypeQty(code, quantity)} Normal`,
  )
}

function formatSpecialLines(orders: RestaurantOrderLineInput[]): string[] {
  return orders.map((order) => {
    const summary = formatOrderSummary(
      [...order.items]
        .filter((item) => item.quantity > 0)
        .sort((a, b) => {
          const ai = MEAL_ORDER.indexOf(a.code as (typeof MEAL_ORDER)[number])
          const bi = MEAL_ORDER.indexOf(b.code as (typeof MEAL_ORDER)[number])
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        }),
    )
    const observation = (order.observation ?? '').trim()
    return observation ? `${summary} ${observation}` : summary
  })
}

/**
 * Gera o texto do pedido agrupado para enviar ao restaurante.
 * Pedidos sem observação são somados por tipo; com observação ficam em linhas próprias.
 */
export function buildRestaurantOrderMessage(orders: RestaurantOrderLineInput[]): string {
  const ordered = orders.filter((order) =>
    order.items.some((item) => item.quantity > 0),
  )
  const normals = ordered.filter((order) => !(order.observation ?? '').trim())
  const specials = ordered.filter((order) => Boolean((order.observation ?? '').trim()))

  const normalLines = formatNormalLines(normals)
  const specialLines = formatSpecialLines(specials)

  const body: string[] = []
  if (normalLines.length > 0) {
    body.push(...normalLines)
  }
  if (normalLines.length > 0 && specialLines.length > 0) {
    body.push('+')
  }
  if (specialLines.length > 0) {
    body.push(...specialLines)
  }

  if (body.length === 0) {
    return ['Bom dia! Pedido de hoje:', '', 'Nenhum pedido confirmado.'].join('\n')
  }

  return ['Bom dia! Pedido de hoje:', '', ...body].join('\n')
}
