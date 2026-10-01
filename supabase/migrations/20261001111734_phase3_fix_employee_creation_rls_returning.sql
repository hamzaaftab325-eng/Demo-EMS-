
create or replace function public.admin_create_employee(
  p_employee_code text,
  p_email text,
  p_full_name text,
  p_job_title text,
  p_department_id uuid,
  p_employment_type public.employment_type,
  p_role public.app_role,
  p_timezone text default 'Asia/Karachi',
  p_hire_date date default null,
  p_manager_id uuid default null,
  p_schedule_id uuid default null,
  p_is_test_account boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_employee_id uuid := gen_random_uuid();
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active Super Admin profile required.';
  end if;

  if nullif(btrim(p_employee_code), '') is null then
    raise exception 'Employee code is required.';
  end if;

  if nullif(btrim(p_email), '') is null then
    raise exception 'Email is required.';
  end if;

  if nullif(btrim(p_full_name), '') is null then
    raise exception 'Full name is required.';
  end if;

  if nullif(btrim(p_job_title), '') is null then
    raise exception 'Job title is required.';
  end if;

  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.is_active
  ) then
    raise exception 'Select an active department.';
  end if;

  if p_manager_id is not null then
    if not exists (
      select 1
      from public.profiles manager
      join public.profiles actor on actor.id = v_actor
      where manager.id = p_manager_id
        and manager.is_active
        and manager.employment_status <> 'deactivated'
        and manager.role in ('manager','director','super_admin')
        and manager.is_test_account = actor.is_test_account
    ) then
      raise exception 'Select an active manager in the same EMS environment.';
    end if;
  end if;

  if p_schedule_id is not null
     and not exists (
       select 1 from public.work_schedules ws
       where ws.id = p_schedule_id
         and ws.is_active
     ) then
    raise exception 'Select an active work schedule.';
  end if;

  if exists (
    select 1 from public.profiles p
    where upper(btrim(p.employee_code)) = upper(btrim(p_employee_code))
  ) then
    raise exception 'Employee code already exists.';
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(btrim(p.email)) = lower(btrim(p_email))
  ) then
    raise exception 'Email is already assigned to another employee.';
  end if;

  insert into public.profiles (
    id,
    employee_code,
    email,
    full_name,
    job_title,
    department_id,
    employment_type,
    role,
    employment_status,
    timezone,
    hire_date,
    is_active,
    created_by,
    is_test_account
  )
  values (
    v_employee_id,
    upper(btrim(p_employee_code)),
    lower(btrim(p_email)),
    btrim(p_full_name),
    btrim(p_job_title),
    p_department_id,
    p_employment_type,
    p_role,
    'active',
    coalesce(nullif(btrim(p_timezone), ''), 'Asia/Karachi'),
    p_hire_date,
    true,
    v_actor,
    p_is_test_account
  );

  insert into public.employee_status_history (
    employee_id, old_status, new_status, reason, changed_by
  )
  values (
    v_employee_id, null, 'active', 'Employee profile created', v_actor
  );

  if p_manager_id is not null then
    insert into public.reporting_lines (
      employee_id, manager_id, effective_from, is_primary, created_by
    )
    values (
      v_employee_id, p_manager_id, current_date, true, v_actor
    );
  end if;

  if p_schedule_id is not null then
    insert into public.schedule_assignments (
      employee_id, schedule_id, effective_from, assigned_by
    )
    values (
      v_employee_id, p_schedule_id, current_date, v_actor
    );
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, after_data, reason
  )
  select
    v_actor,
    'employee_created',
    'profile',
    v_employee_id::text,
    to_jsonb(p),
    'Employee created through EMS'
  from public.profiles p
  where p.id = v_employee_id;

  return v_employee_id;
end;
$$;

revoke all on function public.admin_create_employee(
  text,text,text,text,uuid,public.employment_type,public.app_role,
  text,date,uuid,uuid,boolean
) from public, anon;

grant execute on function public.admin_create_employee(
  text,text,text,text,uuid,public.employment_type,public.app_role,
  text,date,uuid,uuid,boolean
) to authenticated;

notify pgrst, 'reload schema';
