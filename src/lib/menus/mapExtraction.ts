/**
 * Mapeia resultado da IA para os dias ativos da semana do sistema.
 * A semana cadastrada é a fonte da verdade — datas da imagem são só apoio.
 */

export type ExtractedMenuDay = {
  weekday?: number | null
  date?: string | null
  items: string[]
  label?: string | null
}

export type MappedMenuDay = {
  weekDayId: string
  weekday: number
  date: string
  items: string[]
}

export type MapExtractionResult = {
  mapped: MappedMenuDay[]
  ignored: Array<{ reason: string; items: string[]; weekday?: number | null; date?: string | null }>
}

export function mapExtractionToWeekDays(input: {
  weekDays: Array<{ id: string; weekday: number; date: string }>
  extracted: ExtractedMenuDay[]
}): MapExtractionResult {
  const byWeekday = new Map(input.weekDays.map((day) => [day.weekday, day]))
  const byDate = new Map(input.weekDays.map((day) => [day.date, day]))
  const used = new Set<string>()
  const mapped: MappedMenuDay[] = []
  const ignored: MapExtractionResult['ignored'] = []

  for (const entry of input.extracted) {
    const items = entry.items.map((item) => item.trim()).filter(Boolean)
    if (items.length === 0) continue

    let match =
      (entry.date && byDate.get(entry.date)) ||
      (entry.weekday != null ? byWeekday.get(Number(entry.weekday)) : undefined)

    if (!match) {
      ignored.push({
        reason: 'Dia não faz parte da semana ativa',
        items,
        weekday: entry.weekday ?? null,
        date: entry.date ?? null,
      })
      continue
    }

    if (used.has(match.id)) {
      // mescla itens se a IA repetiu o mesmo dia
      const existing = mapped.find((row) => row.weekDayId === match!.id)
      if (existing) {
        existing.items = [...existing.items, ...items]
      }
      continue
    }

    used.add(match.id)
    mapped.push({
      weekDayId: match.id,
      weekday: match.weekday,
      date: match.date,
      items,
    })
  }

  return { mapped, ignored }
}
