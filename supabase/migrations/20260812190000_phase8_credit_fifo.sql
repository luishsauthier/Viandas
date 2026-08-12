-- Fase 8: allocations, credit ledger, FIFO, aplicação de crédito e fechamento

create type public.credit_ledger_type as enum (
  'generated',
  'applied',
  'correction',
  'reversal'
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  weekly_account_id uuid not null references public.weekly_accounts (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index payment_allocations_account_id_idx on public.payment_allocations (weekly_account_id);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  week_id uuid references public.weeks (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  type public.credit_ledger_type not null,
  amount numeric(10, 2) not null check (amount <> 0),
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_ledger_profile_id_idx on public.credit_ledger (profile_id);
create index credit_ledger_week_id_idx on public.credit_ledger (week_id);
create index credit_ledger_payment_id_idx on public.credit_ledger (payment_id);

alter table public.payment_allocations enable row level security;
alter table public.credit_ledger enable row level security;

create policy payment_allocations_select_own_or_admin
on public.payment_allocations for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.weekly_accounts wa
    where wa.id = weekly_account_id and wa.profile_id = auth.uid()
  )
);

create policy credit_ledger_select_own_or_admin
on public.credit_ledger for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

-- Saldo de crédito disponível (positivo = crédito)
create or replace function public.get_credit_balance(p_profile_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric(10, 2)
  from public.credit_ledger
  where profile_id = p_profile_id;
$$;

revoke all on function public.get_credit_balance(uuid) from public;
revoke all on function public.get_credit_balance(uuid) from anon;
grant execute on function public.get_credit_balance(uuid) to authenticated;

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

  -- Garante linha da conta para poder somar alocações
  insert into public.weekly_accounts (week_id, profile_id)
  values (p_week_id, p_profile_id)
  on conflict (week_id, profile_id) do nothing;

  select coalesce(sum(pa.amount), 0)
  into v_payments
  from public.payment_allocations pa
  join public.weekly_accounts wa on wa.id = pa.weekly_account_id
  where wa.week_id = p_week_id
    and wa.profile_id = p_profile_id;

  -- Crédito aplicado na semana = soma dos débitos (amount negativo) do tipo applied
  select coalesce(sum(-cl.amount), 0)
  into v_credit
  from public.credit_ledger cl
  where cl.profile_id = p_profile_id
    and cl.week_id = p_week_id
    and cl.type = 'applied'
    and cl.amount < 0;

  v_balance := round((v_charges + v_adjustments - v_credit - v_payments)::numeric, 2);

  select exists (
    select 1 from public.payments p
    where p.profile_id = p_profile_id
      and p.submitted_from_week_id = p_week_id
      and p.status = 'pending'
  ) into v_has_pending_payment;

  if v_balance < 0 then
    v_status := 'credit';
  elsif v_balance = 0 then
    v_status := 'paid';
  elsif v_has_pending_payment then
    v_status := 'waiting_validation';
  elsif v_payments > 0 or v_credit > 0 then
    v_status := 'partial';
  else
    v_status := 'pending';
  end if;

  update public.weekly_accounts
  set
    charges_total = v_charges,
    adjustments_total = v_adjustments,
    credit_applied = v_credit,
    payments_applied = v_payments,
    balance_due = v_balance,
    status = v_status,
    updated_at = now()
  where week_id = p_week_id and profile_id = p_profile_id
  returning * into v_account;

  return v_account;
end;
$$;

create or replace function public.apply_available_credit(
  p_profile_id uuid,
  p_week_id uuid
)
returns public.weekly_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.weekly_accounts;
  v_available numeric(10, 2);
  v_apply numeric(10, 2);
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if auth.uid() <> p_profile_id and not public.is_admin() then
    raise exception 'Sem permissão';
  end if;

  v_account := public.recalculate_weekly_account(p_profile_id, p_week_id);
  v_available := public.get_credit_balance(p_profile_id);

  if v_available <= 0 or v_account.balance_due <= 0 then
    return v_account;
  end if;

  v_apply := least(v_available, v_account.balance_due);
  if v_apply <= 0 then
    return v_account;
  end if;

  insert into public.credit_ledger (
    profile_id, week_id, payment_id, type, amount, description, created_by
  ) values (
    p_profile_id,
    p_week_id,
    null,
    'applied',
    -round(v_apply::numeric, 2),
    'Aplicação automática de crédito',
    auth.uid()
  );

  v_account := public.recalculate_weekly_account(p_profile_id, p_week_id);
  perform public.recalculate_week_status(p_week_id);
  return v_account;
end;
$$;

revoke all on function public.apply_available_credit(uuid, uuid) from public;
revoke all on function public.apply_available_credit(uuid, uuid) from anon;
grant execute on function public.apply_available_credit(uuid, uuid) to authenticated;

create or replace function public.recalculate_week_status(p_week_id uuid)
returns public.weeks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week public.weeks;
begin
  -- Permite chamada interna (security definer) por approve/apply; admin check só se chamado direto sem contexto?
  -- Mantém: qualquer authenticated via grant, mas só altera semanas não-current.
  select * into v_week
  from public.weeks
  where id = p_week_id
  for update;

  if v_week.id is null then
    raise exception 'Semana não encontrada';
  end if;

  if v_week.status = 'current' then
    return v_week;
  end if;

  if public.week_has_financial_pending(p_week_id) then
    update public.weeks
    set status = 'open',
        closed_at = null
    where id = p_week_id
    returning * into v_week;
  else
    update public.weeks
    set status = 'closed',
        closed_at = coalesce(closed_at, now())
    where id = p_week_id
    returning * into v_week;
  end if;

  return v_week;
end;
$$;

-- FIFO na aprovação
create or replace function public.approve_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_remaining numeric(10, 2);
  v_apply numeric(10, 2);
  v_account public.weekly_accounts;
  v_week_id uuid;
  r record;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'Pagamento não encontrado';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Somente pagamentos pendentes podem ser aprovados';
  end if;

  -- Recalcula contas existentes do funcionário
  for v_week_id in
    select distinct wa.week_id
    from public.weekly_accounts wa
    where wa.profile_id = v_payment.profile_id
    union
    select distinct wd.week_id
    from public.orders o
    join public.week_days wd on wd.id = o.week_day_id
    where o.profile_id = v_payment.profile_id
  loop
    perform public.recalculate_weekly_account(v_payment.profile_id, v_week_id);
  end loop;

  if v_payment.submitted_from_week_id is not null then
    perform public.recalculate_weekly_account(v_payment.profile_id, v_payment.submitted_from_week_id);
  end if;

  v_remaining := round(v_payment.amount::numeric, 2);

  for r in
    select wa.id as account_id, wa.week_id, wa.balance_due, w.start_date
    from public.weekly_accounts wa
    join public.weeks w on w.id = wa.week_id
    where wa.profile_id = v_payment.profile_id
      and wa.balance_due > 0
    order by w.start_date asc, wa.week_id asc
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_remaining, r.balance_due);
    if v_apply > 0 then
      insert into public.payment_allocations (payment_id, weekly_account_id, amount)
      values (v_payment.id, r.account_id, round(v_apply::numeric, 2));
      v_remaining := round((v_remaining - v_apply)::numeric, 2);
    end if;
  end loop;

  -- Sobra vira crédito
  if v_remaining > 0 then
    insert into public.credit_ledger (
      profile_id, week_id, payment_id, type, amount, description, created_by
    ) values (
      v_payment.profile_id,
      v_payment.submitted_from_week_id,
      v_payment.id,
      'generated',
      round(v_remaining::numeric, 2),
      'Excedente de pagamento aprovado',
      auth.uid()
    );
  end if;

  update public.payments
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejection_reason = null
  where id = p_payment_id
  returning * into v_payment;

  -- Recalcula semanas afetadas + aplica crédito automático onde houver dívida (FIFO de crédito)
  for v_week_id in
    select wa.week_id
    from public.weekly_accounts wa
    join public.weeks w on w.id = wa.week_id
    where wa.profile_id = v_payment.profile_id
    order by w.start_date asc
  loop
    perform public.recalculate_weekly_account(v_payment.profile_id, v_week_id);
    perform public.apply_available_credit(v_payment.profile_id, v_week_id);
    perform public.recalculate_week_status(v_week_id);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'approve_payment',
    'payment',
    v_payment.id,
    jsonb_build_object(
      'amount', v_payment.amount,
      'credit_generated', greatest(v_remaining, 0)
    )
  );

  return v_payment;
