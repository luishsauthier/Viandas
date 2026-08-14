/**
 * Geração de payload PIX estático (BR Code / EMV MPM) conforme Bacen.
 */

function tlv(id: string, value: string): string {
  if (value.length > 99) {
    throw new Error('Campo PIX excede 99 caracteres')
  }
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

/**
 * Normaliza a chave para o formato aceito pelos apps bancários.
 * CNPJ/CPF vão só com dígitos; e-mail e chave aleatória (EVP) permanecem.
 */
export function normalizePixKey(raw: string): string {
  const key = raw.trim()
  if (!key) return ''
  if (key.includes('@')) return key.toLowerCase()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return key.toLowerCase()
  }
  if (key.startsWith('+')) {
    const digits = key.replace(/\D/g, '')
    return digits ? `+${digits}` : key
  }
  const digits = key.replace(/\D/g, '')
  if (digits.length === 14) return digits
  if (digits.length === 11 && /^[\d.\-\s]+$/.test(key)) return digits
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return `+${digits}`
  }
  return key
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

function merchantAccountInfo(pixKey: string, description?: string | null): string {
  const guiAndKey = tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKey)
  const extra = (description ?? '').trim()
  if (!extra) return guiAndKey
  const maxDesc = Math.min(72, 99 - guiAndKey.length - 4)
  if (maxDesc < 1) return guiAndKey
  return guiAndKey + tlv('02', sanitizePixText(extra, maxDesc))
}

export function buildPixPayload(input: BuildPixPayloadInput): string {
  const key = normalizePixKey(input.pixKey)
  if (!key) throw new Error('Chave PIX não configurada')

  const merchantAccountWithDesc = merchantAccountInfo(key, input.description)

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
