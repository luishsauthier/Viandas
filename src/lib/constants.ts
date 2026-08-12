/** Limites de aplicação (código). */
export const APP_LIMITS = {
  maxQuantityPerMealType: 10,
  maxObservationLength: 300,
  maxReceiptBytes: 10 * 1024 * 1024,
  receiptMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const,
} as const

export const APP_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

/** Opções padrão de timezone (IANA) para o combobox de configurações. */
export const TIMEZONE_OPTIONS = [
  { value: 'America/Sao_Paulo', label: 'Brasília (America/Sao_Paulo)' },
  { value: 'America/Manaus', label: 'Manaus (America/Manaus)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (America/Cuiaba)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (America/Porto_Velho)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (America/Rio_Branco)' },
  { value: 'America/Belem', label: 'Belém (America/Belem)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (America/Fortaleza)' },
  { value: 'America/Recife', label: 'Recife (America/Recife)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (America/Noronha)' },
] as const

export function timezoneSelectOptions(current?: string | null): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = TIMEZONE_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }))
  const value = current?.trim()
  if (value && !options.some((option) => option.value === value)) {
    options.unshift({ value, label: `${value} (atual)` })
  }
  return options
}
