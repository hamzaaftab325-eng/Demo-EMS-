-- Reconcile the temporary duplicate archive schema created during Phase 3 QA.
-- The canonical employee archive is public.deleted_employee_archives and
-- profiles.deleted_at / deletion_reason.

drop function if exists public.service_archive_delete_employee(uuid,uuid,text);
drop function if exists public.admin_reactivate_employee(uuid);

drop table if exists public.deleted_employees;

drop index if exists public.profiles_is_deleted_idx;

alter table public.profiles
  drop column if exists is_deleted,
  drop column if exists deleted_reason;

create or replace function public.admin_deactivate_employee(
  p_employee_id uuid,
  p_reason text
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.admin_deactivate_employee(p_employee_id, p_reason)
$$;

revoke all on function public.admin_deactivate_employee(uuid, text)
from public, anon;
grant execute on function public.admin_deactivate_employee(uuid, text)
to authenticated;
