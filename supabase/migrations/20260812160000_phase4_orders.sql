-- Fase 4: pedidos, itens, auditoria básica e RPCs de janela/pedido

create type public.order_response_status as enum ('ordered', 'declined');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  week_day_id uuid not null references public.week_days (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  response_status public.order_response_status not null,
  observation text check (observation is null or char_length(observation) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  unique (week_day_id, profile_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  meal_type_id uuid not null references public.meal_types (id),
  quantity integer not null check (quantity > 0 and quantity <= 10),
  unit_price_snapshot numeric(10, 2) not null check (unit_price_snapshot >= 0),
  created_at timestamptz not null default now(),
  unique (order_id, meal_type_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index orders_week_day_id_idx on public.orders (week_day_id);
create index orders_profile_id_idx on public.orders (profile_id);
create index order_items_order_id_idx on public.order_items (order_id);

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.audit_logs enable row level security;

create policy orders_select_own_or_admin
on public.orders for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

create policy order_items_select_own_or_admin
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.profile_id = auth.uid() or public.is_admin())
  )
);

create policy audit_logs_admin_select
on public.audit_logs for select to authenticated
using (public.is_admin());

-- Escritas apenas via RPCs (service/security definer)

create or replace function public.is_order_window_open(p_week_day_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_day public.week_days;
  v_week public.weeks;
  v_settings public.app_settings;
  v_now_ts timestamp;
  v_now_time time;
  v_open time;
  v_close time;
begin
  select * into v_day from public.week_days where id = p_week_day_id;
  if v_day.id is null then
    return false;
  end if;

  select * into v_week from public.weeks where id = v_day.week_id;
  if v_week.id is null or v_week.status <> 'current' then
    return false;
  end if;

  if v_day.status = 'closed' then
    return false;
  end if;

  if v_day.status = 'reopened' then
    return true;
  end if;

  select * into v_settings
  from public.app_settings
  where id = '00000000-0000-0000-0000-000000000001'::uuid;

  v_now_ts := timezone(v_settings.timezone, now());
  if v_now_ts::date <> v_day.date then
    -- Fora do dia civil do pedido, janela só vale no próprio dia
    -- (exceto reopened, já tratado acima)
    return false;
  end if;

  v_now_time := v_now_ts::time;
  v_open := v_settings.order_open_time;
  v_close := v_settings.order_close_time;

  return v_now_time >= v_open and v_now_time < v_close;
end;
$$;

revoke all on function public.is_order_window_open(uuid) from public;
revoke all on function public.is_order_window_open(uuid) from anon;
grant execute on function public.is_order_window_open(uuid) to authenticated;

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
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not v_profile.is_active then
    raise exception 'Perfil inválido';
  end if;
  if not v_profile.is_participant then
    raise exception 'Perfil não participa dos pedidos';
  end if;

  if not public.is_order_window_open(p_week_day_id) then
    raise exception 'Pedidos fechados para este dia';
  end if;

  v_obs := nullif(trim(coalesce(p_observation, '')), '');
  if v_obs is not null and char_length(v_obs) > 300 then
    raise exception 'Observação deve ter no máximo 300 caracteres';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Itens inválidos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty < 0 or v_qty > 10 then
      raise exception 'Quantidade inválida';
    end if;
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

  insert into public.orders (
    week_day_id, profile_id, response_status, observation, created_by, updated_by
  ) values (
    p_week_day_id, auth.uid(), 'ordered', v_obs, auth.uid(), auth.uid()
  )
  on conflict (week_day_id, profile_id)
  do update set
    response_status = 'ordered',
    observation = excluded.observation,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_order;

  delete from public.order_items where order_id = v_order.id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty > 0 then
      select * into v_meal from public.meal_types where id = (v_item->>'meal_type_id')::uuid;
      insert into public.order_items (order_id, meal_type_id, quantity, unit_price_snapshot)
      values (v_order.id, v_meal.id, v_qty, v_meal.current_price);
    end if;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.submit_daily_order(uuid, jsonb, text) from public;
revoke all on function public.submit_daily_order(uuid, jsonb, text) from anon;
grant execute on function public.submit_daily_order(uuid, jsonb, text) to authenticated;

create or replace function public.decline_daily_order(p_week_day_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or not v_profile.is_active or not v_profile.is_participant then
    raise exception 'Perfil inválido';
  end if;

  if not public.is_order_window_open(p_week_day_id) then
    raise exception 'Pedidos fechados para este dia';
  end if;

  insert into public.orders (
    week_day_id, profile_id, response_status, observation, created_by, updated_by
  ) values (
    p_week_day_id, auth.uid(), 'declined', null, auth.uid(), auth.uid()
  )
  on conflict (week_day_id, profile_id)
  do update set
    response_status = 'declined',
    observation = null,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_order;

  delete from public.order_items where order_id = v_order.id;
  return v_order;
end;
$$;

revoke all on function public.decline_daily_order(uuid) from public;
revoke all on function public.decline_daily_order(uuid) from anon;
grant execute on function public.decline_daily_order(uuid) to authenticated;

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
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

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
    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    loop
      v_qty := coalesce((v_item->>'quantity')::integer, 0);
      if v_qty < 0 or v_qty > 10 then
        raise exception 'Quantidade inválida';
      end if;
      if v_qty > 0 then
        v_total_qty := v_total_qty + v_qty;
        select * into v_meal from public.meal_types where id = (v_item->>'meal_type_id')::uuid;
        if v_meal.id is null then
          raise exception 'Tipo de vianda inválido';
        end if;
      end if;
    end loop;
    if v_total_qty <= 0 then
      raise exception 'Pedido ordered precisa de itens';
    end if;
  end if;

  insert into public.orders (
    week_day_id, profile_id, response_status, observation, created_by, updated_by
  ) values (
    p_week_day_id, p_profile_id, p_response_status, v_obs, auth.uid(), auth.uid()
  )
  on conflict (week_day_id, profile_id)
  do update set
    response_status = excluded.response_status,
    observation = excluded.observation,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into v_order;

  delete from public.order_items where order_id = v_order.id;

  if p_response_status = 'ordered' then
    for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    loop
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
    auth.uid(),
    'admin_upsert_order',
    'order',
    v_order.id,
    jsonb_build_object(
      'week_day_id', p_week_day_id,
      'profile_id', p_profile_id,
      'response_status', p_response_status
    )
  );

  return v_order;
end;
$$;

revoke all on function public.admin_upsert_order(uuid, uuid, public.order_response_status, jsonb, text) from public;
revoke all on function public.admin_upsert_order(uuid, uuid, public.order_response_status, jsonb, text) from anon;
grant execute on function public.admin_upsert_order(uuid, uuid, public.order_response_status, jsonb, text) to authenticated;

create or replace function public.admin_set_day_status(
  p_week_day_id uuid,
  p_status public.week_day_status
)
returns public.week_days
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day public.week_days;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  if p_status not in ('closed', 'reopened', 'open', 'scheduled') then
    raise exception 'Status inválido';
  end if;

  update public.week_days
  set
    status = p_status,
    manual_closed_at = case when p_status = 'closed' then now() else manual_closed_at end,
    reopened_at = case when p_status = 'reopened' then now() else reopened_at end
  where id = p_week_day_id
  returning * into v_day;

  if v_day.id is null then
    raise exception 'Dia não encontrado';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'admin_set_day_status',
    'week_day',
    v_day.id,
    jsonb_build_object('status', p_status)
  );

  return v_day;
end;
$$;

revoke all on function public.admin_set_day_status(uuid, public.week_day_status) from public;
revoke all on function public.admin_set_day_status(uuid, public.week_day_status) from anon;
grant execute on function public.admin_set_day_status(uuid, public.week_day_status) to authenticated;
