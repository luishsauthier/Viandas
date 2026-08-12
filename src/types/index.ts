export type UserRole = 'admin' | 'employee'

export type WeekStatus = 'current' | 'open' | 'closed'

export type WeekDayStatus = 'scheduled' | 'open' | 'closed' | 'reopened'

export type OrderResponseStatus = 'ordered' | 'declined'

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'reversed'

export type FinancialStatus = 'pending' | 'partial' | 'waiting_validation' | 'paid' | 'credit'

export type Profile = {
  id: string
  name: string
  phone: string
  role: UserRole
  is_participant: boolean
  is_active: boolean
  activated_at: string | null
  default_meal_type_id: string | null
  default_quantity: number
  created_at: string
  updated_at: string
}

export type AppSettings = {
  id: string
  app_name: string
  timezone: string
  restaurant_name: string
  restaurant_phone: string | null
  restaurant_notes: string | null
  pix_key: string
  pix_recipient_name: string
  pix_city: string
  pix_description: string | null
  order_open_time: string
  order_close_time: string
  active_weekdays: number[]
  updated_at: string
  updated_by: string | null
}

export type MealType = {
  id: string
  code: string
  name: string
  current_price: number | string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type Week = {
  id: string
  start_date: string
  end_date: string
  status: WeekStatus
  created_at: string
  created_by: string | null
  closed_at: string | null
}

export type WeekDay = {
  id: string
  week_id: string
  date: string
  weekday: number
  status: WeekDayStatus
  manual_closed_at: string | null
  reopened_at: string | null
  created_at: string
}

export type MenuDay = {
  id: string
  week_day_id: string
  raw_text: string | null
  confirmed: boolean
  source_image_path?: string | null
  created_at: string
  updated_at: string
}

export type MenuItem = {
  id: string
  menu_day_id: string
  name: string
  sort_order: number
}

export type Order = {
  id: string
  week_day_id: string
  profile_id: string
  response_status: OrderResponseStatus
  observation: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export type OrderItem = {
  id: string
  order_id: string
  meal_type_id: string
  quantity: number
  unit_price_snapshot: number | string
  created_at: string
}

export type OrderAdjustment = {
  id: string
  order_id: string
  amount: number | string
  reason: string
  created_by: string | null
  created_at: string
  reversed_at: string | null
  reversed_by: string | null
  reversal_reason: string | null
}

export type WeeklyAccount = {
  id: string
  week_id: string
  profile_id: string
  charges_total: number | string
  adjustments_total: number | string
  credit_applied: number | string
  payments_applied: number | string
  balance_due: number | string
  status: FinancialStatus
  updated_at: string
}

export type Payment = {
  id: string
  profile_id: string
  submitted_from_week_id: string | null
  amount: number | string
  status: PaymentStatus
  receipt_path: string
  user_note: string | null
  admin_note: string | null
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  rejection_reason: string | null
}