end;
$$;

create or replace function public.reverse_payment(
  p_payment_id uuid,
  p_reason text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_generated numeric(10, 2);
  v_available numeric(10, 2);
  v_week_id uuid;
  v_reason text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'Pagamento não encontrado';
  end if;
  if v_payment.status <> 'approved' then
    raise exception 'Somente pagamentos aprovados podem ser revertidos';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Informe o motivo da reversão';
  end if;

  select coalesce(sum(amount), 0)
  into v_generated
  from public.credit_ledger
  where payment_id = p_payment_id
    and type = 'generated';

  v_available := public.get_credit_balance(v_payment.profile_id);
  if v_generated > 0 and v_available < v_generated then
    raise exception 'Crédito gerado por este pagamento já foi utilizado; não é possível reverter';
  end if;

  delete from public.payment_allocations where payment_id = p_payment_id;

  if v_generated > 0 then
    insert into public.credit_ledger (
      profile_id, week_id, payment_id, type, amount, description, created_by
    ) values (
      v_payment.profile_id,
      v_payment.submitted_from_week_id,
      v_payment.id,
      'reversal',
      -round(v_generated::numeric, 2),
      v_reason,
      auth.uid()
    );
  end if;

  update public.payments
  set
    status = 'reversed',
    admin_note = v_reason,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_payment_id
  returning * into v_payment;

  for v_week_id in
    select distinct wa.week_id
    from public.weekly_accounts wa
    where wa.profile_id = v_payment.profile_id
  loop
    perform public.recalculate_weekly_account(v_payment.profile_id, v_week_id);
    perform public.recalculate_week_status(v_week_id);
  end loop;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'reverse_payment',
    'payment',
    v_payment.id,
    jsonb_build_object('reason', v_reason)
  );

  return v_payment;
