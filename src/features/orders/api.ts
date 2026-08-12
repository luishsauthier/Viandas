import { supabase } from '@/lib/supabase'
import type { MealType, Order, OrderItem, Profile, WeekDay } from '@/types'

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

export type OrderWithItems = Order & {
  items: Array<OrderItem & { meal_type?: Pick<MealType, 'id' | 'code' | 'name'> | null }>
}

export async function fetchActiveMealTypes(): Promise<MealType[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('meal_types')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as MealType[]
}

export async function isOrderWindowOpen(weekDayId: string): Promise<boolean> {
  const client = requireClient()
  const { data, error } = await client.rpc('is_order_window_open', {
    p_week_day_id: weekDayId,
  })
  if (error) throw error
  return Boolean(data)
}

export async function fetchMyOrderForDay(weekDayId: string): Promise<OrderWithItems | null> {
  const client = requireClient()
  const { data: order, error } = await client
    .from('orders')
    .select('*')
    .eq('week_day_id', weekDayId)
    .eq('profile_id', (await client.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()
  if (error) throw error
  if (!order) return null

  const { data: items, error: itemsError } = await client
    .from('order_items')
    .select('*, meal_type:meal_types(id, code, name)')
    .eq('order_id', order.id)
  if (itemsError) throw itemsError

  return {
    ...(order as Order),
    items: (items ?? []) as OrderWithItems['items'],
  }
}

export async function submitDailyOrder(input: {
  weekDayId: string
  items: Array<{ meal_type_id: string; quantity: number }>
  observation?: string | null
}): Promise<Order> {
  const client = requireClient()
  const { data, error } = await client.rpc('submit_daily_order', {
    p_week_day_id: input.weekDayId,
    p_items: input.items,
    p_observation: input.observation ?? null,
  })
  if (error) throw error
  return data as Order
}

export async function declineDailyOrder(weekDayId: string): Promise<Order> {
  const client = requireClient()
  const { data, error } = await client.rpc('decline_daily_order', {
    p_week_day_id: weekDayId,
  })
  if (error) throw error
  return data as Order
}

export async function adminSetDayStatus(
  weekDayId: string,
  status: WeekDay['status'],
): Promise<WeekDay> {
  const client = requireClient()
  const { data, error } = await client.rpc('admin_set_day_status', {
    p_week_day_id: weekDayId,
    p_status: status,
  })
  if (error) throw error
  return data as WeekDay
}

export async function adminUpsertOrder(input: {
  weekDayId: string
  profileId: string
  responseStatus: 'ordered' | 'declined'
  items?: Array<{ meal_type_id: string; quantity: number }>
  observation?: string | null
}): Promise<Order> {
  const client = requireClient()
  const { data, error } = await client.rpc('admin_upsert_order', {
    p_week_day_id: input.weekDayId,
    p_profile_id: input.profileId,
    p_response_status: input.responseStatus,
    p_items: input.items ?? [],
    p_observation: input.observation ?? null,
  })
  if (error) throw error
  return data as Order
}

export async function fetchOrdersForDay(weekDayId: string): Promise<OrderWithItems[]> {
  const client = requireClient()
  const { data: orders, error } = await client
    .from('orders')
    .select('*')
    .eq('week_day_id', weekDayId)
  if (error) throw error

  const list = (orders ?? []) as Order[]
  if (list.length === 0) return []

  const ids = list.map((order) => order.id)
  const { data: items, error: itemsError } = await client
    .from('order_items')
    .select('*, meal_type:meal_types(id, code, name)')
    .in('order_id', ids)
  if (itemsError) throw itemsError

  const allItems = (items ?? []) as OrderWithItems['items']
  return list.map((order) => ({
    ...order,
    items: allItems.filter((item) => item.order_id === order.id),
  }))
}

export async function fetchParticipantProfiles(): Promise<Profile[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .eq('is_participant', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function fetchOrdersForWeek(weekId: string): Promise<OrderWithItems[]> {
  const client = requireClient()
  const { data: days, error: daysError } = await client
    .from('week_days')
    .select('id')
    .eq('week_id', weekId)
  if (daysError) throw daysError
  const dayIds = (days ?? []).map((day) => day.id as string)
  if (dayIds.length === 0) return []

  const { data: orders, error } = await client.from('orders').select('*').in('week_day_id', dayIds)
  if (error) throw error
  const list = (orders ?? []) as Order[]
  if (list.length === 0) return []

  const { data: items, error: itemsError } = await client
    .from('order_items')
    .select('*, meal_type:meal_types(id, code, name)')
    .in(
      'order_id',
      list.map((order) => order.id),
    )
  if (itemsError) throw itemsError
  const allItems = (items ?? []) as OrderWithItems['items']
  return list.map((order) => ({
    ...order,
    items: allItems.filter((item) => item.order_id === order.id),
  }))
}

export async function updateMyDefaultOrder(input: {
  defaultMealTypeId: string | null
  defaultQuantity: number
}): Promise<void> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')
  const { error } = await client
    .from('profiles')
    .update({
      default_meal_type_id: input.defaultMealTypeId,
      default_quantity: input.defaultQuantity,
    })
    .eq('id', userId)
  if (error) throw error
}
