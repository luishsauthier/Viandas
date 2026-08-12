export function formatBRL(value: number | string): string {
  const amount = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(amount)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
    .format(amount)
    .replace(/\u00a0/g, ' ')
}

export function parseBRLInput(raw: string): number {
  const normalized = raw.replace(/\s/g, '').replace('R$', '').replace(/\./g, '').replace(',', '.')
  const amount = Number(normalized)
  if (Number.isNaN(amount)) {
    throw new Error('Valor inválido')
  }
  return Math.round(amount * 100) / 100
}