end;
$$;

revoke all on function public.reverse_payment(uuid, text) from public;
revoke all on function public.reverse_payment(uuid, text) from anon;
grant execute on function public.reverse_payment(uuid, text) to authenticated;

-- Hook: após pedidos/ajustes, tenta aplicar crédito
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
  perform public.apply_available_credit(auth.uid(), v_week_id);
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
  perform public.apply_available_credit(p_profile_id, v_week_id);
  return v_order;
end;
$$;

-- Backfill: alocações para pagamentos já aprovados na Fase 7 (sem allocations)
do $$
declare
  r record;
  v_account_id uuid;
begin
  for r in
    select p.*
    from public.payments p
    where p.status = 'approved'
      and not exists (select 1 from public.payment_allocations pa where pa.payment_id = p.id)
      and p.submitted_from_week_id is not null
  loop
    insert into public.weekly_accounts (week_id, profile_id)
    values (r.submitted_from_week_id, r.profile_id)
    on conflict (week_id, profile_id) do nothing;

    select id into v_account_id
    from public.weekly_accounts
    where week_id = r.submitted_from_week_id and profile_id = r.profile_id;

    if v_account_id is not null then
      insert into public.payment_allocations (payment_id, weekly_account_id, amount)
      values (r.id, v_account_id, r.amount);
    end if;
  end loop;
end;
$$;

-- Ajuste admin também tenta consumir crédito
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
  perform public.apply_available_credit(v_order.profile_id, v_week_id);

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
