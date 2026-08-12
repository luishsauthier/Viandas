export const MENU_BASE_ITEMS = ['Arroz', 'Feijão'] as const

export type MenuCatalogCategory = 'carb' | 'meat' | 'side'

export const MENU_CATALOG_GROUPS: Array<{
  id: MenuCatalogCategory
  label: string
}> = [
  { id: 'carb', label: 'Carboidrato' },
  { id: 'meat', label: 'Proteína' },
  { id: 'side', label: 'Complemento' },
]

export function normalizeMenuItem(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
}

export function parseMenuLines(text: string): string[] {
  const seen = new Set<string>()
  const items: string[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/\s+/g, ' ')
    if (!trimmed) continue
    const key = normalizeMenuItem(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(trimmed)
  }
  return items
}

export function serializeMenuLines(items: string[]): string {
  return items.join('\n')
}

export function hasMenuItem(items: string[], name: string): boolean {
  const key = normalizeMenuItem(name)
  return items.some((item) => normalizeMenuItem(item) === key)
}

export function toggleMenuItem(items: string[], name: string): string[] {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) return items
  const key = normalizeMenuItem(trimmed)
  if (items.some((item) => normalizeMenuItem(item) === key)) {
    return items.filter((item) => normalizeMenuItem(item) !== key)
  }
  return [...items, trimmed]
}

export function addMenuItem(items: string[], name: string): string[] {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) return items
  if (hasMenuItem(items, trimmed)) return items
  return [...items, trimmed]
}

export function removeMenuItem(items: string[], name: string): string[] {
  const key = normalizeMenuItem(name)
  return items.filter((item) => normalizeMenuItem(item) !== key)
}

export function ensureBaseItems(items: string[]): string[] {
  let next = [...items]
  for (const base of MENU_BASE_ITEMS) {
    next = addMenuItem(next, base)
  }
  const baseKeys = new Set(MENU_BASE_ITEMS.map((item) => normalizeMenuItem(item)))
  const bases = MENU_BASE_ITEMS.filter((base) => hasMenuItem(next, base))
  const rest = next.filter((item) => !baseKeys.has(normalizeMenuItem(item)))
  return [...bases, ...rest]
}
