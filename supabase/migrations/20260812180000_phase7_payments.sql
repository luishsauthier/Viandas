-- Fase 7: pagamentos PIX, storage de comprovantes e revisão admin

create type public.payment_status as enum (
  'pending',
  'approved',
  'rejected',
  'reversed'
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  submitted_from_week_id uuid references public.weeks (id) on delete set null,
  amount numeric(10, 2) not null check (amount > 0),
  status public.payment_status not null default 'pending',
  receipt_path text not null,
  user_note text,
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  rejection_reason text
);

create index payments_profile_id_idx on public.payments (profile_id);
create index payments_status_idx on public.payments (status);
create index payments_week_id_idx on public.payments (submitted_from_week_id);

alter table public.payments enable row level security;

create policy payments_select_own_or_admin
on public.payments for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy payment_receipts_select_own_or_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

create policy payment_receipts_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy payment_receipts_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'payment-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy payment_receipts_delete_own_or_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'payment-receipts'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

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

  select coalesce(credit_applied, 0), coalesce(payments_applied, 0)
  into v_credit, v_payments
  from public.weekly_accounts
  where week_id = p_week_id and profile_id = p_profile_id;

  v_credit := coalesce(v_credit, 0);
  v_payments := coalesce(v_payments, 0);
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

create or replace function public.submit_payment(
  p_payment_id uuid,
  p_week_id uuid,
  p_amount numeric,
  p_receipt_path text,
  p_user_note text default null
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;
  if length(trim(coalesce(p_receipt_path, ''))) = 0 then
    raise exception 'Comprovante obrigatório';
  end if;
  if p_receipt_path not like (auth.uid()::text || '/%') then
    raise exception 'Caminho do comprovante inválido';
  end if;
  if not exists (select 1 from public.weeks where id = p_week_id) then
    raise exception 'Semana inválida';
  end if;
  if exists (select 1 from public.payments where id = p_payment_id) then
    raise exception 'Pagamento já existe';
  end if;

  v_note := nullif(trim(coalesce(p_user_note, '')), '');

  insert into public.payments (
    id, profile_id, submitted_from_week_id, amount, status,
    receipt_path, user_note
  ) values (
    p_payment_id, auth.uid(), p_week_id, round(p_amount::numeric, 2), 'pending',
    trim(p_receipt_path), v_note
  )
  returning * into v_payment;

  perform public.recalculate_weekly_account(auth.uid(), p_week_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'submit_payment',
    'payment',
    v_payment.id,
    jsonb_build_object('week_id', p_week_id, 'amount', p_amount)
  );

  return v_payment;
end;
$$;

revoke all on function public.submit_payment(uuid, uuid, numeric, text, text) from public;
revoke all on function public.submit_payment(uuid, uuid, numeric, text, text) from anon;
grant execute on function public.submit_payment(uuid, uuid, numeric, text, text) to authenticated;

create or replace function public.reject_payment(
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
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Apenas administradores';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if v_payment.id is null then
    raise exception 'Pagamento não encontrado';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'Somente pagamentos pendentes podem ser rejeitados';
  end if;

  update public.payments
  set
    status = 'rejected',
    rejection_reason = nullif(trim(coalesce(p_reason, '')), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_payment_id
  returning * into v_payment;

  if v_payment.submitted_from_week_id is not null then
    perform public.recalculate_weekly_account(v_payment.profile_id, v_payment.submitted_from_week_id);
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'reject_payment',
    'payment',
    v_payment.id,
    jsonb_build_object('reason', v_payment.rejection_reason)
  );

  return v_payment;
end;
$$;

revoke all on function public.reject_payment(uuid, text) from public;
revoke all on function public.reject_payment(uuid, text) from anon;
grant execute on function public.reject_payment(uuid, text) to authenticated;

-- Aprovação simples (aplica na semana de origem). FIFO multi-semana na Fase 8.
create or replace function public.approve_payment(p_payment_id uuid)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_week_id uuid;
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

  v_week_id := v_payment.submitted_from_week_id;
  if v_week_id is null then
    raise exception 'Pagamento sem semana de origem';
  end if;

  -- Garante conta e soma o valor aprovado
  perform public.recalculate_weekly_account(v_payment.profile_id, v_week_id);

  update public.weekly_accounts
  set payments_applied = round((payments_applied + v_payment.amount)::numeric, 2),
      updated_at = now()
  where week_id = v_week_id and profile_id = v_payment.profile_id;

  update public.payments
  set
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejection_reason = null
  where id = p_payment_id
  returning * into v_payment;

  perform public.recalculate_weekly_account(v_payment.profile_id, v_week_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'approve_payment',
    'payment',
    v_payment.id,
    jsonb_build_object('amount', v_payment.amount, 'week_id', v_week_id)
  );

  return v_payment;
end;
$$;

revoke all on function public.approve_payment(uuid) from public;
revoke all on function public.approve_payment(uuid) from anon;
grant execute on function public.approve_payment(uuid) to authenticated;
