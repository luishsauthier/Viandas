-- Fase 6: ajustes financeiros, weekly_accounts e recálculo

create type public.financial_status as enum (
  'pending',
  'partial',
  'waiting_validation',
  'paid',
  'credit'
);

create table public.order_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(10, 2) not null check (amount <> 0),
  reason text not null check (length(trim(reason)) > 0),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles (id) on delete set null,
  reversal_reason text
);

create table public.weekly_accounts (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  charges_total numeric(10, 2) not null default 0,
  adjustments_total numeric(10, 2) not null default 0,
  credit_applied numeric(10, 2) not null default 0,
  payments_applied numeric(10, 2) not null default 0,
  balance_due numeric(10, 2) not null default 0,
  status public.financial_status not null default 'pending',
  updated_at timestamptz not null default now(),
  unique (week_id, profile_id)
);

create index order_adjustments_order_id_idx on public.order_adjustments (order_id);
create index weekly_accounts_week_id_idx on public.weekly_accounts (week_id);
create index weekly_accounts_profile_id_idx on public.weekly_accounts (profile_id);

create trigger weekly_accounts_set_updated_at
before update on public.weekly_accounts
for each row execute function public.set_updated_at();

alter table public.order_adjustments enable row level security;
alter table public.weekly_accounts enable row level security;

create policy order_adjustments_select_own_or_admin
on public.order_adjustments for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.orders o
    where o.id = order_id and o.profile_id = auth.uid()
  )
);

create policy weekly_accounts_select_own_or_admin
on public.weekly_accounts for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

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

  -- Consumo: itens de pedidos ordered na semana
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

  -- payments/credit entram nas fases 7/8; preserva valores já existentes se houver
  select coalesce(credit_applied, 0), coalesce(payments_applied, 0)
  into v_credit, v_payments
  from public.weekly_accounts
  where week_id = p_week_id and profile_id = p_profile_id;

  v_credit := coalesce(v_credit, 0);
  v_payments := coalesce(v_payments, 0);
  v_balance := round((v_charges + v_adjustments - v_credit - v_payments)::numeric, 2);
  v_has_pending_payment := false; -- tabela payments na Fase 7

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

revoke all on function public.recalculate_weekly_account(uuid, uuid) from public;
revoke all on function public.recalculate_weekly_account(uuid, uuid) from anon;
grant execute on function public.recalculate_weekly_account(uuid, uuid) to authenticated;

