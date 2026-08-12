const MONTH_NAMES_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

export const PIX_DESCRIPTION_VARIABLES = [
  { token: '{{nome}}', label: 'Nome do funcionário', example: 'Maria' },
  { token: '{{nome_completo}}', label: 'Nome completo', example: 'Maria Silva' },
  { token: '{{semana}}', label: 'Período da semana', example: '11/08 - 15/08' },
  { token: '{{mes}}', label: 'Mês', example: 'agosto' },
  { token: '{{ano}}', label: 'Ano', example: '2026' },
  { token: '{{valor}}', label: 'Valor do PIX', example: '63 REAIS' },
] as const

export type PixDescriptionContext = {
  employeeName: string
  weekStartDate: string
  weekEndDate: string
  amount?: number | null
}

function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}`
}

function monthNameFromIso(isoDate: string): string {
  const month = Number(isoDate.split('-')[1])
  return MONTH_NAMES_PT[month - 1] ?? ''
}

function yearFromIso(isoDate: string): string {
  return isoDate.split('-')[0] ?? ''
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? trimmed
}

function formatValorForDescription(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return ''
  const reais = Math.floor(amount)
  const cents = Math.round((amount - reais) * 100)
  if (cents === 0) return `${reais} REAIS`
  return `${reais} REAIS ${String(cents).padStart(2, '0')}`
}

export function buildPixDescriptionValues(ctx: PixDescriptionContext): Record<string, string> {
  const full = ctx.employeeName.trim()
  return {
    nome: firstName(full) || full,
    nome_completo: full,
    semana: `${formatDateBR(ctx.weekStartDate)} - ${formatDateBR(ctx.weekEndDate)}`,
    mes: monthNameFromIso(ctx.weekStartDate),
    ano: yearFromIso(ctx.weekStartDate),
    valor: formatValorForDescription(ctx.amount),
  }
}

/** Substitui `{{variavel}}` no template. Variáveis desconhecidas ficam vazias. */
export function resolvePixDescriptionTemplate(
  template: string | null | undefined,
  ctx: PixDescriptionContext,
): string {
  const raw = (template ?? '').trim()
  if (!raw) return ''
  const values = buildPixDescriptionValues(ctx)
  return raw
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key: string) => {
      const value = values[key.toLowerCase()]
      return value ?? ''
    })
    .replace(/\s+/g, ' ')
    .trim()
}

export function previewPixDescriptionTemplate(template: string | null | undefined): string {
  return resolvePixDescriptionTemplate(template, {
    employeeName: 'Maria Silva',
    weekStartDate: '2026-08-11',
    weekEndDate: '2026-08-15',
    amount: 63,
  })
}
