create table if not exists public.employee_access_contacts (
  employee_id uuid primary key references public.profiles(id) on delete cascade,
  personal_email text not null,
  work_email text,
  work_email_assigned_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint employee_access_contacts_personal_email_format
    check (lower(personal_email) ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  constraint employee_access_contacts_work_email_format
    check (
      work_email is null
      or lower(work_email) ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    )
);

create unique index if not exists employee_access_contacts_personal_email_uidx
  on public.employee_access_contacts (lower(personal_email));

create unique index if not exists employee_access_contacts_work_email_uidx
  on public.employee_access_contacts (lower(work_email))
  where work_email is not null;

alter table public.employee_access_contacts enable row level security;

revoke all on table public.employee_access_contacts from anon;
revoke insert, update, delete on table public.employee_access_contacts from authenticated;
grant select on table public.employee_access_contacts to authenticated;

drop policy if exists employee_access_contacts_select_admin on public.employee_access_contacts;
create policy employee_access_contacts_select_admin
on public.employee_access_contacts
for select
to authenticated
using (
  (select private.current_app_role()) = 'super_admin'
  and (select private.can_access_employee(employee_id))
);

insert into public.employee_access_contacts (
  employee_id,
  personal_email,
  work_email,
  work_email_assigned_at,
  updated_by
)
select
  p.id,
  lower(p.email),
  case
    when lower(p.email) ~ '^[^@[:space:]]+@emarketselect[.]com$'
      then lower(p.email)
    else null
  end,
  case
    when lower(p.email) ~ '^[^@[:space:]]+@emarketselect[.]com$'
      then p.auth_activated_at
    else null
  end,
  p.created_by
from public.profiles p
on conflict (employee_id) do nothing;

comment on table public.employee_access_contacts is
  'Restricted employee onboarding/recovery contact data and assigned work login email.';
comment on column public.profiles.email is
  'Current Supabase Auth login email. Change linked identities only through the trusted System access workflow.';

create or replace function public.service_get_resend_api_key()
returns text
language sql
security definer
set search_path = pg_catalog, public, vault
as $$
  select ds.decrypted_secret
  from vault.decrypted_secrets ds
  where ds.name = 'ems_resend_api_key'
  order by ds.created_at desc
  limit 1
$$;

revoke all on function public.service_get_resend_api_key()
from public, anon, authenticated;
grant execute on function public.service_get_resend_api_key()
to service_role;

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
  if current_user <> 'service_role' then
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
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_actor_test boolean;
  v_employee_id uuid := gen_random_uuid();
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  v_actor := private.current_profile_id();

  select is_test_account
  into v_actor_test
  from public.profiles
  where id = v_actor;

  if v_actor is null or v_actor_test is null then
    raise exception 'Active Super Admin profile required.';
  end if;

  if p_is_test_account is distinct from v_actor_test then
    raise exception 'Employee must be created in the current EMS environment.';
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
      where manager.id = p_manager_id
        and manager.is_active
        and manager.employment_status <> 'deactivated'
        and manager.role in ('manager','director','super_admin')
        and manager.is_test_account = v_actor_test
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
    id, employee_code, email, full_name, job_title, department_id,
    employment_type, role, employment_status, timezone, hire_date,
    is_active, created_by, is_test_account
  )
  values (
    v_employee_id, upper(btrim(p_employee_code)), lower(btrim(p_email)),
    btrim(p_full_name), btrim(p_job_title), p_department_id,
    p_employment_type, p_role, 'active',
    coalesce(nullif(btrim(p_timezone), ''), 'Asia/Karachi'),
    p_hire_date, true, v_actor, p_is_test_account
  );

  insert into public.employee_access_contacts (
    employee_id, personal_email, work_email, work_email_assigned_at, updated_by
  )
  values (
    v_employee_id,
    lower(btrim(p_email)),
    case
      when lower(btrim(p_email)) ~ '^[^@[:space:]]+@emarketselect[.]com$'
        then lower(btrim(p_email))
      else null
    end,
    case
      when lower(btrim(p_email)) ~ '^[^@[:space:]]+@emarketselect[.]com$'
        then now()
      else null
    end,
    v_actor
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
    v_actor, 'employee_created', 'profile', v_employee_id::text,
    to_jsonb(p), 'Employee created through EMS'
  from public.profiles p
  where p.id = v_employee_id;

  return v_employee_id;
end;
$$;

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
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_employee_id uuid;
  v_actor uuid;
  v_personal text := lower(btrim(coalesce(p_personal_email, p_email)));
  v_work text := nullif(lower(btrim(coalesce(p_work_email, ''))), '');
begin
  if v_personal !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid personal/setup email.';
  end if;

  if v_work is not null and v_work <> lower(btrim(p_email)) then
    raise exception 'Work email must match the login email when supplied at creation.';
  end if;

  if not p_is_test_account and v_work is null then
    raise exception 'Production employees require a work email at creation.';
  end if;

  if not p_is_test_account
     and v_work !~ '^[^@[:space:]]+@emarketselect[.]com$' then
    raise exception 'Production work email must use @emarketselect.com.';
  end if;

  if exists (
    select 1
    from public.employee_access_contacts c
    where lower(c.personal_email) = v_personal
  ) then
    raise exception 'Personal/setup email is already assigned to another employee.';
  end if;

  v_employee_id := public.admin_create_employee(
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
    p_is_test_account
  );

  v_actor := private.current_profile_id();

  update public.employee_access_contacts
  set personal_email = v_personal,
      work_email = v_work,
      work_email_assigned_at = case when v_work is not null then now() else null end,
      updated_at = now(),
      updated_by = v_actor
  where employee_id = v_employee_id;

  return v_employee_id;
end;
$$;

revoke all on function public.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) from public, anon;
grant execute on function public.admin_create_employee(
  text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, boolean, text, text
) to authenticated;

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
  p_deactivation_reason text default null
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
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

    if private.reporting_path_exists(p_employee_id, p_manager_id) then
      raise exception 'Reporting hierarchy would create a cycle.';
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
      when p_employment_status = 'deactivated' then coalesce(v_before.deactivated_at, now())
      else null
    end,
    deactivation_reason = case
      when p_employment_status = 'deactivated' then btrim(p_deactivation_reason)
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
      p_employee_id, v_before.employment_status, v_after.employment_status,
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
        delete from public.reporting_lines where id = v_current_manager.id;
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
        delete from public.reporting_lines where id = v_current_manager.id;
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
        delete from public.schedule_assignments where id = v_current_schedule.id;
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
        delete from public.schedule_assignments where id = v_current_schedule.id;
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
    v_actor, 'employee_updated', 'profile', p_employee_id::text,
    to_jsonb(v_before), to_jsonb(v_after), 'Employee updated through EMS'
  );
end;
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
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_personal text := lower(btrim(coalesce(p_personal_email, '')));
begin
  if v_personal = ''
     or v_personal !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'Enter a valid personal/recovery email.';
  end if;

  if exists (
    select 1
    from public.employee_access_contacts c
    where c.employee_id <> p_employee_id
      and lower(c.personal_email) = v_personal
  ) then
    raise exception 'Personal/recovery email is already assigned to another employee.';
  end if;

  perform public.admin_update_employee(
    p_employee_id, p_employee_code, p_email, p_full_name, p_job_title,
    p_department_id, p_employment_type, p_role, p_timezone, p_hire_date,
    p_manager_id, p_schedule_id, p_employment_status, p_deactivation_reason
  );

  v_actor := private.current_profile_id();

  update public.employee_access_contacts
  set personal_email = v_personal,
      updated_at = now(),
      updated_by = v_actor
  where employee_id = p_employee_id;
end;
$$;

revoke all on function public.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) from public, anon;
grant execute on function public.admin_update_employee(
  uuid, text, text, text, text, uuid, public.employment_type, public.app_role,
  text, date, uuid, uuid, public.employment_status, text, text
) to authenticated;
