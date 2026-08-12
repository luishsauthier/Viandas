import {
  formatDateBR,
  formatDateRangeBR,
  suggestWeekStartDate,
  timeDbFromInput,
  timeInputFromDb,
  weekdayName,
} from '../src/lib/dates'

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

assertEqual(weekdayName(1), 'Segunda-feira', 'weekday')
assertEqual(weekdayName(5, true), 'Sex', 'weekday short')
assertEqual(formatDateBR('2026-08-12'), '12/08', 'format date')
assertEqual(formatDateRangeBR('2026-08-10', '2026-08-14'), '10/08 – 14/08', 'range')
assertEqual(timeInputFromDb('08:30:00'), '08:30', 'time input')
assertEqual(timeDbFromInput('10:30'), '10:30:00', 'time db')

const monday = suggestWeekStartDate(new Date(2026, 7, 12)) // Wed Aug 12 2026
assertEqual(monday, '2026-08-10', 'suggest monday')

console.log('date tests passed')
