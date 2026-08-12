const E164_REGEX = /^\+[1-9][0-9]{7,14}$/

export function normalizePhoneToE164(input: string, defaultCountry = '55'): string {
  const digits = input.replace(/\D/g, '')
  if (!digits) {
    throw new Error('Telefone inválido')
  }

  let normalized = digits
  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1)
  }
  if (!normalized.startsWith(defaultCountry)) {
    normalized = `${defaultCountry}${normalized}`
  }

  const e164 = `+${normalized}`
  if (!E164_REGEX.test(e164)) {
    throw new Error('Telefone inválido')
  }
  return e164
}

/** Máscara progressiva para digitação BR: (51) 99999-9999 */
export function maskPhoneBR(input: string): string {
  let digits = input.replace(/\D/g, '')

  // Se colar com DDI 55, remove para mascarar o número local
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.slice(2)
  }

  digits = digits.slice(0, 11)

  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatPhoneBR(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  const local = digits.startsWith('55') ? digits.slice(2) : digits
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }
  return phoneE164
}

export function phoneToAuthEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  return `${digits}@phone.viandas.local`
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin)
}

/** Aceita apenas dígitos, no máximo 6. */
export function maskPin(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6)
}
