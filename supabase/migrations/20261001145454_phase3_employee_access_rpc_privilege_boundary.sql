alter function public.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) security definer;

alter function public.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) security definer;

revoke all on function public.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean
) from public, anon, authenticated;

revoke all on function public.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text
) from public, anon, authenticated;

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
