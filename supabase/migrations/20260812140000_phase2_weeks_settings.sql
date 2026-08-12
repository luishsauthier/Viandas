-- Fase 2: semanas, dias, notas do restaurante, RPC de criação

alter table public.app_settings
  add column if not exists restaurant_notes text;

create type public.week_status as enum ('current', 'open', 'closed');
create type public.week_day_status as enum ('scheduled', 'open', 'closed', 'reopened');

create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  status public.week_status not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  closed_at timestamptz,
  constraint weeks_date_range check (end_date >= start_date)
);

create unique index weeks_one_current_idx
  on public.weeks (status)
  where status = 'current';

create table public.week_days (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  date date not null unique,
  weekday smallint not null check (weekday between 1 and 7),
  status public.week_day_status not null default 'scheduled',
  manual_closed_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now()
);

create index week_days_week_id_idx on public.week_days (week_id);

alter table public.weeks enable row level security;
alter table public.week_days enable row level security;

create policy weeks_select_authenticated
on public.weeks
for select
to authenticated
using (true);

create policy weeks_admin_write
on public.weeks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy week_days_select_authenticated
on public.week_days
for select
to authenticated
using (true);

create policy week_days_admin_write
on public.week_days
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.week_has_financial_pending(p_week_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Contas financeiras entram na Fase 6; até lá não há pendência.
  select false;
$$;

revoke all on function public.week_has_financial_pending(uuid) from public;
revoke all on function public.week_has_financial_pending(uuid) from anon;
grant execute on function public.week_has_financial_pending(uuid) to authenticated;

create or replace function public.create_week(p_start_date date)
returns public.weeks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.app_settings;
  v_active smallint[];
  v_day date;
  v_weekday smallint;
  v_end date;
  v_week public.weeks;
  v_previous public.weeks;
  v_created_days integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores podem criar semana';
  end if;

  if p_start_date is null then
    raise exception 'Data inicial obrigatória';
  end if;

  select * into v_settings
  from public.app_settings
  where id = '00000000-0000-0000-0000-000000000001'::uuid;

  if v_settings.id is null then
    raise exception 'Configurações não encontradas';
  end if;

  v_active := v_settings.active_weekdays;
  if v_active is null or array_length(v_active, 1) is null then
    raise exception 'Nenhum dia ativo configurado';
  end if;

  -- Transiciona semana current anterior
  select * into v_previous
  from public.weeks
  where status = 'current'
  for update;

  if v_previous.id is not null then
    if public.week_has_financial_pending(v_previous.id) then
      update public.weeks
      set status = 'open'
      where id = v_previous.id;
    else
      update public.weeks
      set status = 'closed',
          closed_at = coalesce(closed_at, now())
      where id = v_previous.id;
    end if;
  end if;

  -- Calcula dias ativos nos 7 dias a partir da data inicial
  v_end := p_start_date;
  for i in 0..6 loop
    v_day := p_start_date + i;
    v_weekday := extract(isodow from v_day)::smallint;
    if v_weekday = any (v_active) then
      v_end := v_day;
      v_created_days := v_created_days + 1;
    end if;
  end loop;

  if v_created_days = 0 then
    raise exception 'A data inicial não gera nenhum dia ativo na semana';
  end if;

  insert into public.weeks (start_date, end_date, status, created_by)
  values (p_start_date, v_end, 'current', auth.uid())
  returning * into v_week;

  for i in 0..6 loop
    v_day := p_start_date + i;
    v_weekday := extract(isodow from v_day)::smallint;
    if v_weekday = any (v_active) then
      insert into public.week_days (week_id, date, weekday, status)
      values (v_week.id, v_day, v_weekday, 'scheduled');
    end if;
  end loop;

  return v_week;
end;
$$;

revoke all on function public.create_week(date) from public;
revoke all on function public.create_week(date) from anon;
grant execute on function public.create_week(date) to authenticated;

create or replace function public.recalculate_week_status(p_week_id uuid)
returns public.weeks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week public.weeks;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

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

revoke all on function public.recalculate_week_status(uuid) from public;
revoke all on function public.recalculate_week_status(uuid) from anon;
grant execute on function public.recalculate_week_status(uuid) to authenticated;
