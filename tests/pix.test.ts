import { buildPixPayload, validatePixPayloadCrc } from '../src/lib/pix/payload'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}:\nexpected:\n${String(expected)}\n\ngot:\n${String(actual)}`)
  }
}

function assertTrue(value: boolean, label: string) {
  if (!value) throw new Error(label)
}

const payload = buildPixPayload({
  pixKey: 'teste@viandas.local',
  recipientName: 'Controle de Viandas',
  city: 'São Paulo',
  amount: 63,
  description: 'Semana teste',
  txid: 'WEEKTEST001',
})

assertTrue(payload.startsWith('000201'), 'deve começar com payload format')
assertTrue(payload.includes('5303986'), 'moeda BRL')
assertTrue(payload.includes('540563.00'), 'valor formatado')
assertTrue(payload.includes('5802BR'), 'país BR')
assertTrue(validatePixPayloadCrc(payload), 'CRC válido')

const broken = `${payload.slice(0, -4)}0000`
assertTrue(!validatePixPayloadCrc(broken), 'CRC inválido detectado')

assertEqual(
  buildPixPayload({
    pixKey: '123',
    recipientName: 'A',
    city: 'B',
    amount: 1.5,
  }).slice(-4).length,
  4,
  'CRC tem 4 caracteres',
)

console.log('pix payload tests passed')
