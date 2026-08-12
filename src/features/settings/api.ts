import { supabase } from '@/lib/supabase'
import { APP_SETTINGS_ID } from '@/lib/constants'
import type { AppSettings, MealType, Week, WeekDay } from '@/types'

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const client = requireClient()
  const { data, error } = await client
    .from('app_settings')
    .select('*')
    .eq('id', APP_SETTINGS_ID)
    .single()
  if (error) throw error
  return data as AppSettings
}

export async function updateAppSettings(
  patch: Partial<AppSettings>,
  userId: string,
): Promise<AppSettings> {
  const client = requireClient()
  const { data, error } = await client
    .from('app_settings')
    .update({ ...patch, updated_by: userId })
    .eq('id', APP_SETTINGS_ID)
    .select('*')
    .single()
  if (error) throw error
  return data as AppSettings
}

export async function fetchMealTypes(): Promise<MealType[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('meal_types')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as MealType[]
}

export async function updateMealType(
  id: string,
  patch: Partial<Pick<MealType, 'name' | 'current_price' | 'is_active' | 'sort_order'>>,
): Promise<MealType> {
  const client = requireClient()
  const { data, error } = await client
    .from('meal_types')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as MealType
}

export async function fetchCurrentWeek(): Promise<Week | null> {
  const client = requireClient()
  const { data, error } = await client
    .from('weeks')
    .select('*')
    .eq('status', 'current')
    .maybeSingle()
  if (error) throw error
  return data as Week | null
}

export async function fetchWeekDays(weekId: string): Promise<WeekDay[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('week_days')
    .select('*')
    .eq('week_id', weekId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as WeekDay[]
}

export async function createWeek(startDate: string): Promise<Week> {
  const client = requireClient()
  const { data, error } = await client.rpc('create_week', { p_start_date: startDate })
  if (error) throw error
  return data as Week
}

export async function countActiveEmployees(): Promise<number> {
  const client = requireClient()
  const { count, error } = await client
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
  if (error) throw error
  return count ?? 0
}
