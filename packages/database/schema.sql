-- ============================================================================
-- DOKTA OS — canonical schema
-- PostgreSQL 15 / Supabase
--
-- Identity lives in auth.users. public.users mirrors that UUID so every RLS
-- policy can compare against auth.uid() without a join.
--
-- Apply with:  supabase db push
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";  -- case-insensitive email column
create extension if not exists "pg_trgm";      -- fuzzy patient and medicine search
create extension if not exists "btree_gist";   -- appointment overlap exclusion

-- ============================================================================
-- Enums
-- ============================================================================

create type user_role           as enum ('patient','doctor','pharmacy','clinic','admin');
create type gender              as enum ('male','female','other','undisclosed');
create type verification_status as enum ('pending','under_review','verified','rejected','suspended');
create type appointment_type    as enum ('video','in_person','home_visit');
create type appointment_status  as enum ('requested','confirmed','in_progress','completed','cancelled','no_show');
create type prescription_status as enum ('issued','sent_to_pharmacy','approved','dispensed','collected','cancelled','expired');
create type order_status        as enum ('cart','awaiting_payment','paid','picking','ready_for_collection','out_for_delivery','delivered','cancelled','refunded');
create type fulfilment_method   as enum ('collection','delivery');
create type payment_gateway     as enum ('yoco','payfast','ozow','snapscan','cash','medical_aid');
create type payment_status      as enum ('pending','processing','succeeded','failed','refunded','partially_refunded');
create type medicine_schedule   as enum ('S0','S1','S2','S3','S4','S5','S6');
create type queue_state         as enum ('waiting','triaged','with_doctor','done','left');
create type reading_source      as enum ('manual','wearable','clinic_device');

-- ============================================================================
-- Identity
-- ============================================================================

create table users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null check (length(trim(full_name)) > 1),
  email       citext not null unique,
  phone       text unique check (phone ~ '^\+27[6-8][0-9]{8}$'),
  role        user_role not null default 'patient',
  avatar_url  text,
  locale      text not null default 'en-ZA',
  is_active   boolean not null default true,
  last_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index users_role_idx on users(role) where is_active;

create table devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  push_token   text not null unique,
  platform     text not null check (platform in ('ios','android','web')),
  last_used_at timestamptz not null default now()
);

-- ============================================================================
-- Facilities
-- ============================================================================

