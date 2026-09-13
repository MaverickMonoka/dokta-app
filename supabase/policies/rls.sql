-- ============================================================================
-- DOKTA OS — Row Level Security
--
-- RLS is the real security boundary. The application's capability checks are
-- there to give people sensible screens; these policies are what actually stops
-- one patient reading another's records, and they hold even if an anon key
-- leaks or a query is issued directly against the database.
--
-- Rule followed throughout: enable RLS on every table, grant nothing by
-- default, then add the narrowest policy that makes the product work.
-- ============================================================================

-- ============================================================================
-- Helpers. SECURITY DEFINER so a policy can read a table the caller cannot,
-- STABLE so the planner calls them once per statement rather than per row.
-- ============================================================================

create or replace function auth_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from users where id = auth.uid()), false);
$$;

create or replace function my_patient_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from patients where user_id = auth.uid();
$$;

create or replace function my_doctor_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from doctors where user_id = auth.uid();
$$;

-- Every pharmacy the caller owns or works at.
create or replace function my_pharmacy_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from pharmacies where owner_id = auth.uid()
  union
  select pharmacy_id from pharmacy_staff where user_id = auth.uid();
$$;

create or replace function my_clinic_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select clinic_id from clinic_staff where user_id = auth.uid()
  union
  select clinic_id from doctors where user_id = auth.uid() and clinic_id is not null;
$$;

-- A doctor may see a patient they have treated, are treating, or are booked to
-- treat — never the whole patient list. This is the single most important
-- predicate in the file.
create or replace function treats_patient(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from appointments
    where patient_id = target
      and doctor_id = my_doctor_id()
      and status <> 'cancelled'
  ) or exists (
    select 1 from prescriptions
    where patient_id = target and doctor_id = my_doctor_id()
  );
$$;

-- A pharmacy may see a patient only while it holds a script or order for them.
create or replace function serves_patient(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from prescriptions
    where patient_id = target
      and pharmacy_id in (select my_pharmacy_ids())
      and status in ('sent_to_pharmacy','approved','dispensed','collected')
  ) or exists (
    select 1 from orders
    where patient_id = target and pharmacy_id in (select my_pharmacy_ids())
  );
$$;

-- ============================================================================
-- Enable RLS everywhere. Anything added later without a policy is unreadable,
-- which is the correct default for a database holding health records.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'users','devices','clinics','clinic_staff','pharmacies','pharmacy_staff',
    'patients','medical_documents','vital_readings','doctors','availability_slots',
    'queue_entries','appointments','consultations','medicines','prescriptions',
    'prescription_items','suppliers','inventory_items','stock_batches','orders',
    'order_items','sales','payments','government_reports','notifiable_conditions',
    'notifications','audit_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ============================================================================
-- users
-- ============================================================================

create policy users_read_self on users for select
  using (id = auth.uid() or is_admin());

-- Providers appear in search results, so their name and avatar are public.
-- Only the columns exposed by the public_doctors view below are reachable.
create policy users_update_self on users for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy users_admin_all on users for all
  using (is_admin()) with check (is_admin());

-- A person cannot promote themselves. Role changes go through an admin.
create or replace function block_self_role_change()
returns trigger language plpgsql as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Your role can only be changed by an administrator.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger users_no_self_promotion
  before update on users
  for each row execute function block_self_role_change();

create policy devices_own on devices for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- patients — the core of the model
-- ============================================================================

create policy patients_read_own on patients for select
  using (user_id = auth.uid());

create policy patients_read_treating_doctor on patients for select
  using (auth_role() = 'doctor' and treats_patient(id));

create policy patients_read_serving_pharmacy on patients for select
  using (auth_role() = 'pharmacy' and serves_patient(id));

-- Clinic staff need to register and triage walk-ins, so they see patients
-- who are in their queue today, not the whole register.
create policy patients_read_clinic_queue on patients for select
  using (
    auth_role() in ('clinic','doctor')
    and exists (
      select 1 from queue_entries q
      where q.patient_id = patients.id
        and q.clinic_id in (select my_clinic_ids())
        and q.arrived_at > now() - interval '24 hours'
    )
  );

create policy patients_read_admin on patients for select using (is_admin());

create policy patients_update_own on patients for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registration clerks create patient records for walk-ins with no phone.
create policy patients_insert_clinic on patients for insert
  with check (auth_role() in ('clinic','admin'));

create policy patients_insert_self on patients for insert
  with check (user_id = auth.uid());

-- ============================================================================
-- medical documents and vitals
-- ============================================================================

create policy documents_read on medical_documents for select
  using (
    patient_id = my_patient_id()
    or (auth_role() = 'doctor' and treats_patient(patient_id))
    or is_admin()
  );

create policy documents_insert on medical_documents for insert
  with check (
    uploaded_by = auth.uid()
    and (patient_id = my_patient_id() or (auth_role() = 'doctor' and treats_patient(patient_id)))
  );

