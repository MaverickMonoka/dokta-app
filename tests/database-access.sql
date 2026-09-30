-- Run in a transaction against a test database, or against Dokta with all changes rolled back.
begin;
do $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,raw_user_meta_data)
  values(v_id,'dokta-security-test-'||v_id||'@example.invalid','{"full_name":"Synthetic Security Test"}'::jsonb);
  perform set_config('request.jwt.claim.sub',v_id::text,true);
  set local role authenticated;
  if (select count(*) from public.users where id=v_id) <> 1 then raise exception 'Own profile read failed'; end if;
  if exists(select 1 from public.users where id<>v_id) then raise exception 'Unrelated user profile exposed'; end if;
  if (select count(*) from public.patients where user_id=v_id) <> 1 then raise exception 'Patient profile read failed'; end if;
  begin
    update public.users set role='admin' where id=v_id;
    raise exception 'Self promotion permitted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.ring_up_sale(gen_random_uuid(),v_id,'SECURITY-TEST','[]'::jsonb,0,'cash',0);
    raise exception 'Patient sale permitted';
  exception when insufficient_privilege then null; end;
  reset role;
  update public.users set role='doctor' where id=v_id;
  if (select role from public.users where id=v_id) <> 'doctor' then raise exception 'Administrative update failed'; end if;
end $$;
rollback;