-- A clinic is a physical facility: state, NGO or private. The government
-- reporting module reports per facility, so the DoH code lives here.
create table clinics (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  facility_code     text unique,          -- DoH facility code, used in DHIS2 returns
  facility_type     text not null default 'clinic'
                      check (facility_type in ('clinic','chc','district_hospital','private_practice','mobile')),
  sub_district      text,
  district          text,
  province          text,
  physical_address  text,
  latitude          double precision,
  longitude         double precision,
  phone             text,
  operating_hours   jsonb not null default '{}'::jsonb,
  verification      verification_status not null default 'pending',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table clinic_staff (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  position   text not null default 'clerk'
               check (position in ('manager','nurse','clerk','data_capturer')),
  can_triage boolean not null default false,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table pharmacies (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid not null references users(id),
  name                   text not null,
  registration_no        text not null unique,   -- SAPC
  responsible_pharmacist text,
  phone                  text,
  email                  citext,
  physical_address       text,
  suburb                 text,
  city                   text,
  province               text,
  latitude               double precision,
  longitude              double precision,
  opens_at               time not null default '08:00',
  closes_at              time not null default '18:00',
  offers_delivery        boolean not null default true,
  delivery_radius_km     integer not null default 15 check (delivery_radius_km > 0),
  delivery_fee           numeric(10,2) not null default 0 check (delivery_fee >= 0),
  verification           verification_status not null default 'pending',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index pharmacies_city_idx on pharmacies(city) where verification = 'verified';

create table pharmacy_staff (
  id           uuid primary key default gen_random_uuid(),
  pharmacy_id  uuid not null references pharmacies(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  position     text not null default 'assistant'
                 check (position in ('manager','pharmacist','assistant','cashier')),
  can_dispense boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (pharmacy_id, user_id)
);

-- Only a pharmacist may hold dispensing rights. Enforced here rather than in
-- the application, because dispensing is the regulated act.
alter table pharmacy_staff add constraint dispensing_requires_pharmacist
  check (not can_dispense or position in ('pharmacist','manager'));

-- ============================================================================
-- Patients
-- ============================================================================

create table patients (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references users(id) on delete cascade,
  date_of_birth    date check (date_of_birth <= current_date),
  gender           gender not null default 'undisclosed',
  sa_id_number     text unique check (sa_id_number ~ '^[0-9]{13}$'),
  passport_number  text,
  file_number      text,          -- clinic paper file, for reconciliation
  blood_type       text check (blood_type in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  medical_history  jsonb not null default '[]'::jsonb,
  allergies        jsonb not null default '[]'::jsonb,
  chronic_meds     jsonb not null default '[]'::jsonb,
  medical_aid_name text,
  medical_aid_no   text,
  physical_address text,
  suburb           text,
  city             text,
  province         text,
  postal_code      text,
  latitude         double precision,
  longitude        double precision,
  emergency_name   text,
  emergency_phone  text,
  wallet_balance   numeric(12,2) not null default 0 check (wallet_balance >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index patients_file_number_idx on patients(file_number);

create table medical_documents (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  title       text not null,
  category    text not null default 'general',
  storage_key text not null,
  mime_type   text not null,
  size_bytes  integer not null check (size_bytes > 0),
  uploaded_by uuid not null references users(id),
  created_at  timestamptz not null default now()
);
create index medical_documents_patient_idx on medical_documents(patient_id, created_at desc);

create table vital_readings (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id) on delete cascade,
  metric        text not null
                  check (metric in ('heart_rate','systolic','diastolic','spo2','glucose','weight','temperature','respiratory_rate')),
  value         double precision not null,
  unit          text not null,
  source        reading_source not null default 'manual',
  device_name   text,
  recorded_at   timestamptz not null,
  created_at    timestamptz not null default now()
);
create index vital_readings_lookup_idx on vital_readings(patient_id, metric, recorded_at desc);

-- Consumer wearables are not clinical instruments. A reading from one may be
-- stored and shown, but must never be presented as a clinical measurement.
-- This carries forward the guard from the original DoKta schema.
create or replace function reject_clinical_grade_wearable()
returns trigger language plpgsql as $$
begin
  if new.source = 'wearable' and new.metric in ('systolic','diastolic','glucose') then
    raise exception
      'Wearable devices may not supply % at clinical grade. Record it as source=clinic_device or manual.', new.metric
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger vital_readings_no_clinical_wearable
  before insert or update on vital_readings
  for each row execute function reject_clinical_grade_wearable();

-- ============================================================================
-- Doctors
-- ============================================================================

create table doctors (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references users(id) on delete cascade,
  clinic_id        uuid references clinics(id),
  speciality       text not null,
  sub_specialities text[] not null default '{}',
  hpcsa_number     text not null unique check (hpcsa_number ~* '^(MP|DP|PS|OT|PT)\s?[0-9]{5,7}$'),
  practice_number  text,
  bio              text,
  languages        text[] not null default '{English}',
  years_experience integer not null default 0 check (years_experience between 0 and 70),
  consult_fee      numeric(10,2) not null default 0 check (consult_fee >= 0),
  follow_up_fee    numeric(10,2) check (follow_up_fee >= 0),
  city             text,
  province         text,
  offers_video     boolean not null default true,
  offers_in_person boolean not null default true,
  verification     verification_status not null default 'pending',
  verified_at      timestamptz,
  verified_by      uuid references users(id),
  rating           numeric(2,1) not null default 0 check (rating between 0 and 5),
  rating_count     integer not null default 0,
  payout_account   jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index doctors_search_idx on doctors(speciality, city) where verification = 'verified';

create table availability_slots (
  id         uuid primary key default gen_random_uuid(),
  doctor_id  uuid not null references doctors(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  slot_mins  smallint not null default 15 check (slot_mins between 5 and 120),
  is_active  boolean not null default true,
  check (end_time > start_time),
  unique (doctor_id, weekday, start_time)
);

-- ============================================================================
-- Clinic queue — walk-in flow, the part telemedicine does not cover
-- ============================================================================

create table queue_entries (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  patient_id     uuid not null references patients(id),
  ticket_number  text not null,
  state          queue_state not null default 'waiting',
  -- South African Triage Scale. Red must be seen immediately.
  triage_colour  text check (triage_colour in ('red','orange','yellow','green','blue')),
  triage_notes   text,
  triaged_by     uuid references users(id),
  reason         text,
  seen_by        uuid references doctors(id),
  arrived_at     timestamptz not null default now(),
  triaged_at     timestamptz,
  called_at      timestamptz,
  completed_at   timestamptz,
  unique (clinic_id, ticket_number, arrived_at)
);
create index queue_active_idx on queue_entries(clinic_id, state, arrived_at)
  where state in ('waiting','triaged','with_doctor');

-- ============================================================================
-- Appointments and consultations
-- ============================================================================

create table appointments (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  patient_id       uuid not null references patients(id),
  doctor_id        uuid not null references doctors(id),
  clinic_id        uuid references clinics(id),
  type             appointment_type not null default 'video',
  scheduled_for    timestamptz not null,
  duration_mins    smallint not null default 15 check (duration_mins > 0),
  status           appointment_status not null default 'requested',
  payment_status   payment_status not null default 'pending',
  reason_for_visit text,
  symptoms         text[] not null default '{}',
  room_id          text,
  fee              numeric(10,2) not null check (fee >= 0),
  cancelled_by     uuid references users(id),
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index appointments_patient_idx on appointments(patient_id, scheduled_for desc);
create index appointments_doctor_day_idx on appointments(doctor_id, scheduled_for);

-- One doctor cannot be in two consultations at once. This is a database-level
-- guarantee rather than an application check, because double-booking under
-- concurrent requests is exactly what an application check misses.
alter table appointments add constraint no_double_booking
  exclude using gist (
    doctor_id with =,
    tstzrange(scheduled_for, scheduled_for + (duration_mins || ' minutes')::interval) with &&
  ) where (status in ('requested','confirmed','in_progress'));

create table consultations (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null unique references appointments(id) on delete cascade,
  started_at      timestamptz,
  ended_at        timestamptz,
  chief_complaint text,
  notes           text,
  diagnosis       text,
  icd10_codes     text[] not null default '{}',
  vitals          jsonb,
  follow_up_date  date,
  attachments     jsonb not null default '[]'::jsonb,
  ai_draft        text,          -- model output, always a draft
  signed_by       uuid references doctors(id),
  signed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ended_at is null or started_at is not null),
  check (signed_at is null or signed_by is not null)
);

-- A signed note is the legal record. It cannot be edited afterwards; a
-- correction is a new note referencing the original.
create or replace function protect_signed_consultations()
returns trigger language plpgsql as $$
begin
  if old.signed_at is not null and new.signed_at is not null
     and (new.notes is distinct from old.notes
          or new.diagnosis is distinct from old.diagnosis) then
    raise exception 'A signed consultation note cannot be altered. Add an addendum instead.'
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger consultations_signed_immutable
  before update on consultations
  for each row execute function protect_signed_consultations();

-- ============================================================================
-- Medicines, prescriptions, inventory
-- ============================================================================

create table medicines (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  generic_name      text,
  barcode           text unique,
  nappi_code        text unique,
  category          text not null,
  form              text not null default 'tablet',
  strength          text,
  schedule          medicine_schedule not null default 'S0',
  manufacturer      text,
  active_ingredients text[] not null default '{}',
  contraindications text[] not null default '{}',
  interacts_with    text[] not null default '{}',
  sep_price         numeric(10,2) check (sep_price >= 0),  -- single exit price
  image_url         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index medicines_name_trgm_idx on medicines using gin (name gin_trgm_ops);

create table prescriptions (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  doctor_id       uuid not null references doctors(id),
  patient_id      uuid not null references patients(id),
  consultation_id uuid references consultations(id),
  pharmacy_id     uuid references pharmacies(id),
  status          prescription_status not null default 'issued',
  repeats         smallint not null default 0 check (repeats between 0 and 5),
  repeats_used    smallint not null default 0 check (repeats_used >= 0),
  valid_until     date not null,
  notes           text,
  dispensed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (repeats_used <= repeats)
);
create index prescriptions_patient_idx on prescriptions(patient_id, status);
create index prescriptions_pharmacy_queue_idx on prescriptions(pharmacy_id, created_at)
  where status in ('sent_to_pharmacy','approved');

create table prescription_items (
  id              uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  medicine_id     uuid references medicines(id),
  medicine_name   text not null,
  strength        text,
  dosage          text not null,
  frequency       text not null,
  duration_days   smallint check (duration_days > 0),
  quantity        integer not null default 1 check (quantity > 0),
  instructions    text,
  substitutable   boolean not null default true
);

-- Schedule 5 and 6 medicines may not be repeated, and the script expires in
-- 30 days. Enforced in the database so no client can widen it.
create or replace function enforce_schedule_limits()
returns trigger language plpgsql as $$
declare
  highest medicine_schedule;
begin
  select max(m.schedule) into highest
  from prescription_items pi
  join medicines m on m.id = pi.medicine_id
  where pi.prescription_id = new.id;

  if highest in ('S5','S6') then
    if new.repeats > 0 then
      raise exception 'Schedule % medicines cannot be repeated.', highest
        using errcode = 'check_violation';
    end if;
    if new.valid_until > (current_date + interval '30 days') then
      raise exception 'Schedule % prescriptions expire within 30 days.', highest
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger prescriptions_schedule_limits
  before insert or update on prescriptions
  for each row execute function enforce_schedule_limits();

-- The trigger above only ever sees prescription_items that already exist at
-- the moment it fires. The application always creates the prescription
-- header first and adds items in a second statement — proven in a sandbox
-- test against a copy of this exact trigger — so on a first insert the
-- subquery finds nothing, `highest` is null, and an S5/S6 script sails
-- through with a 6-month expiry and default repeats. This second trigger
-- closes that gap by checking at the point a risky item actually arrives,
-- whichever order the header and items were created in.
create or replace function enforce_schedule_limits_on_item_insert()
returns trigger language plpgsql as $$
declare
  item_schedule medicine_schedule;
  parent        prescriptions%rowtype;
begin
  select schedule into item_schedule from medicines where id = new.medicine_id;
  if item_schedule is null or item_schedule not in ('S5', 'S6') then
    return new;
  end if;

  select * into parent from prescriptions where id = new.prescription_id;

  if parent.repeats > 0 then
    raise exception 'Schedule % medicines cannot be repeated.', item_schedule
      using errcode = 'check_violation';
  end if;
  if parent.valid_until > (current_date + interval '30 days') then
    raise exception 'Schedule % prescriptions expire within 30 days.', item_schedule
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

create trigger prescription_items_schedule_limits
  after insert on prescription_items
  for each row execute function enforce_schedule_limits_on_item_insert();

create table suppliers (
  id             uuid primary key default gen_random_uuid(),
  pharmacy_id    uuid not null references pharmacies(id) on delete cascade,
  name           text not null,
  contact_name   text,
  phone          text,
  email          citext,
  account_no     text,
  lead_time_days smallint not null default 3 check (lead_time_days >= 0),
  created_at     timestamptz not null default now()
);

create table inventory_items (
  id             uuid primary key default gen_random_uuid(),
  pharmacy_id    uuid not null references pharmacies(id) on delete cascade,
  medicine_id    uuid not null references medicines(id),
  selling_price  numeric(10,2) not null check (selling_price >= 0),
  cost_price     numeric(10,2) check (cost_price >= 0),
  stock_on_hand  integer not null default 0 check (stock_on_hand >= 0),
  reorder_level  integer not null default 10 check (reorder_level >= 0),
  reorder_qty    integer not null default 50 check (reorder_qty > 0),
  shelf_location text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (pharmacy_id, medicine_id)
);
create index inventory_low_stock_idx on inventory_items(pharmacy_id)
  where stock_on_hand <= reorder_level;

create table stock_batches (
  id           uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory_items(id) on delete cascade,
  batch_number text not null,
  quantity     integer not null check (quantity > 0),
  expiry_date  date not null,
  supplier_id  uuid references suppliers(id),
  received_at  timestamptz not null default now()
);
create index stock_batches_fefo_idx on stock_batches(inventory_id, expiry_date);

-- ============================================================================
-- Orders, counter sales, payments
-- ============================================================================

create table orders (
  id               uuid primary key default gen_random_uuid(),
  reference        text not null unique,
  patient_id       uuid not null references patients(id),
  pharmacy_id      uuid not null references pharmacies(id),
  prescription_id  uuid unique references prescriptions(id),
  status           order_status not null default 'cart',
  fulfilment       fulfilment_method not null default 'collection',
  delivery_address text,
  delivery_fee     numeric(10,2) not null default 0 check (delivery_fee >= 0),
  subtotal         numeric(12,2) not null default 0 check (subtotal >= 0),
  vat              numeric(12,2) not null default 0 check (vat >= 0),
  total            numeric(12,2) not null default 0 check (total >= 0),
  courier_ref      text,
  placed_at        timestamptz,
  delivered_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (fulfilment <> 'delivery' or delivery_address is not null)
);
create index orders_pharmacy_idx on orders(pharmacy_id, status);
create index orders_patient_idx on orders(patient_id, created_at desc);

create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  medicine_id uuid references medicines(id),
  description text not null,
  quantity    integer not null check (quantity > 0),
  unit_price  numeric(10,2) not null check (unit_price >= 0),
  line_total  numeric(12,2) not null check (line_total >= 0)
);

create table sales (
  id          uuid primary key default gen_random_uuid(),
  reference   text not null unique,
  pharmacy_id uuid not null references pharmacies(id) on delete cascade,
  cashier_id  uuid not null references users(id),
  lines       jsonb not null default '[]'::jsonb,
  subtotal    numeric(12,2) not null check (subtotal >= 0),
  discount    numeric(12,2) not null default 0 check (discount >= 0),
  vat         numeric(12,2) not null check (vat >= 0),
  total       numeric(12,2) not null check (total >= 0),
  tendered    numeric(12,2) check (tendered >= 0),
  change      numeric(12,2),
  gateway     payment_gateway not null default 'cash',
  voided_at   timestamptz,
  voided_by   uuid references users(id),
  created_at  timestamptz not null default now()
);
create index sales_pharmacy_day_idx on sales(pharmacy_id, created_at desc) where voided_at is null;

create table payments (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  user_id         uuid not null references users(id),
  appointment_id  uuid unique references appointments(id),
  order_id        uuid unique references orders(id),
  amount          numeric(12,2) not null check (amount > 0),
  currency        char(3) not null default 'ZAR',
  gateway         payment_gateway not null,
  gateway_ref     text,
  status          payment_status not null default 'pending',
  failure_reason  text,
  refunded_amount numeric(12,2) not null default 0 check (refunded_amount >= 0),
  raw_payload     jsonb,
  paid_at         timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (refunded_amount <= amount),
  check (appointment_id is not null or order_id is not null)
);
create index payments_gateway_ref_idx on payments(gateway_ref);
create index payments_user_idx on payments(user_id, created_at desc);

-- ============================================================================
-- Government reporting
-- ============================================================================

-- Monthly facility returns in the shape the District Health Information
-- System expects. Rows are built from operational data, then submitted; once
-- submitted they are frozen, because a return that changes after submission
-- cannot be reconciled against what the district received.
create table government_reports (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id) on delete cascade,
  period_month   date not null,     -- always the first of the month
  report_type    text not null default 'dhis2_monthly'
                   check (report_type in ('dhis2_monthly','stock_return','notifiable_disease','nhi_registration')),
  indicators     jsonb not null default '{}'::jsonb,
  headcount      integer not null default 0 check (headcount >= 0),
  submitted_at   timestamptz,
  submitted_by   uuid references users(id),
  district_ref   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (clinic_id, period_month, report_type),
  check (period_month = date_trunc('month', period_month)::date)
);

create or replace function freeze_submitted_reports()
returns trigger language plpgsql as $$
begin
  if old.submitted_at is not null then
    raise exception 'Report for % was submitted on %. Submit a correction instead.',
      to_char(old.period_month, 'Mon YYYY'), old.submitted_at::date
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger government_reports_frozen
  before update on government_reports
  for each row execute function freeze_submitted_reports();

-- Conditions that must be reported to the Department of Health by law,
-- within the window set for each category.
create table notifiable_conditions (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null references clinics(id),
  patient_id     uuid not null references patients(id),
  consultation_id uuid references consultations(id),
  condition      text not null,
  icd10_code     text,
  category       text not null check (category in ('cat_1_immediate','cat_2_weekly')),
  detected_at    timestamptz not null default now(),
  reported_at    timestamptz,
  reported_by    uuid references users(id),
  notes          text
);
create index notifiable_unreported_idx on notifiable_conditions(clinic_id, detected_at)
  where reported_at is null;

-- ============================================================================
-- Platform
-- ============================================================================

create table notifications (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references users(id) on delete cascade,
  channel   text not null check (channel in ('email','sms','whatsapp','push','in_app')),
  template  text not null,
  title     text not null,
  body      text not null,
  data      jsonb,
  status    text not null default 'queued'
              check (status in ('queued','sent','delivered','read','failed')),
  sent_at   timestamptz,
  read_at   timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on notifications(user_id, created_at desc)
  where channel = 'in_app';

-- POPIA section 14. Every read and write of personal health information.
-- Append-only: see the policies file, where update and delete are denied to
-- every role including admin.
create table audit_logs (
  id           bigserial primary key,
  actor_id     uuid references users(id),
  action       text not null check (action in ('read','create','update','delete','export','login','failed_login')),
  entity       text not null,
  entity_id    text,
  subject_id   uuid,          -- the data subject whose information was touched
  lawful_basis text default 'consent',
  ip_address   inet,
  user_agent   text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);
create index audit_entity_idx on audit_logs(entity, entity_id);
create index audit_subject_idx on audit_logs(subject_id, created_at desc);

-- ============================================================================
-- Shared triggers
-- ============================================================================

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','clinics','pharmacies','patients','doctors','appointments',
    'consultations','medicines','prescriptions','inventory_items','orders',
    'payments','government_reports'
  ] loop
    execute format(
      'create trigger %I_touch before update on %I for each row execute function touch_updated_at()',
      t, t);
  end loop;
end $$;

-- New auth.users rows get a profile automatically, so a sign-up is one step.
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'patient')
  )
  on conflict (id) do nothing;

  if coalesce((new.raw_user_meta_data->>'role')::user_role, 'patient') = 'patient' then
    insert into public.patients (user_id) values (new.id) on conflict do nothing;
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
