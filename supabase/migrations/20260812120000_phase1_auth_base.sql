-- Fase 1: enums, tabelas base de auth/config, RLS e seeds não sensíveis

create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('admin', 'employee');

create table public.meal_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  current_price numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  phone text not null unique,
  role public.user_role not null default 'employee',
  is_participant boolean not null default true,
  is_active boolean not null default true,
  activated_at timestamptz,
  default_meal_type_id uuid references public.meal_types (id) on delete set null,
  default_quantity integer not null default 1 check (default_quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_e164 check (phone ~ '^\+[1-9][0-9]{7,14}$')
);

create table public.activation_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  hashed_token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  app_name text not null default 'Controle de Viandas',
  timezone text not null default 'America/Sao_Paulo',
  restaurant_name text not null default '',
  restaurant_phone text,
  pix_key text not null default '',
  pix_recipient_name text not null default '',
  pix_city text not null default '',
  pix_description text,
  order_open_time time not null default time '08:30',
  order_close_time time not null default time '10:30',
  active_weekdays smallint[] not null default '{1,2,3,4,5}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  constraint app_settings_singleton check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

create index activation_tokens_profile_id_idx on public.activation_tokens (profile_id);
create index profiles_role_idx on public.profiles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger meal_types_set_updated_at
before update on public.meal_types
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_active = true
  );
$$;

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.current_profile() from public;
grant execute on function public.current_profile() to authenticated;

alter table public.meal_types enable row level security;
alter table public.profiles enable row level security;
alter table public.activation_tokens enable row level security;
alter table public.app_settings enable row level security;

create policy meal_types_select_authenticated
on public.meal_types
for select
to authenticated
using (true);

create policy meal_types_admin_write
on public.meal_types
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy profiles_select_own_or_admin
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_update_own_limited
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  and phone = (select p.phone from public.profiles p where p.id = auth.uid())
);

create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Inserts/deletes de profiles e tokens só via service role (Edge Functions)
-- Nenhuma policy de insert/delete para authenticated em profiles/activation_tokens

create policy app_settings_select_authenticated
on public.app_settings
for select
to authenticated
using (true);

create policy app_settings_admin_update
on public.app_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.meal_types (code, name, current_price, is_active, sort_order)
values
  ('P', 'P', 0, true, 1),
  ('M', 'M', 0, true, 2),
  ('G', 'G', 0, true, 3),
  ('SALADA', 'Salada', 0, true, 4);

insert into public.app_settings (
  id,
  app_name,
  timezone,
  restaurant_name,
  restaurant_phone,
  pix_key,
  pix_recipient_name,
  pix_city,
  pix_description,
  order_open_time,
  order_close_time,
  active_weekdays
) values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Controle de Viandas',
  'America/Sao_Paulo',
  '',
  null,
  '',
  '',
  '',
  null,
  time '08:30',
  time '10:30',
  '{1,2,3,4,5}'
);
