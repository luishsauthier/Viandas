-- Fase 9: upload de cardápio + extrações de IA

create type public.menu_extraction_status as enum (
  'pending_review',
  'applied',
  'failed'
);

create table public.menu_extractions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.weeks (id) on delete cascade,
  image_path text not null,
  status public.menu_extraction_status not null default 'pending_review',
  result_json jsonb,
  error_message text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index menu_extractions_week_id_idx on public.menu_extractions (week_id);

alter table public.menu_days
  add column if not exists source_image_path text;

alter table public.menu_extractions enable row level security;

create policy menu_extractions_admin_all
on public.menu_extractions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy menu_images_admin_select
on storage.objects for select to authenticated
using (bucket_id = 'menu-images' and public.is_admin());

create policy menu_images_admin_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'menu-images' and public.is_admin());

create policy menu_images_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'menu-images' and public.is_admin())
with check (bucket_id = 'menu-images' and public.is_admin());

create policy menu_images_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'menu-images' and public.is_admin());
