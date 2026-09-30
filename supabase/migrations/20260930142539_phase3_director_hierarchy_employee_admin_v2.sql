alter type public.app_role add value if not exists 'director' before 'super_admin';

alter table public.profiles
  drop constraint if exists profiles_allowed_email;

alter table public.profiles
  add constraint profiles_allowed_email
  check (
    lower(email) ~ '^[^@[:space:]]+@emarketselect[.]com$'
    or (
      is_test_account
      and lower(email) ~ '^[^@[:space:]]+@example[.]test$'
    )
  );

create or replace function private.prevent_reporting_cycle()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  cycle_found boolean;
begin
  if new.employee_id = new.manager_id then
    raise exception 'An employee cannot report to themselves.';
  end if;

  if new.is_primary and new.effective_to is null then
    with recursive descendants(employee_id) as (
      select rl.employee_id
      from public.reporting_lines rl
      where rl.manager_id = new.employee_id
        and rl.is_primary
        and rl.effective_to is null
        and rl.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      union
      select rl.employee_id
      from public.reporting_lines rl
      join descendants d on rl.manager_id = d.employee_id
      where rl.is_primary
        and rl.effective_to is null
        and rl.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    select exists (
      select 1 from descendants where employee_id = new.manager_id
    )
    into cycle_found;

    if cycle_found then
      raise exception 'Reporting line would create a management cycle.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_reporting_cycle() from public, anon, authenticated;

drop trigger if exists reporting_lines_prevent_cycle on public.reporting_lines;
create trigger reporting_lines_prevent_cycle
before insert or update of employee_id, manager_id, is_primary, effective_from, effective_to
on public.reporting_lines
for each row execute function private.prevent_reporting_cycle();

drop policy if exists audit_logs_insert_super on public.audit_logs;
create policy audit_logs_insert_super
on public.audit_logs
for insert
to authenticated
with check ((select private.is_super_admin()));

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
  v_employee_id uuid;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Super Admin access required.';
  end if;

  v_actor := (select private.current_profile_id());

  insert into public.profiles (
    employee_code,email,full_name,job_title,department_id,employment_type,role,
    employment_status,timezone,hire_date,is_active,created_by,is_test_account
  )
  values (
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
  )
  returning id into v_employee_id;

  insert into public.employee_status_history (
    employee_id,old_status,new_status,reason,changed_by
  )
  values (
    v_employee_id,null,'active','Employee profile created',v_actor
  );

  if p_manager_id is not null then
    insert into public.reporting_lines (
      employee_id,manager_id,effective_from,is_primary,created_by
    )
    values (
      v_employee_id,p_manager_id,current_date,true,v_actor
    );
  end if;

  if p_schedule_id is not null then
    insert into public.schedule_assignments (
      employee_id,schedule_id,effective_from,assigned_by
    )
    values (
      v_employee_id,p_schedule_id,current_date,v_actor
    );
  end if;

  insert into public.audit_logs (
    actor_id,action,entity_type,entity_id,after_data,reason
  )
  select
    v_actor,
    'employee_created',
    'profile',
    v_employee_id::text,
    to_jsonb(p),
    'Employee created through EMS'
  from public.profiles p
  where p.id=v_employee_id;

  return v_employee_id;
end;
$$;

revoke all on function public.admin_create_employee(
  text,text,text,text,uuid,public.employment_type,public.app_role,text,date,uuid,uuid,boolean
) from public, anon;
grant execute on function public.admin_create_employee(
  text,text,text,text,uuid,public.employment_type,public.app_role,text,date,uuid,uuid,boolean
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
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_current_manager public.reporting_lines%rowtype;
  v_current_schedule public.schedule_assignments%rowtype;
begin
  if not (select private.is_super_admin()) then
    raise exception 'Super Admin access required.';
  end if;

  v_actor := (select private.current_profile_id());

  select * into v_before
  from public.profiles
  where id=p_employee_id
  for update;

  if not found then
    raise exception 'Employee not found.';
  end if;

  if p_employee_id=v_actor and p_employment_status='deactivated' then
    raise exception 'You cannot deactivate your own account.';
  end if;

  if p_employment_status='deactivated'
     and nullif(btrim(coalesce(p_deactivation_reason,'')),'') is null then
    raise exception 'A deactivation reason is required.';
  end if;

  update public.profiles
  set
    employee_code=upper(btrim(p_employee_code)),
    email=lower(btrim(p_email)),
    full_name=btrim(p_full_name),
    job_title=btrim(p_job_title),
    department_id=p_department_id,
    employment_type=p_employment_type,
    role=p_role,
    employment_status=p_employment_status,
    timezone=coalesce(nullif(btrim(p_timezone),''),'Asia/Karachi'),
    hire_date=p_hire_date,
    is_active=(p_employment_status <> 'deactivated'),
    deactivated_at=case
      when p_employment_status='deactivated' then coalesce(v_before.deactivated_at,now())
      else null
    end,
    deactivation_reason=case
      when p_employment_status='deactivated' then btrim(p_deactivation_reason)
      else null
    end,
    updated_at=now()
  where id=p_employee_id
  returning * into v_after;

  if v_before.employment_status is distinct from v_after.employment_status then
    insert into public.employee_status_history (
      employee_id,old_status,new_status,reason,changed_by
    )
    values (
      p_employee_id,
      v_before.employment_status,
      v_after.employment_status,
      case
        when v_after.employment_status='deactivated'
          then v_after.deactivation_reason
        else 'Employment status changed'
      end,
      v_actor
    );
  end if;

  select * into v_current_manager
  from public.reporting_lines
  where employee_id=p_employee_id
    and is_primary
    and effective_to is null
  order by effective_from desc,created_at desc
  limit 1
  for update;

  if p_manager_id is null then
    if v_current_manager.id is not null then
      if v_current_manager.effective_from < current_date then
        update public.reporting_lines
        set effective_to=current_date - 1
        where id=v_current_manager.id;
      else
        delete from public.reporting_lines where id=v_current_manager.id;
      end if;
    end if;
  elsif v_current_manager.id is null
     or v_current_manager.manager_id is distinct from p_manager_id then
    if v_current_manager.id is not null then
      if v_current_manager.effective_from < current_date then
        update public.reporting_lines
        set effective_to=current_date - 1
        where id=v_current_manager.id;
      else
        delete from public.reporting_lines where id=v_current_manager.id;
      end if;
    end if;

    insert into public.reporting_lines (
      employee_id,manager_id,effective_from,is_primary,created_by
    )
    values (
      p_employee_id,p_manager_id,current_date,true,v_actor
    );
  end if;

  select * into v_current_schedule
  from public.schedule_assignments
  where employee_id=p_employee_id
    and effective_to is null
  order by effective_from desc,created_at desc
  limit 1
  for update;

  if p_schedule_id is null then
    if v_current_schedule.id is not null then
      if v_current_schedule.effective_from < current_date then
        update public.schedule_assignments
        set effective_to=current_date - 1
        where id=v_current_schedule.id;
      else
        delete from public.schedule_assignments where id=v_current_schedule.id;
      end if;
    end if;
  elsif v_current_schedule.id is null
     or v_current_schedule.schedule_id is distinct from p_schedule_id then
    if v_current_schedule.id is not null then
      if v_current_schedule.effective_from < current_date then
        update public.schedule_assignments
        set effective_to=current_date - 1
        where id=v_current_schedule.id;
      else
        delete from public.schedule_assignments where id=v_current_schedule.id;
      end if;
    end if;

    insert into public.schedule_assignments (
      employee_id,schedule_id,effective_from,assigned_by
    )
    values (
      p_employee_id,p_schedule_id,current_date,v_actor
    );
  end if;

  insert into public.audit_logs (
    actor_id,action,entity_type,entity_id,before_data,after_data,reason
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
$$;

revoke all on function public.admin_update_employee(
  uuid,text,text,text,text,uuid,public.employment_type,public.app_role,text,date,uuid,uuid,public.employment_status,text
) from public, anon;
grant execute on function public.admin_update_employee(
  uuid,text,text,text,text,uuid,public.employment_type,public.app_role,text,date,uuid,uuid,public.employment_status,text
) to authenticated;
