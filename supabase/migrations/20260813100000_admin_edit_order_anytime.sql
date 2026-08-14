-- Admin pode criar/alterar o próprio pedido fora da janela.
-- Funcionário continua restrito à janela (ou dia reaberto).
-- Mantém recálculo financeiro da Fase 8.

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
  if v_profile.role <> 'admin' and not public.is_order_window_open(p_week_day_id) then
    raise exception 'Pedidos fechados para este dia';
  end if;

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
  if v_profile.role <> 'admin' and not public.is_order_window_open(p_week_day_id) then
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
  perform public.apply_available_credit(auth.uid(), v_week_id);
  return v_order;
end;
$$;
