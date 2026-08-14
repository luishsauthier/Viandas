import { buildPixPayload, normalizePixKey, validatePixPayloadCrc } from '../src/lib/pix/payload'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}:\nexpected:\n${String(expected)}\n\ngot:\n${String(actual)}`)
  }
}

function assertTrue(value: boolean, label: string) {
  if (!value) throw new Error(label)
}

assertEqual(normalizePixKey('01.598.120/0001-03'), '01598120000103', 'CNPJ sem pontuação')
assertEqual(normalizePixKey('123.456.789-09'), '12345678909', 'CPF sem pontuação')
assertEqual(normalizePixKey('teste@Viandas.local'), 'teste@viandas.local', 'e-mail em minúsculas')

const payload = buildPixPayload({
  pixKey: '01.598.120/0001-03',
  recipientName: 'Minimercado Freisleben',
  city: 'Lajeado/RS',
  amount: 63,
  description: 'Viandas BIMachine - Fernando',
  txid: 'WEEKTEST001',
})

assertTrue(payload.includes('01598120000103'), 'payload usa CNPJ só com dígitos')
assertTrue(!payload.includes('01.598.120'), 'payload não leva pontuação do CNPJ')
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
