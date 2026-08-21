import { buildChargeMessage } from '../src/lib/billing/chargeMessage'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}:\nexpected:\n${String(expected)}\n\ngot:\n${String(actual)}`)
  }
}

assertEqual(
  buildChargeMessage({
    employeeName: 'Éverton Lenz',
    status: 'pending',
    chargesTotal: 15,
    adjustmentsTotal: 0,
    creditApplied: 0,
    paymentsApplied: 0,
    balanceDue: 15,
    days: [
      { weekday: 5, items: [{ code: 'P', quantity: 1 }], amount: 15 },
    ],
    detailUrl:
      'https://luishsauthier.github.io/Viandas/minha-semana/754aeb19-75c3-4852-b2c2-78bf8d5e9925',
  }),
  [
    'Olá, Éverton Lenz! Segue link para pagamento da semana:',
    '',
    'Sexta-feira: 1P — R$ 15,00',
    '',
    '*Total*: R$ 15,00',
    '',
    'Detalhamento e pagamento:',
    'https://luishsauthier.github.io/Viandas/minha-semana/754aeb19-75c3-4852-b2c2-78bf8d5e9925',
  ].join('\n'),
  'cobrança simples',
)

assertEqual(
  buildChargeMessage({
    employeeName: 'Luis Henrique',
    status: 'pending',
    chargesTotal: 63,
    adjustmentsTotal: 0,
    creditApplied: 0,
    paymentsApplied: 0,
    balanceDue: 63,
    days: [
      { weekday: 1, items: [{ code: 'P', quantity: 1 }], amount: 15 },
      { weekday: 2, items: [], amount: 0 },
      { weekday: 3, items: [{ code: 'P', quantity: 1 }], amount: 15 },
      { weekday: 4, items: [{ code: 'P', quantity: 1 }], amount: 15 },
      { weekday: 5, items: [{ code: 'M', quantity: 1 }], amount: 18 },
    ],
    detailUrl: 'https://app.example/minha-semana/week-1',
  }),
  [
    'Olá, Luis Henrique! Segue link para pagamento da semana:',
    '',
    'Segunda-feira: 1P — R$ 15,00',
    'Quarta-feira: 1P — R$ 15,00',
    'Quinta-feira: 1P — R$ 15,00',
    'Sexta-feira: 1M — R$ 18,00',
    '',
    '*Total*: R$ 63,00',
    '',
    'Detalhamento e pagamento:',
    'https://app.example/minha-semana/week-1',
  ].join('\n'),
  'cobrança básica sem dias vazios',
)

assertEqual(
  buildChargeMessage({
    employeeName: 'Ana',
    status: 'pending',
    chargesTotal: 30,
    adjustmentsTotal: 5,
    creditApplied: 10,
    paymentsApplied: 0,
    balanceDue: 25,
    days: [
      {
        weekday: 1,
        items: [{ code: 'P', quantity: 2 }],
        amount: 30,
        adjustments: [{ amount: 5, reason: 'Extra' }],
      },
    ],
    detailUrl: 'https://app.example/minha-semana/w2/',
  }),
  [
    'Olá, Ana! Segue link para pagamento da semana:',
    '',
    'Segunda-feira: 2P — R$ 30,00',
    'Ajuste: +R$ 5,00 — Extra',
    '',
    'Crédito aplicado: - R$ 10,00',
    '*Total*: R$ 25,00',
    '',
    'Detalhamento e pagamento:',
    'https://app.example/minha-semana/w2',
  ].join('\n'),
  'cobrança com crédito e ajuste',
)

console.log('chargeMessage tests passed')
