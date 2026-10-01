alter function public.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) set schema private;

alter function public.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) set schema private;

revoke all on function private.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) from public, anon;
grant execute on function private.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) to authenticated;

revoke all on function private.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) from public, anon;
grant execute on function private.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) to authenticated;

create or replace function public.admin_create_employee(
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
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.admin_create_employee(
    p_employee_code,
    p_email,
    p_full_name,
    p_job_title,
    p_department_id,
    p_employment_type,
    p_role,
    p_timezone,
    p_hire_date,
    p_manager_id,
    p_schedule_id,
    p_is_test_account,
    p_personal_email,
    p_work_email
  )
$$;

create or replace function public.admin_update_employee(
  p_employee_id uuid,
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
  p_employment_status public.employment_status,
  p_deactivation_reason text,
  p_personal_email text
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.admin_update_employee(
    p_employee_id,
    p_employee_code,
    p_email,
    p_full_name,
    p_job_title,
    p_department_id,
    p_employment_type,
    p_role,
    p_timezone,
    p_hire_date,
    p_manager_id,
    p_schedule_id,
    p_employment_status,
    p_deactivation_reason,
    p_personal_email
  )
$$;

revoke all on function public.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) from public, anon;
grant execute on function public.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) to authenticated;

revoke all on function public.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) from public, anon;
grant execute on function public.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) to authenticated;
