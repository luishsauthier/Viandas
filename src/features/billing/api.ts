import { supabase } from '@/lib/supabase'
import type { OrderAdjustment, WeeklyAccount, Week } from '@/types'

function requireClient() {
  if (!supabase) throw new Error('Supabase não configurado')
  return supabase
}

export async function fetchWeeklyAccountsForWeek(weekId: string): Promise<WeeklyAccount[]> {
  const client = requireClient()
  const { data, error } = await client.from('weekly_accounts').select('*').eq('week_id', weekId)
  if (error) throw error
  return (data ?? []) as WeeklyAccount[]
}

export async function fetchMyWeeklyAccount(weekId: string): Promise<WeeklyAccount | null> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')
  const { data, error } = await client
    .from('weekly_accounts')
    .select('*')
    .eq('week_id', weekId)
    .eq('profile_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as WeeklyAccount | null) ?? null
}

export async function recalculateMyWeeklyAccount(weekId: string): Promise<WeeklyAccount> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')
  const { data, error } = await client.rpc('recalculate_weekly_account', {
    p_profile_id: userId,
    p_week_id: weekId,
  })
  if (error) throw error
  return data as WeeklyAccount
}

export async function applyMyAvailableCredit(weekId: string): Promise<WeeklyAccount> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')
  const { data, error } = await client.rpc('apply_available_credit', {
    p_profile_id: userId,
    p_week_id: weekId,
  })
  if (error) throw error
  return data as WeeklyAccount
}

export async function fetchMyCreditBalance(): Promise<number> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')
  const { data, error } = await client.rpc('get_credit_balance', {
    p_profile_id: userId,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function fetchMyWeeklyAccounts(): Promise<
  Array<WeeklyAccount & { week?: Pick<Week, 'id' | 'start_date' | 'end_date' | 'status'> | null }>
> {
  const client = requireClient()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error('Não autenticado')
  const { data, error } = await client
    .from('weekly_accounts')
    .select('*, week:weeks(id, start_date, end_date, status)')
    .eq('profile_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Array<
    WeeklyAccount & { week?: Pick<Week, 'id' | 'start_date' | 'end_date' | 'status'> | null }
  >
}

export async function fetchAdjustmentsForOrders(orderIds: string[]): Promise<OrderAdjustment[]> {
  if (orderIds.length === 0) return []
  const client = requireClient()
  const { data, error } = await client
    .from('order_adjustments')
    .select('*')
    .in('order_id', orderIds)
    .is('reversed_at', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as OrderAdjustment[]
}

export async function adminAddOrderAdjustment(input: {
  orderId: string
  amount: number
  reason: string
}): Promise<OrderAdjustment> {
  const client = requireClient()
  const { data, error } = await client.rpc('admin_add_order_adjustment', {
    p_order_id: input.orderId,
    p_amount: input.amount,
    p_reason: input.reason,
  })
  if (error) throw error
  return data as OrderAdjustment
}

export async function fetchWeeksForEmployee(): Promise<Week[]> {
  const client = requireClient()
  const { data, error } = await client
    .from('weeks')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as Week[]
}

export async function fetchWeekById(weekId: string): Promise<Week | null> {
  const client = requireClient()
  const { data, error } = await client.from('weeks').select('*').eq('id', weekId).maybeSingle()
  if (error) throw error
  return (data as Week | null) ?? null
}
