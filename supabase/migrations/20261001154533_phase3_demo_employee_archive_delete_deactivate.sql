alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists deleted_original_email text,
  add column if not exists deleted_original_employee_code text;

create index if not exists profiles_deleted_at_idx
  on public.profiles(deleted_at)
  where deleted_at is not null;

create table if not exists public.deleted_employee_archives (
  id uuid primary key default gen_random_uuid(),
  original_profile_id uuid not null,
  employee_code text not null,
  full_name text not null,
  login_email text not null,
  setup_email text,
  work_email text,
  role public.app_role not null,
  is_test_account boolean not null,
  snapshot jsonb not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references public.profiles(id) on delete set null,
  deletion_reason text not null
);

create unique index if not exists deleted_employee_archives_profile_uidx
  on public.deleted_employee_archives(original_profile_id);

create index if not exists deleted_employee_archives_deleted_at_idx
  on public.deleted_employee_archives(deleted_at desc);

alter table public.deleted_employee_archives enable row level security;

revoke all on table public.deleted_employee_archives from anon, authenticated;
grant select on table public.deleted_employee_archives to authenticated;

drop policy if exists deleted_employee_archives_super_admin_select
  on public.deleted_employee_archives;

create policy deleted_employee_archives_super_admin_select
on public.deleted_employee_archives
for select
to authenticated
using ((select private.current_app_role()) = 'super_admin');

create or replace function public.service_archive_demo_employee(
  p_employee_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_access public.employee_access_contacts%rowtype;
  v_snapshot jsonb;
  v_auth_user_id uuid;
  v_suffix text;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if v_reason = '' then
    raise exception 'Deletion reason is required.';
  end if;

  select * into v_actor
  from public.profiles
  where id = p_actor_id
    and role = 'super_admin'
    and is_active
    and employment_status <> 'deactivated'
    and deleted_at is null;

  if not found then
    raise exception 'Active Super Admin profile required.';
  end if;

  if p_employee_id = p_actor_id then
    raise exception 'You cannot delete your own Super Admin profile.';
  end if;

  select * into v_target
  from public.profiles
  where id = p_employee_id
  for update;

  if not found then
    raise exception 'Employee not found.';
  end if;

  if v_target.deleted_at is not null then
    raise exception 'Employee is already deleted.';
  end if;

  if not v_target.is_test_account then
    raise exception 'Permanent demo deletion is allowed only for test employees. Deactivate production employees instead.';
  end if;

  if v_target.is_test_account is distinct from v_actor.is_test_account then
    raise exception 'Employee is outside the current EMS environment.';
  end if;

  select * into v_access
  from public.employee_access_contacts
  where employee_id = p_employee_id;

  v_auth_user_id := v_target.auth_user_id;
  v_suffix := replace(p_employee_id::text, '-', '');

  v_snapshot :=
    to_jsonb(v_target)
    || jsonb_build_object(
      'access_contact', case
        when v_access.employee_id is null then null
        else to_jsonb(v_access)
      end,
      'reporting_lines', coalesce((
        select jsonb_agg(to_jsonb(rl) order by rl.created_at)
        from public.reporting_lines rl
        where rl.employee_id = p_employee_id
           or rl.manager_id = p_employee_id
      ), '[]'::jsonb),
      'schedule_assignments', coalesce((
        select jsonb_agg(to_jsonb(sa) order by sa.created_at)
        from public.schedule_assignments sa
        where sa.employee_id = p_employee_id
      ), '[]'::jsonb)
    );

  insert into public.deleted_employee_archives (
    original_profile_id,
    employee_code,
    full_name,
    login_email,
    setup_email,
    work_email,
    role,
    is_test_account,
    snapshot,
    deleted_by,
    deletion_reason
  )
  values (
    v_target.id,
    v_target.employee_code,
    v_target.full_name,
    v_target.email,
    v_access.personal_email,
    v_access.work_email,
    v_target.role,
    v_target.is_test_account,
    v_snapshot,
    p_actor_id,
    v_reason
  )
  on conflict (original_profile_id) do nothing;

  update public.reporting_lines
  set effective_to = current_date - 1
  where (employee_id = p_employee_id or manager_id = p_employee_id)
    and effective_to is null
    and effective_from < current_date;

  delete from public.reporting_lines
  where (employee_id = p_employee_id or manager_id = p_employee_id)
    and effective_to is null
    and effective_from >= current_date;

  update public.schedule_assignments
  set effective_to = current_date - 1
  where employee_id = p_employee_id
    and effective_to is null
    and effective_from < current_date;

  delete from public.schedule_assignments
  where employee_id = p_employee_id
    and effective_to is null
    and effective_from >= current_date;

  update public.employee_access_contacts
  set
    personal_email = 'deleted+' || v_suffix || '@example.test',
    work_email = null,
    work_email_assigned_at = null,
    updated_at = now(),
    updated_by = p_actor_id
  where employee_id = p_employee_id;

  update public.profiles
  set
    auth_user_id = null,
    employee_code = 'DELETED-' || upper(left(v_suffix, 12)),
    email = 'deleted+' || v_suffix || '@example.test',
    employment_status = 'deactivated',
    is_active = false,
    deactivated_at = now(),
    deactivation_reason = 'Deleted demo employee: ' || v_reason,
    deleted_at = now(),
    deleted_by = p_actor_id,
    deletion_reason = v_reason,
    deleted_original_email = v_target.email,
    deleted_original_employee_code = v_target.employee_code,
    auth_invited_at = null,
    auth_activated_at = null,
    updated_at = now()
  where id = p_employee_id;

  if v_target.employment_status <> 'deactivated' then
    insert into public.employee_status_history (
      employee_id,
      old_status,
      new_status,
      reason,
      changed_by
    )
    values (
      p_employee_id,
      v_target.employment_status,
      'deactivated',
      'Deleted demo employee: ' || v_reason,
      p_actor_id
    );
  end if;

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
    'employee_deleted',
    'profile',
    p_employee_id::text,
    jsonb_build_object(
      'employee_code', v_target.employee_code,
      'email', v_target.email,
      'full_name', v_target.full_name,
      'auth_user_id', v_auth_user_id
    ),
    jsonb_build_object(
      'archived', true,
      'deleted_at', now()
    ),
    v_reason
  );

  return jsonb_build_object(
    'employee_id', p_employee_id,
    'auth_user_id', v_auth_user_id,
    'archived', true
  );
