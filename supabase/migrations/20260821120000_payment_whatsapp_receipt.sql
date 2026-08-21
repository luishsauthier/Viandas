-- Permite comprovante declarado via WhatsApp (sem upload de arquivo).
-- Caminho especial: {profile_id}/{payment_id}/whatsapp

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
  v_path text;
  v_whatsapp boolean;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Valor do pagamento deve ser maior que zero';
  end if;

  v_path := trim(coalesce(p_receipt_path, ''));
  if length(v_path) = 0 then
    raise exception 'Comprovante obrigatório';
  end if;
  if v_path not like (auth.uid()::text || '/%') then
    raise exception 'Caminho do comprovante inválido';
  end if;

  v_whatsapp := v_path = (auth.uid()::text || '/' || p_payment_id::text || '/whatsapp');

  if not exists (select 1 from public.weeks where id = p_week_id) then
    raise exception 'Semana inválida';
  end if;
  if exists (select 1 from public.payments where id = p_payment_id) then
    raise exception 'Pagamento já existe';
  end if;

  v_note := nullif(trim(coalesce(p_user_note, '')), '');
  if v_whatsapp and v_note is null then
    v_note := 'Comprovante enviado pelo WhatsApp';
  end if;

  insert into public.payments (
    id, profile_id, submitted_from_week_id, amount, status,
    receipt_path, user_note
  ) values (
    p_payment_id, auth.uid(), p_week_id, round(p_amount::numeric, 2), 'pending',
    v_path, v_note
  )
  returning * into v_payment;

  perform public.recalculate_weekly_account(auth.uid(), p_week_id);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    'submit_payment',
    'payment',
    v_payment.id,
    jsonb_build_object(
      'week_id', p_week_id,
      'amount', p_amount,
      'via_whatsapp', v_whatsapp
    )
  );

  return v_payment;
end;
$$;
