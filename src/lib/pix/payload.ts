/**
 * Geração de payload PIX estático (BR Code / EMV MPM) conforme Bacen.
 */

function tlv(id: string, value: string): string {
  const length = String(value.length).padStart(2, '0')
  return `${id}${length}${value}`
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) */
export function crc16Ccitt(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

export function sanitizePixText(value: string, maxLength: number): string {
  const cleaned = stripDiacritics(value)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.slice(0, maxLength) || 'NA'
}

export function formatPixAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Valor PIX inválido')
  }
  return amount.toFixed(2)
}

export type BuildPixPayloadInput = {
  pixKey: string
  recipientName: string
  city: string
  amount: number
  description?: string | null
  /** txid / referência (máx. 25). Default *** */
  txid?: string | null
}

export function buildPixPayload(input: BuildPixPayloadInput): string {
  const key = input.pixKey.trim()
  if (!key) throw new Error('Chave PIX não configurada')

  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', key)
  const additionalDescription = (input.description ?? '').trim()
  const merchantAccountWithDesc = additionalDescription
    ? merchantAccount + tlv('02', sanitizePixText(additionalDescription, 72))
    : merchantAccount

  const txid = sanitizePixText(input.txid?.trim() || '***', 25)
  const additionalData = tlv('05', txid)

  const amount = formatPixAmount(input.amount)

  const body =
    tlv('00', '01') +
    tlv('26', merchantAccountWithDesc) +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', amount) +
    tlv('58', 'BR') +
    tlv('59', sanitizePixText(input.recipientName, 25)) +
    tlv('60', sanitizePixText(input.city, 15)) +
    tlv('62', additionalData) +
    '6304'

  return body + crc16Ccitt(body)
}

export function validatePixPayloadCrc(payload: string): boolean {
  if (payload.length < 8) return false
  const withoutCrc = payload.slice(0, -4)
  const crc = payload.slice(-4)
  if (!withoutCrc.endsWith('6304')) return false
  return crc16Ccitt(withoutCrc) === crc.toUpperCase()
}
