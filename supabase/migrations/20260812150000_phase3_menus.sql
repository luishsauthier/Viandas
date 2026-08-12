-- Fase 3: cardápio manual (menu_days / menu_items)

create table public.menu_days (
  id uuid primary key default gen_random_uuid(),
  week_day_id uuid not null unique references public.week_days (id) on delete cascade,
  raw_text text,
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_day_id uuid not null references public.menu_days (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0
);

create index menu_items_menu_day_id_idx on public.menu_items (menu_day_id);

create trigger menu_days_set_updated_at
before update on public.menu_days
for each row execute function public.set_updated_at();

alter table public.menu_days enable row level security;
alter table public.menu_items enable row level security;

create policy menu_days_select_authenticated
on public.menu_days
for select
to authenticated
using (true);

create policy menu_days_admin_write
on public.menu_days
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy menu_items_select_authenticated
on public.menu_items
for select
to authenticated
using (true);

create policy menu_items_admin_write
on public.menu_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.upsert_menu_day(
  p_week_day_id uuid,
  p_items text[],
  p_raw_text text default null,
  p_confirmed boolean default true
)
returns public.menu_days
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu public.menu_days;
  v_item text;
  v_order integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores podem editar o cardápio';
  end if;

  if not exists (select 1 from public.week_days where id = p_week_day_id) then
    raise exception 'Dia da semana não encontrado';
  end if;

  insert into public.menu_days (week_day_id, raw_text, confirmed)
  values (
    p_week_day_id,
    nullif(trim(coalesce(p_raw_text, '')), ''),
    p_confirmed
  )
  on conflict (week_day_id)
  do update set
    raw_text = excluded.raw_text,
    confirmed = excluded.confirmed,
    updated_at = now()
  returning * into v_menu;

  delete from public.menu_items where menu_day_id = v_menu.id;

  foreach v_item in array coalesce(p_items, array[]::text[])
  loop
    if length(trim(v_item)) > 0 then
      v_order := v_order + 1;
      insert into public.menu_items (menu_day_id, name, sort_order)
      values (v_menu.id, trim(v_item), v_order);
    end if;
  end loop;

  return v_menu;
end;
$$;

revoke all on function public.upsert_menu_day(uuid, text[], text, boolean) from public;
revoke all on function public.upsert_menu_day(uuid, text[], text, boolean) from anon;
grant execute on function public.upsert_menu_day(uuid, text[], text, boolean) to authenticated;
