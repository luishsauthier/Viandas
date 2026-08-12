import { mapExtractionToWeekDays } from '../src/lib/menus/mapExtraction'

function assertDeepEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}:\nexpected ${e}\ngot ${a}`)
}

const weekDays = [
  { id: 'd1', weekday: 1, date: '2026-08-10' },
  { id: 'd2', weekday: 2, date: '2026-08-11' },
  { id: 'd3', weekday: 3, date: '2026-08-12' },
]

assertDeepEqual(
  mapExtractionToWeekDays({
    weekDays,
    extracted: [
      { weekday: 1, items: ['Arroz', 'Feijão'] },
      { date: '2026-08-12', items: ['Massa'] },
      { weekday: 6, items: ['Feijoada'] },
    ],
  }),
  {
    mapped: [
      { weekDayId: 'd1', weekday: 1, date: '2026-08-10', items: ['Arroz', 'Feijão'] },
      { weekDayId: 'd3', weekday: 3, date: '2026-08-12', items: ['Massa'] },
    ],
    ignored: [
      {
        reason: 'Dia não faz parte da semana ativa',
        items: ['Feijoada'],
        weekday: 6,
        date: null,
      },
    ],
  },
  'mapeia ativos e ignora sábado',
)

console.log('mapExtraction tests passed')
