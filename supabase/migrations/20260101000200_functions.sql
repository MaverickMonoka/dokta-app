-- ============================================================================
-- DOKTA OS — transactional procedures
--
-- Everything here exists because it must be atomic. An edge function cannot
-- hold a transaction open across several statements, so any operation that
-- touches stock, money and status together lives in the database instead.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Stock removal, first-expiry-first.
--
-- FEFO, not FIFO: in a pharmacy the batch closest to expiry is the one that
-- must move. Expired batches are skipped entirely — never dispensed, never
-- sold — and if unexpired stock cannot cover the line the whole call fails.
-- ----------------------------------------------------------------------------
create or replace function deduct_stock_fefo(
  p_inventory_id uuid,
  p_quantity     integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  batch      record;
  remaining  integer := p_quantity;
  taken      integer;
  used       jsonb := '[]'::jsonb;
  item_name  text;
begin
  select m.name into item_name
  from inventory_items i join medicines m on m.id = i.medicine_id
  where i.id = p_inventory_id;

  -- Lock the row so two tills cannot sell the same last box.
  perform 1 from inventory_items where id = p_inventory_id for update;

  for batch in
    select id, batch_number, quantity
    from stock_batches
    where inventory_id = p_inventory_id
      and expiry_date > current_date
    order by expiry_date asc
    for update
  loop
    exit when remaining = 0;

    taken := least(batch.quantity, remaining);
    remaining := remaining - taken;
    used := used || jsonb_build_object('batch', batch.batch_number, 'quantity', taken);

    if taken = batch.quantity then
      delete from stock_batches where id = batch.id;
    else
      update stock_batches set quantity = quantity - taken where id = batch.id;
    end if;
  end loop;

  if remaining > 0 then
    raise exception 'Not enough unexpired stock of %: short by % units', item_name, remaining
      using errcode = 'check_violation';
  end if;

  update inventory_items
  set stock_on_hand = stock_on_hand - p_quantity
  where id = p_inventory_id;

  return used;
end $$;

-- ----------------------------------------------------------------------------
-- Dispense a prescription: price it, take the stock, create the order.
-- All three or none.
-- ----------------------------------------------------------------------------
create or replace function dispense_prescription(
  p_prescription_id  uuid,
  p_pharmacy_id      uuid,
  p_reference        text,
  p_fulfilment       fulfilment_method,
  p_delivery_address text,
  p_delivery_fee     numeric,
  p_subtotal         numeric,
  p_vat              numeric,
  p_total            numeric,
  p_lines            jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  line       jsonb;
  new_order  orders%rowtype;
  script     prescriptions%rowtype;
begin
  select * into script from prescriptions where id = p_prescription_id for update;
  if not found then
    raise exception 'Prescription not found' using errcode = 'no_data_found';
  end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    perform deduct_stock_fefo(
      (line->>'inventory_id')::uuid,
      (line->>'quantity')::integer
    );
  end loop;

  insert into orders (
    reference, patient_id, pharmacy_id, prescription_id, status, fulfilment,
    delivery_address, delivery_fee, subtotal, vat, total, placed_at
  ) values (
    p_reference, script.patient_id, p_pharmacy_id, p_prescription_id,
    'awaiting_payment', p_fulfilment, p_delivery_address, p_delivery_fee,
    p_subtotal, p_vat, p_total, now()
  ) returning * into new_order;

  insert into order_items (order_id, medicine_id, description, quantity, unit_price, line_total)
  select new_order.id,
         (line->>'medicine_id')::uuid,
         line->>'description',
         (line->>'quantity')::integer,
         (line->>'unit_price')::numeric,
         round((line->>'unit_price')::numeric * (line->>'quantity')::integer, 2)
  from jsonb_array_elements(p_lines) as line;

  update prescriptions
  set status       = 'dispensed',
      dispensed_at = now(),
      repeats_used = case when script.status = 'dispensed' then repeats_used + 1 else repeats_used end
  where id = p_prescription_id;

  return jsonb_build_object('id', new_order.id, 'reference', new_order.reference);
end $$;

-- ----------------------------------------------------------------------------
-- Counter sale. Stock comes off before the sale is written, so a receipt never
-- exists for goods that were not in the shop.
-- ----------------------------------------------------------------------------
create or replace function ring_up_sale(
  p_pharmacy_id uuid,
  p_cashier_id  uuid,
  p_reference   text,
  p_lines       jsonb,
  p_discount    numeric,
  p_gateway     payment_gateway,
  p_tendered    numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  line     jsonb;
  gross    numeric := 0;
  total    numeric;
  vat      numeric;
  new_sale sales%rowtype;
begin
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty' using errcode = 'check_violation';
  end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    gross := gross + ((line->>'unit_price')::numeric * (line->>'quantity')::integer);
  end loop;

  total := round(greatest(0, gross - coalesce(p_discount, 0)), 2);
  vat   := round(total - total / 1.15, 2);

  if p_gateway = 'cash' then
    if p_tendered is null then
      raise exception 'Enter the amount tendered' using errcode = 'check_violation';
    end if;
    if p_tendered < total then
      raise exception 'Amount tendered is less than the total' using errcode = 'check_violation';
    end if;
  end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    perform deduct_stock_fefo(
      (line->>'inventory_id')::uuid,
      (line->>'quantity')::integer
    );
  end loop;

  insert into sales (
    reference, pharmacy_id, cashier_id, lines, subtotal, discount, vat, total, tendered, change, gateway
  ) values (
    p_reference, p_pharmacy_id, p_cashier_id, p_lines, round(gross, 2),
    coalesce(p_discount, 0), vat, total, p_tendered,
    case when p_tendered is null then null else round(p_tendered - total, 2) end,
    p_gateway
  ) returning * into new_sale;

  return jsonb_build_object(
    'id', new_sale.id, 'reference', new_sale.reference,
    'subtotal', round(gross, 2), 'discount', coalesce(p_discount, 0),
    'vat', vat, 'total', total, 'change', new_sale.change
  );
end $$;

-- ----------------------------------------------------------------------------
-- Settle a payment and move whatever it paid for forward.
-- Safe to call twice: gateways retry, and a double confirm must not
-- double-advance an order.
-- ----------------------------------------------------------------------------
create or replace function settle_payment(
  p_payment_id  uuid,
  p_gateway_ref text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  pay payments%rowtype;
begin
  select * into pay from payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'no_data_found';
  end if;
  if pay.status = 'succeeded' then
    return;   -- already applied
  end if;

  update payments
  set status = 'succeeded', gateway_ref = p_gateway_ref, paid_at = now()
  where id = p_payment_id;

  if pay.order_id is not null then
    update orders set status = 'picking' where id = pay.order_id and status = 'awaiting_payment';
  end if;

  if pay.appointment_id is not null then
    update appointments
    set status = 'confirmed', payment_status = 'succeeded'
    where id = pay.appointment_id;
  end if;

  insert into notifications (user_id, channel, template, title, body)
  values (
    pay.user_id, 'in_app', 'payment_received', 'Payment received',
    format('We received R%s for %s. Your receipt is under Payments.',
           to_char(pay.amount, 'FM999999990.00'), pay.reference)
  );
end $$;

-- ----------------------------------------------------------------------------
-- Void a counter sale and put the stock back. Sales are never deleted — the
-- till record has to survive a dispute.
-- ----------------------------------------------------------------------------
create or replace function void_sale(p_sale_id uuid, p_voided_by uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  sale sales%rowtype;
  line jsonb;
begin
  select * into sale from sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found' using errcode = 'no_data_found';
  end if;
  if sale.voided_at is not null then
    raise exception 'This sale was already voided' using errcode = 'check_violation';
  end if;

  for line in select * from jsonb_array_elements(sale.lines) loop
    update inventory_items
    set stock_on_hand = stock_on_hand + (line->>'quantity')::integer
    where id = (line->>'inventory_id')::uuid;
  end loop;

  update sales set voided_at = now(), voided_by = p_voided_by where id = p_sale_id;
end $$;

-- ----------------------------------------------------------------------------
-- Free appointment slots for a doctor on a day. Derived from the weekly
-- pattern minus what is booked, so changing hours never rewrites bookings.
-- ----------------------------------------------------------------------------
create or replace function available_slots(p_doctor_id uuid, p_day date)
returns setof timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  window_row availability_slots%rowtype;
  slot       timestamptz;
  window_end timestamptz;
begin
  if not exists (select 1 from doctors where id = p_doctor_id and verification = 'verified') then
    return;
  end if;

  for window_row in
    select * from availability_slots
    where doctor_id = p_doctor_id and weekday = extract(dow from p_day)::smallint and is_active
  loop
    slot := (p_day + window_row.start_time) at time zone 'Africa/Johannesburg';
    window_end := (p_day + window_row.end_time) at time zone 'Africa/Johannesburg';

    while slot < window_end loop
      -- Never offer a slot in the past or inside the next 15 minutes.
      if slot > now() + interval '15 minutes'
         and not exists (
           select 1 from appointments
           where doctor_id = p_doctor_id
             and scheduled_for = slot
             and status not in ('cancelled','no_show')
         )
      then
        return next slot;
      end if;
      slot := slot + (window_row.slot_mins || ' minutes')::interval;
    end loop;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Build a month's DHIS2 return from operational data.
-- Read-only: it computes the figures, a person still submits them.
-- ----------------------------------------------------------------------------
create or replace function build_monthly_return(p_clinic_id uuid, p_month date)
returns jsonb
language sql stable security definer set search_path = public as $$
  with period as (
    select date_trunc('month', p_month)::date as start_day,
           (date_trunc('month', p_month) + interval '1 month')::date as end_day
  )
  select jsonb_build_object(
    'headcount_total', (
      select count(*) from queue_entries q, period
      where q.clinic_id = p_clinic_id and q.arrived_at >= period.start_day and q.arrived_at < period.end_day
    ),
    'headcount_seen', (
      select count(*) from queue_entries q, period
      where q.clinic_id = p_clinic_id and q.state = 'done'
        and q.arrived_at >= period.start_day and q.arrived_at < period.end_day
    ),
    'left_without_being_seen', (
      select count(*) from queue_entries q, period
      where q.clinic_id = p_clinic_id and q.state = 'left'
        and q.arrived_at >= period.start_day and q.arrived_at < period.end_day
    ),
    'triage_red', (
      select count(*) from queue_entries q, period
      where q.clinic_id = p_clinic_id and q.triage_colour = 'red'
        and q.arrived_at >= period.start_day and q.arrived_at < period.end_day
    ),
    'consultations_completed', (
      select count(*) from appointments a, period
      where a.clinic_id = p_clinic_id and a.status = 'completed'
        and a.scheduled_for >= period.start_day and a.scheduled_for < period.end_day
    ),
    'prescriptions_issued', (
      select count(*) from prescriptions p
      join doctors d on d.id = p.doctor_id, period
      where d.clinic_id = p_clinic_id
        and p.created_at >= period.start_day and p.created_at < period.end_day
    ),
    'notifiable_conditions', (
      select count(*) from notifiable_conditions n, period
      where n.clinic_id = p_clinic_id
        and n.detected_at >= period.start_day and n.detected_at < period.end_day
    ),
    'median_wait_minutes', (
      select coalesce(
        percentile_cont(0.5) within group (
          order by extract(epoch from (q.called_at - q.arrived_at)) / 60
        ), 0)
      from queue_entries q, period
      where q.clinic_id = p_clinic_id and q.called_at is not null
        and q.arrived_at >= period.start_day and q.arrived_at < period.end_day
    )
  );
$$;

-- Only the service role and admins may call the procedures that move stock or
-- money. Everything else goes through RLS on the tables directly.
revoke execute on function deduct_stock_fefo(uuid, integer) from public, anon, authenticated;
revoke execute on function dispense_prescription(uuid, uuid, text, fulfilment_method, text, numeric, numeric, numeric, numeric, jsonb) from public, anon, authenticated;
revoke execute on function settle_payment(uuid, text) from public, anon, authenticated;

grant execute on function ring_up_sale(uuid, uuid, text, jsonb, numeric, payment_gateway, numeric) to authenticated;
grant execute on function void_sale(uuid, uuid) to authenticated;
grant execute on function available_slots(uuid, date) to anon, authenticated;
grant execute on function build_monthly_return(uuid, date) to authenticated;

-- ----------------------------------------------------------------------------
-- Register a walk-in and put them in the queue, in one transaction.
--
-- Many walk-ins have no phone and no email, so there is no auth account to
-- create. The patient record stands on its own and is linked to an auth
-- identity later if they sign up. A patient without a phone still needs a file.
-- ----------------------------------------------------------------------------
create or replace function register_walk_in(
  p_clinic_id     uuid,
  p_full_name     text,
  p_sa_id_number  text,
  p_phone         text,
  p_date_of_birth date,
  p_gender        gender,
  p_reason        text,
  p_file_number   text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  existing_patient uuid;
  new_patient      uuid;
  placeholder      uuid := gen_random_uuid();
  today_count      integer;
  ticket           text;
begin
  -- Never create a second file for someone already registered.
  if p_sa_id_number is not null then
    select id into existing_patient from patients where sa_id_number = p_sa_id_number;
  end if;

  if existing_patient is null then
    insert into users (id, full_name, email, phone, role)
    values (
      placeholder,
      p_full_name,
      -- Synthetic address: unique, non-routable, never emailed.
      'walkin+' || placeholder || '@invalid.dokta.africa',
      p_phone,
      'patient'
    );

    insert into patients (user_id, sa_id_number, date_of_birth, gender, file_number)
    values (placeholder, p_sa_id_number, p_date_of_birth, p_gender, p_file_number)
    returning id into new_patient;
  else
    new_patient := existing_patient;
  end if;

  select count(*) + 1 into today_count
  from queue_entries
  where clinic_id = p_clinic_id and arrived_at >= current_date;

  ticket := to_char(current_date, 'DD') || lpad(today_count::text, 3, '0');

  insert into queue_entries (clinic_id, patient_id, ticket_number, reason)
  values (p_clinic_id, new_patient, ticket, p_reason);

  return jsonb_build_object(
    'patient_id', new_patient,
    'ticket_number', ticket,
    'existing', existing_patient is not null
  );
end $$;

revoke execute on function register_walk_in(uuid, text, text, text, date, gender, text, text)
  from public, anon, authenticated;
