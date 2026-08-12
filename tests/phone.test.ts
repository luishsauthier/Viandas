import {
  normalizePhoneToE164,
  formatPhoneBR,
  phoneToAuthEmail,
  isValidPin,
  maskPhoneBR,
  maskPin,
} from '../src/lib/phone'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

assertEqual(normalizePhoneToE164('(51) 99999-9999'), '+5551999999999', 'normalize masked')
assertEqual(normalizePhoneToE164('51999999999'), '+5551999999999', 'normalize local')
assertEqual(normalizePhoneToE164('+5551999999999'), '+5551999999999', 'normalize e164')
assertEqual(formatPhoneBR('+5551999999999'), '(51) 99999-9999', 'format br')
assertEqual(phoneToAuthEmail('+5551999999999'), '5551999999999@phone.viandas.local', 'auth email')
assertEqual(isValidPin('123456'), true, 'pin ok')
assertEqual(isValidPin('12345'), false, 'pin short')
assertEqual(maskPhoneBR('51999999999'), '(51) 99999-9999', 'mask full')
assertEqual(maskPhoneBR('5199'), '(51) 99', 'mask partial')
assertEqual(maskPin('12a34567'), '123456', 'mask pin')

console.log('phone tests passed')
