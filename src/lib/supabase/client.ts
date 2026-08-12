import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

/**
 * Cliente Supabase do frontend (chave publicável apenas).
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabasePublishableKey ? createClient(supabaseUrl, supabasePublishableKey) : null

export function getAppBaseUrl(): string {
  return import.meta.env.VITE_APP_BASE_URL?.replace(/\/$/, '') || window.location.origin
}