-- A record in someone's medical history is not the uploader's to withdraw.
-- Removal is a data-subject request handled by an admin under POPIA.
create policy documents_delete_admin on medical_documents for delete using (is_admin());

create policy vitals_read on vital_readings for select
  using (
    patient_id = my_patient_id()
    or (auth_role() = 'doctor' and treats_patient(patient_id))
    or is_admin()
  );

create policy vitals_insert on vital_readings for insert
  with check (
    patient_id = my_patient_id()
    or (auth_role() in ('doctor','clinic') and treats_patient(patient_id))
  );

-- ============================================================================
-- doctors, clinics, pharmacies — provider directories are public when verified
-- ============================================================================

create policy doctors_read_verified on doctors for select
  using (verification = 'verified' or user_id = auth.uid() or is_admin());

create policy doctors_update_own on doctors for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy doctors_admin on doctors for all
  using (is_admin()) with check (is_admin());

-- A doctor cannot verify themselves.
create or replace function block_self_verification()
returns trigger language plpgsql as $$
begin
  if new.verification is distinct from old.verification and not is_admin() then
    raise exception 'Verification status is set by the platform, not by the provider.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger doctors_no_self_verification
  before update on doctors
  for each row execute function block_self_verification();

create policy availability_read on availability_slots for select using (true);
create policy availability_write_own on availability_slots for all
  using (doctor_id = my_doctor_id()) with check (doctor_id = my_doctor_id());

create policy clinics_read on clinics for select
  using (verification = 'verified' or id in (select my_clinic_ids()) or is_admin());
create policy clinics_admin on clinics for all using (is_admin()) with check (is_admin());

create policy clinic_staff_read on clinic_staff for select
  using (user_id = auth.uid() or clinic_id in (select my_clinic_ids()) or is_admin());

create policy pharmacies_read on pharmacies for select
  using (verification = 'verified' or owner_id = auth.uid() or id in (select my_pharmacy_ids()) or is_admin());
create policy pharmacies_update_own on pharmacies for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy pharmacies_admin on pharmacies for all using (is_admin()) with check (is_admin());

create policy pharmacy_staff_read on pharmacy_staff for select
  using (user_id = auth.uid() or pharmacy_id in (select my_pharmacy_ids()) or is_admin());
create policy pharmacy_staff_manage on pharmacy_staff for all
  using (pharmacy_id in (select id from pharmacies where owner_id = auth.uid()))
  with check (pharmacy_id in (select id from pharmacies where owner_id = auth.uid()));

-- ============================================================================
-- queue
-- ============================================================================

create policy queue_read on queue_entries for select
  using (
    clinic_id in (select my_clinic_ids())
    or patient_id = my_patient_id()
    or is_admin()
  );

create policy queue_write_clinic on queue_entries for all
  using (clinic_id in (select my_clinic_ids()))
  with check (clinic_id in (select my_clinic_ids()));

-- ============================================================================
-- appointments and consultations
-- ============================================================================

create policy appointments_read on appointments for select
  using (
    patient_id = my_patient_id()
    or doctor_id = my_doctor_id()
    or clinic_id in (select my_clinic_ids())
    or is_admin()
  );

create policy appointments_book on appointments for insert
  with check (patient_id = my_patient_id() or auth_role() in ('clinic','admin'));

create policy appointments_update on appointments for update
  using (patient_id = my_patient_id() or doctor_id = my_doctor_id() or is_admin());

create policy consultations_read on consultations for select
  using (
    exists (
      select 1 from appointments a
      where a.id = consultations.appointment_id
        and (a.patient_id = my_patient_id() or a.doctor_id = my_doctor_id())
    )
    or is_admin()
  );

-- Only the treating doctor writes the note.
create policy consultations_write on consultations for all
  using (
    exists (select 1 from appointments a
            where a.id = consultations.appointment_id and a.doctor_id = my_doctor_id())
  )
  with check (
    exists (select 1 from appointments a
            where a.id = consultations.appointment_id and a.doctor_id = my_doctor_id())
  );

-- ============================================================================
-- prescriptions
-- ============================================================================

create policy prescriptions_read on prescriptions for select
  using (
    patient_id = my_patient_id()
    or doctor_id = my_doctor_id()
    or pharmacy_id in (select my_pharmacy_ids())
    or is_admin()
  );

-- Issuing a prescription is restricted to verified doctors. An unverified or
-- suspended doctor cannot prescribe, whatever the application allows.
create policy prescriptions_issue on prescriptions for insert
  with check (
    doctor_id = my_doctor_id()
    and exists (select 1 from doctors d where d.id = my_doctor_id() and d.verification = 'verified')
  );

create policy prescriptions_update on prescriptions for update
  using (
    doctor_id = my_doctor_id()
    or patient_id = my_patient_id()          -- patient chooses the pharmacy
    or pharmacy_id in (select my_pharmacy_ids())
  );

create policy prescription_items_read on prescription_items for select
  using (exists (select 1 from prescriptions p where p.id = prescription_id));

