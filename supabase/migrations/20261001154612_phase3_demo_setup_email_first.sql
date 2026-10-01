create or replace function private.admin_create_employee(
  p_employee_code text,
  p_email text,
  p_full_name text,
  p_job_title text,
  p_department_id uuid,
  p_employment_type public.employment_type,
  p_role public.app_role,
  p_timezone text,
  p_hire_date date,
  p_manager_id uuid,
  p_schedule_id uuid,
  p_is_test_account boolean,
  p_personal_email text,
  p_work_email text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_employee_id uuid;
  v_actor uuid;
  v_personal text := lower(btrim(coalesce(p_personal_email, p_email)));
  v_login text := lower(btrim(coalesce(p_email, '')));
  v_work text := nullif(lower(btrim(coalesce(p_work_email, ''))), '');
begin
  if v_personal !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid personal/setup email.';
  end if;

  if v_login !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid login email.';
  end if;

  if v_work is not null
     and v_work !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid work email.';
  end if;

  if p_is_test_account then
    if v_login <> v_personal then
      raise exception 'Demo employee setup must begin with the setup email.';
    end if;
  else
    if v_work is null then
      raise exception 'Production employees require a work email at creation.';
    end if;

    if v_work <> v_login then
      raise exception 'Production work email must match the login email.';
    end if;

    if v_work !~ '^[^@[:space:]]+@emarketselect[.]com$' then
      raise exception 'Production work email must use @emarketselect.com.';
    end if;
  end if;

  if exists (
    select 1
    from public.employee_access_contacts c
    where lower(c.personal_email) = v_personal
  ) then
    raise exception 'Personal/setup email is already assigned to another employee.';
  end if;

  if v_work is not null and exists (
    select 1
    from public.employee_access_contacts c
    where lower(c.personal_email) = v_work
       or lower(coalesce(c.work_email, '')) = v_work
  ) then
    raise exception 'Work email is already assigned to another employee.';
  end if;

  v_employee_id := public.admin_create_employee(
    p_employee_code,
    v_login,
    p_full_name,
    p_job_title,
    p_department_id,
    p_employment_type,
    p_role,
    p_timezone,
    p_hire_date,
    p_manager_id,
    p_schedule_id,
    p_is_test_account
  );

  v_actor := private.current_profile_id();

  update public.employee_access_contacts
  set
    personal_email = v_personal,
    work_email = v_work,
    work_email_assigned_at = case
      when v_work is not null and v_work = v_login then now()
      else null
    end,
    updated_at = now(),
    updated_by = v_actor
  where employee_id = v_employee_id;

  return v_employee_id;
end;
$$;

revoke all on function private.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) from public, anon;
grant execute on function private.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) to authenticated;
