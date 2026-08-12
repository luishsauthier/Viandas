import { supabase } from '@/lib/supabase'
import type { MenuCatalogCategory } from '@/lib/menus/presets'
import type { MenuDay, MenuItem, Week, WeekDay } from '@/types'

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

export type MenuCatalogItem = {
  id: string
  category: MenuCatalogCategory
  name: string
  sort_order: number
  created_at: string
  created_by: string | null
}

export async function fetchMenuCatalog(): Promise<MenuCatalogItem[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('menu_catalog_items')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as MenuCatalogItem[]
}

export async function createMenuCatalogItem(input: {
  category: MenuCatalogCategory
  name: string
  createdBy?: string | null
}): Promise<MenuCatalogItem> {
  const client = requireClient()
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) throw new Error('Informe o nome do item')
  const { data, error } = await client
    .from('menu_catalog_items')
    .insert({
      category: input.category,
      name,
      created_by: input.createdBy ?? null,
    })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') {
      throw new Error('Esse item já existe nesta seção')
    }
    throw error
  }
  return data as MenuCatalogItem
}

export async function deleteMenuCatalogItem(id: string): Promise<void> {
  const client = requireClient()
  const { error } = await client.from('menu_catalog_items').delete().eq('id', id)
  if (error) throw error
}

export type MenuDayWithItems = {
  weekDay: WeekDay
  menuDay: MenuDay | null
  items: MenuItem[]
}

export async function fetchWeek(weekId: string): Promise<Week | null> {
  const client = requireClient()
  const { data, error } = await client.from('weeks').select('*').eq('id', weekId).maybeSingle()
  if (error) throw error
  return data as Week | null
}

export async function fetchMenusForWeek(weekId: string): Promise<MenuDayWithItems[]> {
  const client = requireClient()
  const { data: days, error: daysError } = await client
    .from('week_days')
    .select('*')
    .eq('week_id', weekId)
    .order('date', { ascending: true })
  if (daysError) throw daysError

  const weekDays = (days ?? []) as WeekDay[]
  if (weekDays.length === 0) return []

  const dayIds = weekDays.map((day) => day.id)
  const { data: menus, error: menusError } = await client
    .from('menu_days')
    .select('*')
    .in('week_day_id', dayIds)
  if (menusError) throw menusError

  const menuDays = (menus ?? []) as MenuDay[]
  const menuIds = menuDays.map((menu) => menu.id)

  let items: MenuItem[] = []
  if (menuIds.length > 0) {
    const { data: itemRows, error: itemsError } = await client
      .from('menu_items')
      .select('*')
      .in('menu_day_id', menuIds)
      .order('sort_order', { ascending: true })
    if (itemsError) throw itemsError
    items = (itemRows ?? []) as MenuItem[]
  }

  return weekDays.map((weekDay) => {
    const menuDay = menuDays.find((menu) => menu.week_day_id === weekDay.id) ?? null
    return {
      weekDay,
      menuDay,
      items: menuDay ? items.filter((item) => item.menu_day_id === menuDay.id) : [],
    }
  })
}

export async function upsertMenuDay(input: {
  weekDayId: string
  items: string[]
  rawText?: string | null
  confirmed?: boolean
}): Promise<MenuDay> {
  const client = requireClient()
  const { data, error } = await client.rpc('upsert_menu_day', {
    p_week_day_id: input.weekDayId,
    p_items: input.items,
    p_raw_text: input.rawText ?? null,
    p_confirmed: input.confirmed ?? true,
  })
  if (error) throw error
  return data as MenuDay
}

export async function fetchTodayMenu(timezone = 'America/Sao_Paulo'): Promise<{
  weekDay: WeekDay | null
  items: MenuItem[]
  confirmed: boolean
} | null> {
  const client = requireClient()
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const { data: weekDay, error: dayError } = await client
    .from('week_days')
    .select('*')
    .eq('date', today)
    .maybeSingle()
  if (dayError) throw dayError
  if (!weekDay) {
    return { weekDay: null, items: [], confirmed: false }
  }

  const day = weekDay as WeekDay
  const { data: menuDay, error: menuError } = await client
    .from('menu_days')
    .select('*')
    .eq('week_day_id', day.id)
    .maybeSingle()
  if (menuError) throw menuError

  if (!menuDay) {
    return { weekDay: day, items: [], confirmed: false }
  }

  const menu = menuDay as MenuDay
  const { data: items, error: itemsError } = await client
    .from('menu_items')
    .select('*')
    .eq('menu_day_id', menu.id)
    .order('sort_order', { ascending: true })
  if (itemsError) throw itemsError

  return {
    weekDay: day,
    items: (items ?? []) as MenuItem[],
    confirmed: menu.confirmed,
  }
}

export async function fetchMenuForWeekDay(weekDayId: string): Promise<{
  weekDay: WeekDay
  items: MenuItem[]
  confirmed: boolean
} | null> {
  const client = requireClient()
  const { data: weekDay, error: dayError } = await client
    .from('week_days')
    .select('*')
    .eq('id', weekDayId)
    .maybeSingle()
  if (dayError) throw dayError
  if (!weekDay) return null

  const day = weekDay as WeekDay
  const { data: menuDay, error: menuError } = await client
    .from('menu_days')
    .select('*')
    .eq('week_day_id', day.id)
    .maybeSingle()
  if (menuError) throw menuError

  if (!menuDay) {
    return { weekDay: day, items: [], confirmed: false }
  }

  const menu = menuDay as MenuDay
  const { data: items, error: itemsError } = await client
    .from('menu_items')
    .select('*')
    .eq('menu_day_id', menu.id)
    .order('sort_order', { ascending: true })
  if (itemsError) throw itemsError

  return {
    weekDay: day,
    items: (items ?? []) as MenuItem[],
    confirmed: menu.confirmed,
  }
}

export type ExtractMenuResponse = {
  extractionId: string
  imagePath: string
  weekId: string
  weekDays: Array<{ id: string; weekday: number; date: string }>
  days: Array<{
    weekday: number | null
    date: string | null
    label: string | null
    items: string[]
  }>
  error?: string
}

export async function uploadMenuImage(input: {
  weekId: string
  file: File
}): Promise<string> {
  const client = requireClient()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(input.file.type)) {
    throw new Error('Use JPEG, PNG ou WEBP')
  }
  if (input.file.size > 10 * 1024 * 1024) {
    throw new Error('Imagem maior que 10 MB')
  }
  const ext =
    input.file.type === 'image/png' ? 'png' : input.file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${input.weekId}/${crypto.randomUUID()}.${ext}`
  const { error } = await client.storage.from('menu-images').upload(path, input.file, {
    upsert: false,
    contentType: input.file.type,
  })
  if (error) throw error
  return path
}

export async function extractMenuFromImage(input: {
  weekId: string
  imagePath: string
}): Promise<ExtractMenuResponse> {
  const client = requireClient()
  const { data, error } = await client.functions.invoke('extract-menu', {
    body: {
      weekId: input.weekId,
      imagePath: input.imagePath,
    },
  })
  if (error) {
    const message =
      (data as { error?: string } | null)?.error ||
      error.message ||
      'Falha ao extrair cardápio'
    throw new Error(message)
  }
  const payload = data as ExtractMenuResponse
  if (payload?.error) throw new Error(payload.error)
  return payload
}

export async function markMenuExtractionApplied(extractionId: string): Promise<void> {
  const client = requireClient()
  const { error } = await client
    .from('menu_extractions')
    .update({ status: 'applied', reviewed_at: new Date().toISOString() })
    .eq('id', extractionId)
  if (error) throw error
}