create policy prescription_items_write on prescription_items for all
  using (exists (select 1 from prescriptions p
                 where p.id = prescription_id and p.doctor_id = my_doctor_id()))
  with check (exists (select 1 from prescriptions p
                      where p.id = prescription_id and p.doctor_id = my_doctor_id()));

-- ============================================================================
-- inventory and pharmacy operations
-- ============================================================================

create policy medicines_read on medicines for select using (auth.uid() is not null);
create policy medicines_admin on medicines for all using (is_admin()) with check (is_admin());

create policy inventory_own on inventory_items for all
  using (pharmacy_id in (select my_pharmacy_ids()))
  with check (pharmacy_id in (select my_pharmacy_ids()));

create policy batches_own on stock_batches for all
  using (exists (select 1 from inventory_items i
                 where i.id = inventory_id and i.pharmacy_id in (select my_pharmacy_ids())))
  with check (exists (select 1 from inventory_items i
                      where i.id = inventory_id and i.pharmacy_id in (select my_pharmacy_ids())));

create policy suppliers_own on suppliers for all
  using (pharmacy_id in (select my_pharmacy_ids()))
  with check (pharmacy_id in (select my_pharmacy_ids()));

create policy sales_own on sales for select
  using (pharmacy_id in (select my_pharmacy_ids()) or is_admin());
create policy sales_ring_up on sales for insert
  with check (pharmacy_id in (select my_pharmacy_ids()) and cashier_id = auth.uid());
-- Sales are voided, never deleted. The till record has to survive a dispute.
create policy sales_void on sales for update
  using (pharmacy_id in (select my_pharmacy_ids()));

create policy orders_read on orders for select
  using (
    patient_id = my_patient_id()
    or pharmacy_id in (select my_pharmacy_ids())
    or is_admin()
  );
create policy orders_create on orders for insert
  with check (patient_id = my_patient_id() or pharmacy_id in (select my_pharmacy_ids()));
create policy orders_update on orders for update
  using (pharmacy_id in (select my_pharmacy_ids()) or is_admin());

create policy order_items_read on order_items for select
  using (exists (select 1 from orders o where o.id = order_id));
create policy order_items_write on order_items for all
  using (exists (select 1 from orders o
                 where o.id = order_id and o.pharmacy_id in (select my_pharmacy_ids())))
  with check (exists (select 1 from orders o
                      where o.id = order_id and o.pharmacy_id in (select my_pharmacy_ids())));

-- ============================================================================
-- payments
-- ============================================================================

create policy payments_read_own on payments for select
  using (user_id = auth.uid() or is_admin());

-- No client writes a payment. Every insert and status change goes through the
-- checkout and webhook edge functions, which use the service role. This is the
-- policy that makes a forged "paid" impossible from the browser.
create policy payments_admin_only on payments for all
  using (is_admin()) with check (is_admin());

-- ============================================================================
-- government reporting
-- ============================================================================

create policy gov_reports_clinic on government_reports for select
  using (clinic_id in (select my_clinic_ids()) or is_admin());

create policy gov_reports_write on government_reports for all
  using (clinic_id in (select my_clinic_ids()) and submitted_at is null)
  with check (clinic_id in (select my_clinic_ids()));

create policy notifiable_read on notifiable_conditions for select
  using (clinic_id in (select my_clinic_ids()) or is_admin());
create policy notifiable_write on notifiable_conditions for all
  using (clinic_id in (select my_clinic_ids()))
  with check (clinic_id in (select my_clinic_ids()));

-- ============================================================================
-- notifications and audit
-- ============================================================================

create policy notifications_own on notifications for select using (user_id = auth.uid());
create policy notifications_mark_read on notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The audit log is append-only. Anyone signed in may write to it; only an
-- admin may read it; and nobody may change or delete it. Deliberately there is
-- no update or delete policy on this table, for any role — an audit trail an
-- administrator can edit is not an audit trail.
create policy audit_append on audit_logs for insert with check (auth.uid() is not null);
create policy audit_read_admin on audit_logs for select using (is_admin());

-- A person may read their own access history: POPIA gives the data subject
-- the right to know who looked at their records.
create policy audit_read_own_subject on audit_logs for select
  using (subject_id = my_patient_id());

-- ============================================================================
-- Public directory view. Exposes only what a patient needs to choose a doctor,
-- so the browser never queries the users table directly.
-- ============================================================================

create or replace view public_doctors
with (security_invoker = true) as
select d.id,
       u.full_name,
       u.avatar_url,
       d.speciality,
       d.sub_specialities,
       d.languages,
       d.years_experience,
       d.consult_fee,
       d.city,
       d.province,
       d.offers_video,
       d.offers_in_person,
       d.rating,
       d.rating_count,
       d.bio
from doctors d
join users u on u.id = d.user_id
where d.verification = 'verified' and u.is_active;

grant select on public_doctors to anon, authenticated;
