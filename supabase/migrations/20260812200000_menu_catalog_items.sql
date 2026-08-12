-- Catálogo reutilizável de itens de cardápio (carboidrato / proteína / complemento)

create table if not exists public.menu_catalog_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('carb', 'meat', 'side')),
  name text not null,
  name_normalized text generated always as (
    lower(trim(both from regexp_replace(name, '\s+', ' ', 'g')))
  ) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint menu_catalog_items_name_len check (char_length(trim(name)) between 1 and 80)
);

create unique index if not exists menu_catalog_items_category_name_uidx
  on public.menu_catalog_items (category, name_normalized);

create index if not exists menu_catalog_items_category_sort_idx
  on public.menu_catalog_items (category, sort_order, name);

alter table public.menu_catalog_items enable row level security;

create policy menu_catalog_items_select_authenticated
on public.menu_catalog_items
for select
to authenticated
using (true);

create policy menu_catalog_items_admin_insert
on public.menu_catalog_items
for insert
to authenticated
with check (public.is_admin());

create policy menu_catalog_items_admin_update
on public.menu_catalog_items
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy menu_catalog_items_admin_delete
on public.menu_catalog_items
for delete
to authenticated
using (public.is_admin());
