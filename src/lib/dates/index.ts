const WEEKDAY_NAMES: Record<number, string> = {
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
  7: 'Domingo',
}

const WEEKDAY_SHORT: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
  7: 'Dom',
}

/** ISO weekday: 1=segunda … 7=domingo */
export function weekdayName(weekday: number, short = false): string {
  return (short ? WEEKDAY_SHORT : WEEKDAY_NAMES)[weekday] ?? String(weekday)
}

export function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return isoDate
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}

export function formatDateRangeBR(startDate: string, endDate: string): string {
  return `${formatDateBR(startDate)} – ${formatDateBR(endDate)}`
}

export function toISODateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Sugere a segunda-feira da semana corrente (fuso local do navegador). */
export function suggestWeekStartDate(now = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = date.getDay() // 0=domingo
  const diffToMonday = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diffToMonday)
  return toISODateInput(date)
}

export function timeInputFromDb(value: string): string {
  // "08:30:00" | "08:30"
  return value.slice(0, 5)
}

export function timeDbFromInput(value: string): string {
  return value.length === 5 ? `${value}:00` : value
}
