-- Narrow security fixes for the healthcare schema; no patient rows are removed.
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
  actual_price numeric;
  actual_medicine uuid;
  normalised jsonb := '[]'::jsonb;
  new_sale sales%rowtype;
begin

  if auth.uid() is null or p_cashier_id is distinct from auth.uid()
     or not exists (select 1 from users where id = auth.uid() and is_active and role in ('pharmacy','admin'))
     or not (is_admin() or p_pharmacy_id in (select my_pharmacy_ids())) then
    raise exception 'Not permitted to use this pharmacy till' using errcode = '42501';
  end if;
  if p_discount is null or p_discount < 0 then
    raise exception 'Discount must be nonnegative' using errcode = '23514';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'The cart is empty' using errcode = 'check_violation';
  end if;

  for line in select * from jsonb_array_elements(p_lines) loop
    if (line->>'quantity') is null or (line->>'quantity')::integer <= 0 then
      raise exception 'Quantity must be positive' using errcode = '23514';
    end if;
    select selling_price, medicine_id into actual_price, actual_medicine from inventory_items
    where id = (line->>'inventory_id')::uuid and pharmacy_id = p_pharmacy_id and is_active for update;
    if not found then raise exception 'Item is not active at this pharmacy' using errcode = '42501'; end if;
    line := line || jsonb_build_object('unit_price', actual_price, 'medicine_id', actual_medicine);
    normalised := normalised || jsonb_build_array(line);
    gross := gross + ((line->>'unit_price')::numeric * (line->>'quantity')::integer);
  end loop;

  p_lines := normalised;
  if p_discount > gross then raise exception 'Discount exceeds subtotal' using errcode = '23514'; end if;
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

create or replace function void_sale(p_sale_id uuid, p_voided_by uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  sale sales%rowtype;
  line jsonb;
begin
  if auth.uid() is null or p_voided_by is distinct from auth.uid()
     or not exists (select 1 from users where id = auth.uid() and is_active and role in ('pharmacy','admin')) then
    raise exception 'Not permitted to void sales' using errcode = '42501';
  end if;
  select * into sale from sales where id = p_sale_id for update;
  if not found then
    raise exception 'Sale not found' using errcode = 'no_data_found';
  end if;
  if not (is_admin() or sale.pharmacy_id in (select my_pharmacy_ids())) then
    raise exception 'That sale belongs to another pharmacy' using errcode = '42501';
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


create schema if not exists private;

-- Return account rows only where the caller already has an established care relationship.
create or replace function private.can_read_care_user(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    target = auth.uid() or public.is_admin()
    or exists (
      select 1 from public.patients p where p.user_id = target and (
        (public.auth_role() = 'doctor' and public.treats_patient(p.id))
        or (public.auth_role() = 'pharmacy' and public.serves_patient(p.id))
        or (public.auth_role() in ('clinic','doctor') and exists (
          select 1 from public.queue_entries q where q.patient_id = p.id
          and q.clinic_id in (select public.my_clinic_ids()) and q.arrived_at > now() - interval '24 hours'
        ))
      )
    )
    or exists (
      select 1 from public.doctors d join public.appointments a on a.doctor_id = d.id
      where d.user_id = target and a.patient_id = public.my_patient_id()
    )
    or exists (
      select 1 from public.doctors d join public.prescriptions p on p.doctor_id = d.id
      where d.user_id = target and p.patient_id = public.my_patient_id()
    )
  );
$$;
revoke all on function private.can_read_care_user(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.can_read_care_user(uuid) to authenticated;
create policy users_read_care_relationship on public.users for select to authenticated
  using (private.can_read_care_user(id));

create or replace function public.block_self_role_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active)
     and current_user not in ('postgres','service_role') and not public.is_admin() then
    raise exception 'Account privileges can only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function public.ring_up_sale(uuid, uuid, text, jsonb, numeric, public.payment_gateway, numeric) from public, anon;
revoke execute on function public.void_sale(uuid, uuid) from public, anon;
revoke execute on function public.build_monthly_return(uuid, date) from public, anon;
alter function public.build_monthly_return(uuid, date) security invoker;
grant execute on function public.ring_up_sale(uuid, uuid, text, jsonb, numeric, public.payment_gateway, numeric) to authenticated;
grant execute on function public.void_sale(uuid, uuid) to authenticated;
grant execute on function public.build_monthly_return(uuid, date) to authenticated;

alter function public.reject_clinical_grade_wearable() set search_path = public;
alter function public.protect_signed_consultations() set search_path = public;
alter function public.enforce_schedule_limits() set search_path = public;
alter function public.enforce_schedule_limits_on_item_insert() set search_path = public;
alter function public.freeze_submitted_reports() set search_path = public;
alter function public.touch_updated_at() set search_path = public;
alter function public.block_self_verification() set search_path = public;
