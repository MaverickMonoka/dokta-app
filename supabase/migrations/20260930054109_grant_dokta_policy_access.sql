-- Table privileges let requests reach RLS; policies still decide which rows/actions are allowed.
-- Limit this to Dokta healthcare tables, leaving the shared Mobicom Pay tables untouched.
grant usage on schema public to authenticated, service_role;
do $$
declare table_name text; table_oid oid; actions text;
begin
  foreach table_name in array array[
    'users','devices','clinics','clinic_staff','pharmacies','pharmacy_staff',
    'patients','medical_documents','vital_readings','doctors','availability_slots',
    'queue_entries','appointments','consultations','medicines','prescriptions',
    'prescription_items','suppliers','inventory_items','stock_batches','orders',
    'order_items','sales','payments','government_reports','notifiable_conditions',
    'notifications','audit_logs'
  ] loop
    table_oid := to_regclass(format('public.%I', table_name));
    if table_oid is null or not exists(select 1 from pg_class where oid=table_oid and relrowsecurity and relforcerowsecurity) then
      raise exception 'Healthcare table % must have forced RLS before granting access', table_name;
    end if;
    select string_agg(action, ', ') into actions from (
      select distinct case cmd when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE' when 'd' then 'DELETE' end as action
      from (select unnest(case when polcmd='*' then array['r','a','w','d'] else array[polcmd::text] end) as cmd
            from pg_policy where polrelid=table_oid) policy_actions
    ) permitted_actions;
    if actions is not null then execute format('grant %s on table public.%I to authenticated',actions,table_name); end if;
    execute format('grant select, insert, update, delete on table public.%I to service_role',table_name);
  end loop;
end $$;
grant select on public.public_doctors to anon, authenticated;
