import { buildRestaurantOrderMessage } from '../src/lib/whatsapp/restaurantOrder'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}:\nexpected:\n${String(expected)}\n\ngot:\n${String(actual)}`)
  }
}

// somente normais
assertEqual(
  buildRestaurantOrderMessage([
    { items: [{ code: 'P', quantity: 5 }] },
    { items: [{ code: 'P', quantity: 3 }, { code: 'M', quantity: 2 }] },
  ]),
  ['Bom dia! Pedido de hoje:', '', '8P Normal', '2M Normal'].join('\n'),
  'somente normais',
)

// normais + observações
assertEqual(
  buildRestaurantOrderMessage([
    { items: [{ code: 'P', quantity: 8 }] },
    { items: [{ code: 'M', quantity: 2 }] },
    {
      items: [{ code: 'P', quantity: 1 }],
      observation: 'sem massa, pode colocar mais salada',
    },
    { items: [{ code: 'M', quantity: 1 }], observation: 'sem feijão' },
  ]),
  [
    'Bom dia! Pedido de hoje:',
    '',
    '8P Normal',
    '2M Normal',
    '',
    '+',
    '',
    '1P sem massa, pode colocar mais salada',
    '1M sem feijão',
  ].join('\n'),
  'normais + especiais',
)

// somente observações — sem + solto
assertEqual(
  buildRestaurantOrderMessage([
    { items: [{ code: 'P', quantity: 1 }], observation: 'sem massa' },
    {
      items: [
        { code: 'M', quantity: 1 },
        { code: 'SALADA', quantity: 1 },
      ],
      observation: 'sem molho',
    },
  ]),
  [
    'Bom dia! Pedido de hoje:',
    '',
    '1P sem massa',
    '1M + 1 Salada sem molho',
  ].join('\n'),
  'somente especiais',
)

// múltiplos tipos + quantidade > 1 + ordem P/M/G/Salada
assertEqual(
  buildRestaurantOrderMessage([
    {
      items: [
        { code: 'SALADA', quantity: 1 },
        { code: 'G', quantity: 2 },
        { code: 'P', quantity: 1 },
      ],
    },
    { items: [{ code: 'M', quantity: 1 }] },
  ]),
  [
    'Bom dia! Pedido de hoje:',
    '',
    '1P Normal',
    '1M Normal',
    '2G Normal',
    '1 Salada Normal',
  ].join('\n'),
  'ordem e quantidades',
)

// vazio
assertEqual(
  buildRestaurantOrderMessage([]),
  ['Bom dia! Pedido de hoje:', '', 'Nenhum pedido confirmado.'].join('\n'),
  'vazio',
)

console.log('restaurant order tests passed')
