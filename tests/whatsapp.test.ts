import { buildDailyWhatsAppMessage } from '../src/lib/whatsapp'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}:\nexpected:\n${String(expected)}\n\ngot:\n${String(actual)}`)
  }
}

const message = buildDailyWhatsAppMessage({
  weekday: 3,
  dateISO: '2026-08-12',
  items: ['Arroz', 'Feijão', 'Sobrecoxa assada', 'Polenta frita', 'Massa'],
  closeTime: '10:30:00',
  orderUrl: 'https://exemplo.app/pedido',
})

const expected = [
  '🍽️ *VIANDA — QUARTA-FEIRA (12/08)*',
  '',
  'Cardápio de hoje:',
  '• Arroz',
  '• Feijão',
  '• Sobrecoxa assada',
  '• Polenta frita',
  '• Massa',
  '',
  '⏰ Pedidos até *10:30*.',
  '',
  'Faça seu pedido:',
  'https://exemplo.app/pedido',
].join('\n')

assertEqual(message, expected, 'daily message')

const empty = buildDailyWhatsAppMessage({
  weekday: 1,
  dateISO: '2026-08-10',
  items: ['  ', ''],
  closeTime: '10:30',
  orderUrl: 'https://exemplo.app/pedido/',
})

if (!empty.includes('Cardápio ainda não definido')) {
  throw new Error('empty menu fallback missing')
}

console.log('whatsapp tests passed')
