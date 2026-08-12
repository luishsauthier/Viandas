-- Fase 1: endurecimento de funções auxiliares

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
revoke all on function public.current_profile() from public;
revoke all on function public.current_profile() from anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_profile() to authenticated;