create or replace function public.recalculate_accounts_for_week_day(p_week_day_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_id uuid;
  v_profile_id uuid;
begin
  select week_id into v_week_id from public.week_days where id = p_week_day_id;
  if v_week_id is null then
    return;
  end if;

  for v_profile_id in
    select distinct profile_id from public.orders where week_day_id = p_week_day_id
  loop
    perform public.recalculate_weekly_account(v_profile_id, v_week_id);
  end loop;

  -- participantes sem pedido também podem ter conta zerada se já existir
  for v_profile_id in
    select profile_id from public.weekly_accounts where week_id = v_week_id
  loop
    perform public.recalculate_weekly_account(v_profile_id, v_week_id);
  end loop;
end;
$$;

create or replace function public.admin_add_order_adjustment(
  p_order_id uuid,
  p_amount numeric,
  p_reason text
)
returns public.order_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_week_id uuid;
  v_adj public.order_adjustments;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  if p_amount = 0 then
    raise exception 'Valor do ajuste não pode ser zero';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Justificativa obrigatória';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Pedido não encontrado';
  end if;
  if v_order.response_status <> 'ordered' then
    raise exception 'Ajuste só pode ser aplicado em pedido confirmado';
  end if;

  insert into public.order_adjustments (order_id, amount, reason, created_by)
  values (p_order_id, round(p_amount::numeric, 2), trim(p_reason), auth.uid())
  returning * into v_adj;

  select week_id into v_week_id from public.week_days where id = v_order.week_day_id;
  perform public.recalculate_weekly_account(v_order.profile_id, v_week_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'admin_add_order_adjustment',
    'order_adjustment',
    v_adj.id,
    jsonb_build_object('order_id', p_order_id, 'amount', p_amount, 'reason', trim(p_reason))
  );

  return v_adj;
end;
$$;

revoke all on function public.admin_add_order_adjustment(uuid, numeric, text) from public;
revoke all on function public.admin_add_order_adjustment(uuid, numeric, text) from anon;
grant execute on function public.admin_add_order_adjustment(uuid, numeric, text) to authenticated;

create or replace function public.week_has_financial_pending(p_week_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.weekly_accounts wa
    where wa.week_id = p_week_id
      and wa.balance_due > 0
  );
$$;

-- Atualiza RPCs de pedido para recalcular contas
create or replace function public.submit_daily_order(
  p_week_day_id uuid,
  p_items jsonb,
  p_observation text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_order public.orders;
  v_item jsonb;
  v_meal public.meal_types;
  v_qty integer;
  v_total_qty integer := 0;
  v_obs text;
  v_week_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not v_profile.is_active then raise exception 'Perfil inválido'; end if;
  if not v_profile.is_participant then raise exception 'Perfil não participa dos pedidos'; end if;
  if not public.is_order_window_open(p_week_day_id) then raise exception 'Pedidos fechados para este dia'; end if;

  v_obs := nullif(trim(coalesce(p_observation, '')), '');
  if v_obs is not null and char_length(v_obs) > 300 then
    raise exception 'Observação deve ter no máximo 300 caracteres';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Itens inválidos'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty < 0 or v_qty > 10 then raise exception 'Quantidade inválida'; end if;
    if v_qty > 0 then
      v_total_qty := v_total_qty + v_qty;
      select * into v_meal from public.meal_types where id = (v_item->>'meal_type_id')::uuid;
      if v_meal.id is null or not v_meal.is_active then
        raise exception 'Tipo de vianda inválido ou inativo';
      end if;
    end if;
  end loop;
  if v_total_qty <= 0 then
    raise exception 'Informe ao menos um item ou use Não vou pedir hoje';
  end if;

  insert into public.orders (week_day_id, profile_id, response_status, observation, created_by, updated_by)
  values (p_week_day_id, auth.uid(), 'ordered', v_obs, auth.uid(), auth.uid())
  on conflict (week_day_id, profile_id) do update set
    response_status = 'ordered',
    observation = excluded.observation,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_order;

  delete from public.order_items where order_id = v_order.id;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty > 0 then
      select * into v_meal from public.meal_types where id = (v_item->>'meal_type_id')::uuid;
      insert into public.order_items (order_id, meal_type_id, quantity, unit_price_snapshot)
      values (v_order.id, v_meal.id, v_qty, v_meal.current_price);
    end if;
  end loop;

  select week_id into v_week_id from public.week_days where id = p_week_day_id;
  perform public.recalculate_weekly_account(auth.uid(), v_week_id);
  return v_order;
end;
$$;

create or replace function public.decline_daily_order(p_week_day_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_order public.orders;
  v_week_id uuid;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not v_profile.is_active or not v_profile.is_participant then
    raise exception 'Perfil inválido';
  end if;
  if not public.is_order_window_open(p_week_day_id) then
    raise exception 'Pedidos fechados para este dia';
  end if;

  insert into public.orders (week_day_id, profile_id, response_status, observation, created_by, updated_by)
  values (p_week_day_id, auth.uid(), 'declined', null, auth.uid(), auth.uid())
  on conflict (week_day_id, profile_id) do update set
    response_status = 'declined',
    observation = null,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_order;

  delete from public.order_items where order_id = v_order.id;
  select week_id into v_week_id from public.week_days where id = p_week_day_id;
  perform public.recalculate_weekly_account(auth.uid(), v_week_id);
  return v_order;
end;
$$;

create or replace function public.admin_upsert_order(
  p_week_day_id uuid,
  p_profile_id uuid,
  p_response_status public.order_response_status,
  p_items jsonb default '[]'::jsonb,
  p_observation text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_meal public.meal_types;
  v_qty integer;
  v_total_qty integer := 0;
  v_obs text;
  v_week_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Apenas administradores'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and is_active) then
    raise exception 'Funcionário inválido';
  end if;

  v_obs := nullif(trim(coalesce(p_observation, '')), '');
  if p_response_status = 'declined' then
    v_obs := null;
  elsif v_obs is not null and char_length(v_obs) > 300 then
    raise exception 'Observação deve ter no máximo 300 caracteres';
  end if;

  if p_response_status = 'ordered' then
    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      v_qty := coalesce((v_item->>'quantity')::integer, 0);
      if v_qty < 0 or v_qty > 10 then raise exception 'Quantidade inválida'; end if;
      if v_qty > 0 then
        v_total_qty := v_total_qty + v_qty;
        select * into v_meal from public.meal_types where id = (v_item->>'meal_type_id')::uuid;
        if v_meal.id is null then raise exception 'Tipo de vianda inválido'; end if;
      end if;
    end loop;
    if v_total_qty <= 0 then raise exception 'Pedido ordered precisa de itens'; end if;
  end if;

  insert into public.orders (week_day_id, profile_id, response_status, observation, created_by, updated_by)
  values (p_week_day_id, p_profile_id, p_response_status, v_obs, auth.uid(), auth.uid())
  on conflict (week_day_id, profile_id) do update set
    response_status = excluded.response_status,
    observation = excluded.observation,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_order;

  delete from public.order_items where order_id = v_order.id;
  if p_response_status = 'ordered' then
    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
      v_qty := coalesce((v_item->>'quantity')::integer, 0);
      if v_qty > 0 then
        select * into v_meal from public.meal_types where id = (v_item->>'meal_type_id')::uuid;
        insert into public.order_items (order_id, meal_type_id, quantity, unit_price_snapshot)
        values (v_order.id, v_meal.id, v_qty, v_meal.current_price);
      end if;
    end loop;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'admin_upsert_order', 'order', v_order.id,
    jsonb_build_object('week_day_id', p_week_day_id, 'profile_id', p_profile_id, 'response_status', p_response_status)
  );

  select week_id into v_week_id from public.week_days where id = p_week_day_id;
  perform public.recalculate_weekly_account(p_profile_id, v_week_id);
  return v_order;
end;
$$;
