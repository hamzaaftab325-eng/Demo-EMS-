create or replace function public.phase8_update_company_settings(
  p_company_name text,
  p_timezone text,
  p_default_schedule_id uuid,
  p_default_daily_target_minutes integer,
  p_grace_period_minutes integer,
  p_heartbeat_interval_seconds integer,
  p_presence_idle_minutes integer,
  p_presence_away_minutes integer,
  p_heartbeat_stale_minutes integer,
  p_auto_signoff_idle_minutes integer,
  p_require_scrum_for_signin boolean,
  p_require_scrum_for_signoff boolean,
  p_require_final_request_approval boolean,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_actor uuid;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  if nullif(btrim(coalesce(p_company_name, '')), '') is null then
    raise exception 'Company name is required.';
  end if;

  if not exists (
    select 1 from pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'Enter a valid IANA timezone.';
  end if;

  if p_default_schedule_id is not null
     and not exists (
       select 1
       from public.work_schedules ws
       where ws.id = p_default_schedule_id
         and ws.is_active
         and not exists (
           select 1
           from public.schedule_change_details scd
           where scd.applied_schedule_id = ws.id
         )
     ) then
    raise exception 'Default schedule must be an active standard schedule.';
  end if;

  if p_default_daily_target_minutes < 1
     or p_default_daily_target_minutes > 1440 then
    raise exception 'Default daily target must be between 1 and 1440 minutes.';
  end if;

  if p_grace_period_minutes < 0 or p_grace_period_minutes > 240 then
    raise exception 'Grace period must be between 0 and 240 minutes.';
  end if;

  if p_heartbeat_interval_seconds < 30
     or p_heartbeat_interval_seconds > 300 then
    raise exception 'Heartbeat interval must be between 30 and 300 seconds.';
  end if;

  if p_presence_idle_minutes < 1 or p_presence_idle_minutes > 120 then
    raise exception 'Idle threshold must be between 1 and 120 minutes.';
  end if;

  if p_presence_away_minutes <= p_presence_idle_minutes
     or p_presence_away_minutes > 480 then
    raise exception 'Away threshold must be greater than idle and at most 480 minutes.';
  end if;

  if p_heartbeat_stale_minutes < 2 or p_heartbeat_stale_minutes > 30 then
    raise exception 'Heartbeat stale threshold must be between 2 and 30 minutes.';
  end if;

  if p_heartbeat_stale_minutes * 60 <= p_heartbeat_interval_seconds then
    raise exception 'Heartbeat stale threshold must exceed the heartbeat interval.';
  end if;

  if p_auto_signoff_idle_minutes < 15
     or p_auto_signoff_idle_minutes > 1440
     or p_auto_signoff_idle_minutes <= p_presence_away_minutes then
    raise exception 'Auto sign-off must be greater than the away threshold and at most 1440 minutes.';
  end if;

  perform set_config(
    'app.phase8_reason',
    coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Company settings updated'),
    true
  );

  begin
    update public.company_settings
    set company_name = btrim(p_company_name),
        timezone = p_timezone,
        default_schedule_id = p_default_schedule_id,
        default_daily_target_minutes = p_default_daily_target_minutes,
        grace_period_minutes = p_grace_period_minutes,
        heartbeat_interval_seconds = p_heartbeat_interval_seconds,
        presence_idle_minutes = p_presence_idle_minutes,
        presence_away_minutes = p_presence_away_minutes,
        heartbeat_stale_minutes = p_heartbeat_stale_minutes,
        auto_signoff_idle_minutes = p_auto_signoff_idle_minutes,
        require_scrum_for_signin = p_require_scrum_for_signin,
        require_scrum_for_signoff = p_require_scrum_for_signoff,
        require_final_request_approval = p_require_final_request_approval,
        updated_by = v_actor
    where id = 1;

    if not found then
      raise exception 'Company settings row is missing.';
    end if;

    perform set_config('app.phase8_reason', '', true);
  exception when others then
    perform set_config('app.phase8_reason', '', true);
    raise;
  end;
end;
$function$;

create or replace function public.phase8_save_schedule(
  p_schedule_id uuid,
  p_name text,
  p_schedule_type public.schedule_type,
  p_daily_target_minutes integer,
  p_start_time time,
  p_end_time time,
  p_core_start_time time,
  p_core_end_time time,
  p_grace_minutes integer,
  p_timezone text,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_id uuid;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Schedule name is required.';
  end if;

  if not exists (
    select 1 from pg_timezone_names where name = p_timezone
  ) then
    raise exception 'Enter a valid IANA timezone.';
  end if;

  if p_daily_target_minutes < 1 or p_daily_target_minutes > 1440 then
    raise exception 'Daily target must be between 1 and 1440 minutes.';
  end if;

  if p_grace_minutes < 0 or p_grace_minutes > 240 then
    raise exception 'Grace must be between 0 and 240 minutes.';
  end if;

  if p_schedule_type = 'fixed' then
    if p_start_time is null or p_end_time is null or p_start_time = p_end_time then
      raise exception 'Fixed schedules require different start and end times.';
    end if;
  elsif p_schedule_type = 'flexible_core' then
    if p_core_start_time is null
       or p_core_end_time is null
       or p_core_start_time = p_core_end_time then
      raise exception 'Flexible-core schedules require different core start and end times.';
    end if;
  end if;

  if p_schedule_id is not null
     and exists (
       select 1 from public.schedule_change_details scd
       where scd.applied_schedule_id = p_schedule_id
     ) then
    raise exception 'Request-generated schedules are historical workflow records and cannot be edited here.';
  end if;

  perform set_config(
    'app.phase8_reason',
    coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      case when p_schedule_id is null
        then 'Work schedule created'
        else 'Work schedule updated'
      end
    ),
    true
  );

  begin
    if p_schedule_id is null then
      insert into public.work_schedules(
        name,
        schedule_type,
        daily_target_minutes,
        start_time,
        end_time,
        core_start_time,
        core_end_time,
        grace_minutes,
        timezone,
        is_active
      )
      values(
        btrim(p_name),
        p_schedule_type,
        p_daily_target_minutes,
        case when p_schedule_type = 'fixed' then p_start_time else null end,
        case when p_schedule_type = 'fixed' then p_end_time else null end,
        case when p_schedule_type = 'flexible_core' then p_core_start_time else null end,
        case when p_schedule_type = 'flexible_core' then p_core_end_time else null end,
        p_grace_minutes,
        p_timezone,
        true
      )
      returning id into v_id;
    else
      update public.work_schedules
      set name = btrim(p_name),
          schedule_type = p_schedule_type,
          daily_target_minutes = p_daily_target_minutes,
          start_time = case when p_schedule_type = 'fixed' then p_start_time else null end,
          end_time = case when p_schedule_type = 'fixed' then p_end_time else null end,
          core_start_time = case when p_schedule_type = 'flexible_core' then p_core_start_time else null end,
          core_end_time = case when p_schedule_type = 'flexible_core' then p_core_end_time else null end,
          grace_minutes = p_grace_minutes,
          timezone = p_timezone
      where id = p_schedule_id
      returning id into v_id;

      if v_id is null then
        raise exception 'Schedule not found.';
      end if;
    end if;

    perform set_config('app.phase8_reason', '', true);
  exception when others then
    perform set_config('app.phase8_reason', '', true);
    raise;
  end;

  return v_id;
end;
$function$;

create or replace function public.phase8_set_schedule_active(
  p_schedule_id uuid,
  p_is_active boolean,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_schedule public.work_schedules%rowtype;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  select * into v_schedule
  from public.work_schedules
  where id = p_schedule_id
  for update;

  if not found then
    raise exception 'Schedule not found.';
  end if;

  if exists (
    select 1 from public.schedule_change_details scd
    where scd.applied_schedule_id = p_schedule_id
  ) then
    raise exception 'Request-generated schedules are controlled by the request workflow.';
  end if;

  if not p_is_active
     and exists (
       select 1 from public.company_settings cs
       where cs.id = 1 and cs.default_schedule_id = p_schedule_id
     ) then
    raise exception 'Choose another default schedule before deactivating this one.';
  end if;

  if v_schedule.is_active = p_is_active then
    return;
  end if;

  perform set_config(
    'app.phase8_reason',
    coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      case when p_is_active then 'Work schedule activated'
           else 'Work schedule deactivated' end
    ),
    true
  );

  begin
    update public.work_schedules
    set is_active = p_is_active
    where id = p_schedule_id;

    perform set_config('app.phase8_reason', '', true);
  exception when others then
    perform set_config('app.phase8_reason', '', true);
    raise;
  end;
end;
$function$;

create or replace function public.phase8_save_holiday(
  p_holiday_id uuid,
  p_name text,
  p_holiday_date date,
  p_country_code text,
  p_is_company_wide boolean,
  p_department_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_id uuid;
  v_today date;
  v_timezone text;
  v_existing public.holidays%rowtype;
  v_department uuid;
  v_country text;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Holiday name is required.';
  end if;

  select timezone into v_timezone
  from public.company_settings
  where id = 1;

  v_today := (now() at time zone coalesce(v_timezone, 'Asia/Karachi'))::date;

  if p_holiday_date is null then
    raise exception 'Holiday date is required.';
  end if;

  if p_holiday_id is null and p_holiday_date < v_today then
    raise exception 'New holidays cannot be added in the past.';
  end if;

  v_country := nullif(upper(btrim(coalesce(p_country_code, ''))), '');

  if v_country is not null and v_country !~ '^[A-Z]{2}$' then
    raise exception 'Country code must be two letters.';
  end if;

  if p_is_company_wide then
    v_department := null;
  else
    v_department := p_department_id;

    if v_department is null
       or not exists (
         select 1 from public.departments d
         where d.id = v_department and d.is_active
       ) then
      raise exception 'Select an active department for a department holiday.';
    end if;
  end if;

  if p_holiday_id is not null then
    select * into v_existing
    from public.holidays
    where id = p_holiday_id
    for update;

    if not found then
      raise exception 'Holiday not found.';
    end if;

    if v_existing.holiday_date < v_today
       and (
         v_existing.holiday_date is distinct from p_holiday_date
         or v_existing.is_company_wide is distinct from p_is_company_wide
         or v_existing.department_id is distinct from v_department
       ) then
      raise exception 'Past holiday date and scope cannot be changed.';
    end if;

    if p_holiday_date < v_today
       and v_existing.holiday_date is distinct from p_holiday_date then
      raise exception 'Holiday date cannot be moved into the past.';
    end if;
  end if;

  perform set_config(
    'app.phase8_reason',
    coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      case when p_holiday_id is null
        then 'Holiday created'
        else 'Holiday updated'
      end
    ),
    true
  );

  begin
    if p_holiday_id is null then
      insert into public.holidays(
        name,
        holiday_date,
        country_code,
        department_id,
        is_company_wide,
        created_by
      )
      values(
        btrim(p_name),
        p_holiday_date,
        v_country,
        v_department,
        p_is_company_wide,
        private.current_profile_id()
      )
      returning id into v_id;
    else
      update public.holidays
      set name = btrim(p_name),
          holiday_date = p_holiday_date,
          country_code = v_country,
          department_id = v_department,
          is_company_wide = p_is_company_wide
      where id = p_holiday_id
      returning id into v_id;
    end if;

    perform set_config('app.phase8_reason', '', true);
  exception when others then
    perform set_config('app.phase8_reason', '', true);
    raise;
  end;

  return v_id;
end;
$function$;

create or replace function public.phase8_delete_holiday(
  p_holiday_id uuid,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_holiday public.holidays%rowtype;
  v_today date;
  v_timezone text;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  select * into v_holiday
  from public.holidays
  where id = p_holiday_id
  for update;

  if not found then
    raise exception 'Holiday not found.';
  end if;

  select timezone into v_timezone
  from public.company_settings
  where id = 1;

  v_today := (now() at time zone coalesce(v_timezone, 'Asia/Karachi'))::date;

  if v_holiday.holiday_date < v_today then
    raise exception 'Past holidays are retained for attendance history and cannot be deleted.';
  end if;

  perform set_config(
    'app.phase8_reason',
    coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      'Future holiday deleted'
    ),
    true
  );

  begin
    delete from public.holidays
    where id = p_holiday_id;

    perform set_config('app.phase8_reason', '', true);
  exception when others then
    perform set_config('app.phase8_reason', '', true);
    raise;
  end;
end;
$function$;

create or replace function public.phase8_save_leave_type(
  p_leave_type_id uuid,
  p_code text,
  p_name text,
  p_is_paid boolean,
  p_requires_reason boolean,
  p_default_annual_days numeric,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_id uuid;
  v_code text;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  v_code := lower(btrim(coalesce(p_code, '')));

  if v_code !~ '^[a-z0-9][a-z0-9_-]{1,31}$' then
    raise exception 'Leave code must be 2–32 lowercase letters, numbers, dashes or underscores.';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Leave type name is required.';
  end if;

  if p_default_annual_days is not null
     and (p_default_annual_days < 0 or p_default_annual_days > 366) then
    raise exception 'Annual entitlement must be between 0 and 366 days.';
  end if;

  perform set_config(
    'app.phase8_reason',
    coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      case when p_leave_type_id is null
        then 'Leave type created'
        else 'Leave type updated'
      end
    ),
    true
  );

  begin
    if p_leave_type_id is null then
      insert into public.leave_types(
        code,
        name,
        is_paid,
        requires_reason,
        requires_attachment,
        default_annual_days,
        is_active
      )
      values(
        v_code,
        btrim(p_name),
        p_is_paid,
        p_requires_reason,
        false,
        p_default_annual_days,
        true
      )
      returning id into v_id;
    else
      update public.leave_types
      set code = v_code,
          name = btrim(p_name),
          is_paid = p_is_paid,
          requires_reason = p_requires_reason,
          default_annual_days = p_default_annual_days
      where id = p_leave_type_id
      returning id into v_id;

      if v_id is null then
        raise exception 'Leave type not found.';
      end if;
    end if;

    perform set_config('app.phase8_reason', '', true);
  exception when others then
    perform set_config('app.phase8_reason', '', true);
    raise;
  end;

  return v_id;
end;
$function$;

create or replace function public.phase8_set_leave_type_active(
  p_leave_type_id uuid,
  p_is_active boolean,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_leave public.leave_types%rowtype;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  select * into v_leave
  from public.leave_types
  where id = p_leave_type_id
  for update;

  if not found then
    raise exception 'Leave type not found.';
  end if;

  if v_leave.is_active = p_is_active then
    return;
  end if;

  if not p_is_active
     and (
       select count(*)
       from public.leave_types
       where is_active
     ) <= 1 then
    raise exception 'At least one active leave type is required.';
  end if;

  perform set_config(
    'app.phase8_reason',
    coalesce(
      nullif(btrim(coalesce(p_reason, '')), ''),
      case when p_is_active then 'Leave type activated'
           else 'Leave type deactivated' end
    ),
    true
  );

  begin
    update public.leave_types
    set is_active = p_is_active
    where id = p_leave_type_id;

    perform set_config('app.phase8_reason', '', true);
  exception when others then
    perform set_config('app.phase8_reason', '', true);
    raise;
  end;
end;
$function$;

create or replace function public.phase8_audit_search(
  p_query text default null,
  p_action text default null,
  p_entity_type text default null,
  p_actor_id uuid default null,
  p_from_date date default null,
  p_to_date date default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_timezone text;
  v_result jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  select coalesce(nullif(p.timezone, ''), 'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = private.current_profile_id();

  with filtered as (
    select
      al.id,
      al.actor_id,
      p.full_name as actor_name,
      p.employee_code as actor_code,
      al.action,
      al.entity_type,
      al.entity_id,
      al.before_data,
      al.after_data,
      al.reason,
      al.created_at
    from public.audit_logs al
    left join public.profiles p on p.id = al.actor_id
    where
      (nullif(btrim(coalesce(p_action, '')), '') is null
        or al.action = btrim(p_action))
      and
      (nullif(btrim(coalesce(p_entity_type, '')), '') is null
        or al.entity_type = btrim(p_entity_type))
      and
      (p_actor_id is null or al.actor_id = p_actor_id)
      and
      (
        p_from_date is null
        or al.created_at >=
          (p_from_date::timestamp at time zone v_timezone)
      )
      and
      (
        p_to_date is null
        or al.created_at <
          ((p_to_date + 1)::timestamp at time zone v_timezone)
      )
      and
      (
        nullif(btrim(coalesce(p_query, '')), '') is null
        or al.action ilike '%' || btrim(p_query) || '%'
        or al.entity_type ilike '%' || btrim(p_query) || '%'
        or coalesce(al.entity_id, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(al.reason, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(p.full_name, '') ilike '%' || btrim(p_query) || '%'
        or coalesce(p.employee_code, '') ilike '%' || btrim(p_query) || '%'
      )
  ),
  paged as (
    select *
    from filtered
    order by created_at desc, id desc
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce(
      (
        select jsonb_agg(to_jsonb(paged) order by created_at desc, id desc)
        from paged
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$function$;

revoke all on function public.phase8_update_company_settings(
  text,text,uuid,integer,integer,integer,integer,integer,integer,integer,
  boolean,boolean,boolean,text
) from public, anon;
grant execute on function public.phase8_update_company_settings(
  text,text,uuid,integer,integer,integer,integer,integer,integer,integer,
  boolean,boolean,boolean,text
) to authenticated;

revoke all on function public.phase8_save_schedule(
  uuid,text,public.schedule_type,integer,time,time,time,time,integer,text,text
) from public, anon;
grant execute on function public.phase8_save_schedule(
  uuid,text,public.schedule_type,integer,time,time,time,time,integer,text,text
) to authenticated;

revoke all on function public.phase8_set_schedule_active(uuid,boolean,text)
from public, anon;
grant execute on function public.phase8_set_schedule_active(uuid,boolean,text)
to authenticated;

revoke all on function public.phase8_save_holiday(
  uuid,text,date,text,boolean,uuid,text
) from public, anon;
grant execute on function public.phase8_save_holiday(
  uuid,text,date,text,boolean,uuid,text
) to authenticated;

revoke all on function public.phase8_delete_holiday(uuid,text)
from public, anon;
grant execute on function public.phase8_delete_holiday(uuid,text)
to authenticated;

revoke all on function public.phase8_save_leave_type(
  uuid,text,text,boolean,boolean,numeric,text
) from public, anon;
grant execute on function public.phase8_save_leave_type(
  uuid,text,text,boolean,boolean,numeric,text
) to authenticated;

revoke all on function public.phase8_set_leave_type_active(uuid,boolean,text)
from public, anon;
grant execute on function public.phase8_set_leave_type_active(uuid,boolean,text)
to authenticated;

revoke all on function public.phase8_audit_search(
  text,text,text,uuid,date,date,integer,integer
) from public, anon;
grant execute on function public.phase8_audit_search(
  text,text,text,uuid,date,date,integer,integer
) to authenticated;

