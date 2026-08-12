-- Restringe recalculate_weekly_account a próprio usuário ou admin

create or replace function public.recalculate_weekly_account(
  p_profile_id uuid,
  p_week_id uuid
)
returns public.weekly_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charges numeric(10, 2) := 0;
  v_adjustments numeric(10, 2) := 0;
  v_credit numeric(10, 2) := 0;
  v_payments numeric(10, 2) := 0;
  v_balance numeric(10, 2) := 0;
  v_status public.financial_status;
  v_account public.weekly_accounts;
  v_has_pending_payment boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if auth.uid() <> p_profile_id and not public.is_admin() then
    raise exception 'Sem permissão para recalcular esta conta';
  end if;

  select coalesce(sum(oi.quantity * oi.unit_price_snapshot), 0)
  into v_charges
  from public.orders o
  join public.week_days wd on wd.id = o.week_day_id
  join public.order_items oi on oi.order_id = o.id
  where o.profile_id = p_profile_id
    and wd.week_id = p_week_id
    and o.response_status = 'ordered';

  select coalesce(sum(oa.amount), 0)
  into v_adjustments
  from public.order_adjustments oa
  join public.orders o on o.id = oa.order_id
  join public.week_days wd on wd.id = o.week_day_id
  where o.profile_id = p_profile_id
    and wd.week_id = p_week_id
    and oa.reversed_at is null;

  select coalesce(credit_applied, 0), coalesce(payments_applied, 0)
  into v_credit, v_payments
  from public.weekly_accounts
  where week_id = p_week_id and profile_id = p_profile_id;

  v_credit := coalesce(v_credit, 0);
  v_payments := coalesce(v_payments, 0);
  v_balance := round((v_charges + v_adjustments - v_credit - v_payments)::numeric, 2);
  v_has_pending_payment := false;

  if v_balance < 0 then
    v_status := 'credit';
  elsif v_balance = 0 then
    v_status := 'paid';
  elsif v_has_pending_payment then
    v_status := 'waiting_validation';
  elsif v_payments > 0 then
    v_status := 'partial';
  else
    v_status := 'pending';
  end if;

  insert into public.weekly_accounts (
    week_id, profile_id, charges_total, adjustments_total,
    credit_applied, payments_applied, balance_due, status
  ) values (
    p_week_id, p_profile_id, v_charges, v_adjustments,
    v_credit, v_payments, v_balance, v_status
  )
  on conflict (week_id, profile_id)
  do update set
    charges_total = excluded.charges_total,
    adjustments_total = excluded.adjustments_total,
    credit_applied = excluded.credit_applied,
    payments_applied = excluded.payments_applied,
    balance_due = excluded.balance_due,
    status = excluded.status,
    updated_at = now()
  returning * into v_account;

  return v_account;
end;
$$;