end;
$$;

revoke all on function public.service_archive_demo_employee(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.service_archive_demo_employee(uuid, uuid, text)
to service_role;

create or replace function private.admin_deactivate_employee(
  p_employee_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor_id uuid;
  v_actor_test boolean;
  v_target public.profiles%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  if v_reason = '' then
    raise exception 'Deactivation reason is required.';
  end if;

  v_actor_id := private.current_profile_id();

  if v_actor_id = p_employee_id then
    raise exception 'You cannot deactivate your own account.';
  end if;

  select is_test_account
  into v_actor_test
  from public.profiles
  where id = v_actor_id;

  select * into v_target
  from public.profiles
  where id = p_employee_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Employee not found.';
  end if;

  if v_target.is_test_account is distinct from v_actor_test then
    raise exception 'Employee is outside the current EMS environment.';
  end if;

  if v_target.employment_status = 'deactivated' and not v_target.is_active then
    return;
  end if;

  update public.profiles
  set
    employment_status = 'deactivated',
    is_active = false,
    deactivated_at = now(),
    deactivation_reason = v_reason,
    updated_at = now()
  where id = p_employee_id;

  insert into public.employee_status_history (
    employee_id,
    old_status,
    new_status,
    reason,
    changed_by
  )
  values (
    p_employee_id,
    v_target.employment_status,
    'deactivated',
    v_reason,
    v_actor_id
  );

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
    v_actor_id,
    'employee_deactivated',
    'profile',
    p_employee_id::text,
    jsonb_build_object(
      'employment_status', v_target.employment_status,
      'is_active', v_target.is_active
    ),
    jsonb_build_object(
      'employment_status', 'deactivated',
      'is_active', false
    ),
    v_reason
  );
end;
$$;

revoke all on function private.admin_deactivate_employee(uuid, text)
from public, anon;
grant execute on function private.admin_deactivate_employee(uuid, text)
to authenticated;

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
