CREATE OR REPLACE FUNCTION public.admin_update_employee(p_employee_id uuid, p_employee_code text, p_email text, p_full_name text, p_job_title text, p_department_id uuid, p_employment_type employment_type, p_role app_role, p_timezone text, p_hire_date date, p_manager_id uuid, p_schedule_id uuid, p_employment_status employment_status, p_deactivation_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor uuid;
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_current_manager public.reporting_lines%rowtype;
  v_current_schedule public.schedule_assignments%rowtype;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  v_actor := private.current_profile_id();

  select * into v_before
  from public.profiles
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Employee not found.';
  end if;

  if v_before.auth_user_id is not null
     and lower(btrim(p_email)) <> lower(v_before.email) then
    raise exception 'Login email changes must use System access.';
  end if;

  if p_employee_id = v_actor and p_employment_status = 'deactivated' then
    raise exception 'You cannot deactivate your own account.';
  end if;

  if p_employment_status = 'deactivated'
     and nullif(btrim(coalesce(p_deactivation_reason, '')), '') is null then
    raise exception 'A deactivation reason is required.';
  end if;

  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.is_active
  ) then
    raise exception 'Select an active department.';
  end if;

  if p_manager_id is not null then
    if p_manager_id = p_employee_id then
      raise exception 'An employee cannot report to themselves.';
    end if;

    if not exists (
      select 1
      from public.profiles manager
      where manager.id = p_manager_id
        and manager.is_active
        and manager.employment_status <> 'deactivated'
        and manager.role in ('manager','director','super_admin')
        and manager.is_test_account = v_before.is_test_account
    ) then
      raise exception 'Select an active manager in the same EMS environment.';
    end if;
  end if;

  if p_schedule_id is not null
     and not exists (
       select 1 from public.work_schedules ws
       where ws.id = p_schedule_id and ws.is_active
     ) then
    raise exception 'Select an active work schedule.';
  end if;

  update public.profiles
  set
    employee_code = upper(btrim(p_employee_code)),
    email = lower(btrim(p_email)),
    full_name = btrim(p_full_name),
    job_title = btrim(p_job_title),
    department_id = p_department_id,
    employment_type = p_employment_type,
    role = p_role,
    employment_status = p_employment_status,
    timezone = coalesce(nullif(btrim(p_timezone), ''), 'Asia/Karachi'),
    hire_date = p_hire_date,
    is_active = (p_employment_status <> 'deactivated'),
    deactivated_at = case
      when p_employment_status = 'deactivated'
        then coalesce(v_before.deactivated_at, now())
      else null
    end,
    deactivation_reason = case
      when p_employment_status = 'deactivated'
        then btrim(p_deactivation_reason)
      else null
    end,
    updated_at = now()
  where id = p_employee_id
  returning * into v_after;

  if v_before.employment_status is distinct from v_after.employment_status then
    insert into public.employee_status_history (
      employee_id, old_status, new_status, reason, changed_by
    )
    values (
      p_employee_id,
      v_before.employment_status,
      v_after.employment_status,
      case
        when v_after.employment_status = 'deactivated'
          then v_after.deactivation_reason
        else 'Employment status changed'
      end,
      v_actor
    );
  end if;

  select * into v_current_manager
  from public.reporting_lines
  where employee_id = p_employee_id
    and is_primary
    and effective_to is null
  order by effective_from desc, created_at desc
  limit 1
  for update;

  if p_manager_id is null then
    if v_current_manager.id is not null then
      if v_current_manager.effective_from < current_date then
        update public.reporting_lines
        set effective_to = current_date - 1
        where id = v_current_manager.id;
      else
        delete from public.reporting_lines
        where id = v_current_manager.id;
      end if;
    end if;
  elsif v_current_manager.id is null
     or v_current_manager.manager_id is distinct from p_manager_id then
    if v_current_manager.id is not null then
      if v_current_manager.effective_from < current_date then
        update public.reporting_lines
        set effective_to = current_date - 1
        where id = v_current_manager.id;
      else
        delete from public.reporting_lines
        where id = v_current_manager.id;
      end if;
    end if;

    insert into public.reporting_lines (
      employee_id, manager_id, effective_from, is_primary, created_by
    )
    values (
      p_employee_id, p_manager_id, current_date, true, v_actor
    );
  end if;

  select * into v_current_schedule
  from public.schedule_assignments
  where employee_id = p_employee_id
    and effective_to is null
  order by effective_from desc, created_at desc
  limit 1
  for update;

  if p_schedule_id is null then
    if v_current_schedule.id is not null then
      if v_current_schedule.effective_from < current_date then
        update public.schedule_assignments
        set effective_to = current_date - 1
        where id = v_current_schedule.id;
      else
        delete from public.schedule_assignments
        where id = v_current_schedule.id;
      end if;
    end if;
  elsif v_current_schedule.id is null
     or v_current_schedule.schedule_id is distinct from p_schedule_id then
    if v_current_schedule.id is not null then
      if v_current_schedule.effective_from < current_date then
        update public.schedule_assignments
        set effective_to = current_date - 1
        where id = v_current_schedule.id;
      else
        delete from public.schedule_assignments
        where id = v_current_schedule.id;
      end if;
    end if;

    insert into public.schedule_assignments (
      employee_id, schedule_id, effective_from, assigned_by
    )
    values (
      p_employee_id, p_schedule_id, current_date, v_actor
    );
  end if;

  insert into public.audit_logs (
    actor_id, action, entity_type, entity_id, before_data, after_data, reason
  )
  values (
    v_actor,
    'employee_updated',
    'profile',
    p_employee_id::text,
    to_jsonb(v_before),
    to_jsonb(v_after),
    'Employee updated through EMS'
  );
end;
$function$;
