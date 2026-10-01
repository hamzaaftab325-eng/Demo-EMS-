create or replace function public.service_assign_employee_work_email(
  p_employee_id uuid,
  p_work_email text,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_profile public.profiles%rowtype;
  v_actor public.profiles%rowtype;
  v_before jsonb;
  v_normalized text := lower(btrim(coalesce(p_work_email, '')));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if v_normalized = ''
     or v_normalized !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid work email.';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id
    and is_active
    and employment_status <> 'deactivated'
    and role = 'super_admin';

  if not found then
    raise exception 'Active Super Admin profile required.';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Employee not found.';
  end if;

  if v_profile.is_test_account is distinct from v_actor.is_test_account then
    raise exception 'Employee is outside the current EMS environment.';
  end if;

  if not v_profile.is_active
     or v_profile.employment_status = 'deactivated' then
    raise exception 'Employee must be active.';
  end if;

  if v_profile.auth_user_id is null
     or v_profile.auth_activated_at is null then
    raise exception 'Employee must complete account setup before work email assignment.';
  end if;

  if not v_profile.is_test_account
     and v_normalized !~ '^[^@[:space:]]+@emarketselect[.]com$' then
    raise exception 'Production work email must use @emarketselect.com.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id <> p_employee_id
      and lower(p.email) = v_normalized
  ) or exists (
    select 1
    from public.employee_access_contacts c
    where c.employee_id <> p_employee_id
      and lower(c.work_email) = v_normalized
  ) then
    raise exception 'Work email is already assigned to another employee.';
  end if;

  v_before := jsonb_build_object(
    'login_email', v_profile.email,
    'work_email', (
      select work_email
      from public.employee_access_contacts
      where employee_id = p_employee_id
    )
  );

  update public.profiles
  set email = v_normalized,
      updated_at = now()
  where id = p_employee_id;

  insert into public.employee_access_contacts (
    employee_id,
    personal_email,
    work_email,
    work_email_assigned_at,
    updated_at,
    updated_by
  )
  values (
    p_employee_id,
    v_profile.email,
    v_normalized,
    now(),
    now(),
    p_actor_id
  )
  on conflict (employee_id) do update
  set work_email = excluded.work_email,
      work_email_assigned_at = excluded.work_email_assigned_at,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason
  )
  values (
    p_actor_id,
    'employee_work_email_assigned',
    'profile',
    p_employee_id::text,
    v_before,
    jsonb_build_object(
      'login_email', v_normalized,
      'work_email', v_normalized
    ),
    'Work login email assigned through EMS System access'
  );
end;
$$;

revoke all on function public.service_assign_employee_work_email(uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.service_assign_employee_work_email(uuid, text, uuid)
to service_role;
