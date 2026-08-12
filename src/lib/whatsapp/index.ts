import { formatDateBR, weekdayName } from '../dates'

export type DailyWhatsAppMessageInput = {
  weekday: number
  dateISO: string
  items: string[]
  closeTime: string
  orderUrl: string
}

export function buildDailyWhatsAppMessage(input: DailyWhatsAppMessageInput): string {
  const weekday = weekdayName(input.weekday).toUpperCase()
  const dateLabel = formatDateBR(input.dateISO)
  const closeTime = input.closeTime.slice(0, 5)
  const items = input.items.map((item) => item.trim()).filter(Boolean)

  const menuBlock =
    items.length > 0
      ? items.map((item) => `• ${item}`).join('\n')
      : '• Cardápio ainda não definido'

  return [
    `🍽️ *VIANDA — ${weekday} (${dateLabel})*`,
    '',
    'Cardápio de hoje:',
    menuBlock,
    '',
    `⏰ Pedidos até *${closeTime}*.`,
    '',
    'Faça seu pedido:',
    input.orderUrl.replace(/\/$/, ''),
  ].join('\n')
}

export {
  buildRestaurantOrderMessage,
  type RestaurantOrderLineInput,
} from './restaurantOrder'
