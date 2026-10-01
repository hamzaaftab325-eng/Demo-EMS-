-- Phase 5 completion hardening.
-- Fixes attendance correction authorization, presence day rollover,
-- and historical correction invariants without changing the Phase 5 data model.

drop policy if exists workdays_insert_own on public.workdays;
drop policy if exists workdays_insert_own_or_super on public.workdays;
create policy workdays_insert_own_or_super
on public.workdays
for insert
to authenticated
with check (
  employee_id = (select private.current_profile_id())
  or (select private.is_super_admin())
);

drop policy if exists attendance_events_insert_own on public.attendance_events;
drop policy if exists attendance_events_insert_own_or_super on public.attendance_events;
create policy attendance_events_insert_own_or_super
on public.attendance_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workdays w
    where w.id = attendance_events.workday_id
      and (
        w.employee_id = (select private.current_profile_id())
        or (select private.is_super_admin())
      )
  )
);

create or replace function public.attendance_correct_day(
  p_employee_id uuid,
  p_work_date date,
  p_first_sign_in_at timestamptz default null,
  p_final_sign_off_at timestamptz default null,
  p_break_minutes integer default null,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_actor uuid;
  v_workday_id uuid;
  v_schedule_id uuid;
  v_timezone text;
  v_local_today date;
  v_before jsonb;
  v_old_first timestamptz;
  v_old_final timestamptz;
  v_old_break integer;
  v_effective_first timestamptz;
  v_effective_final timestamptz;
begin
  perform set_config('app.phase4_workflow', 'on', true);

  if not (select private.is_super_admin()) then
    raise exception 'Super Admin access required.';
  end if;

  if nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'A correction reason is required.';
  end if;

  if p_break_minutes is not null and p_break_minutes < 0 then
    raise exception 'Break minutes cannot be negative.';
  end if;

  if p_first_sign_in_at is null
     and p_final_sign_off_at is null
     and p_break_minutes is null then
    raise exception 'Provide at least one corrected attendance value.';
  end if;

  v_actor := (select private.current_profile_id());

  select p.timezone
  into v_timezone
  from public.profiles p
  where p.id = p_employee_id
    and p.is_active
    and p.employment_status <> 'deactivated'
    and private.same_profile_environment(p.id);

  if v_timezone is null then
    raise exception 'Employee not found.';
  end if;

  v_timezone := coalesce(nullif(v_timezone,''),'Asia/Karachi');
  v_local_today := (now() at time zone v_timezone)::date;

  if p_work_date > v_local_today then
    raise exception 'Attendance cannot be corrected for a future date.';
  end if;

  select sa.schedule_id
  into v_schedule_id
  from public.schedule_assignments sa
  where sa.employee_id = p_employee_id
    and sa.effective_from <= p_work_date
    and (sa.effective_to is null or sa.effective_to >= p_work_date)
  order by sa.effective_from desc, sa.created_at desc
  limit 1;

  if v_schedule_id is null then
    select default_schedule_id
    into v_schedule_id
    from public.company_settings
    where id = 1;
  end if;

  select
    w.id,
    w.first_sign_in_at,
    w.final_sign_off_at,
    w.break_minutes,
    to_jsonb(w)
  into
    v_workday_id,
    v_old_first,
    v_old_final,
    v_old_break,
    v_before
  from public.workdays w
  where w.employee_id = p_employee_id
    and w.work_date = p_work_date
  for update;

  if v_workday_id is null then
    if p_first_sign_in_at is null then
      raise exception 'Provide a first sign-in time when creating a missing attendance record.';
    end if;

    if p_work_date < v_local_today and p_final_sign_off_at is null then
      raise exception 'Historical attendance creation requires a final sign-off time.';
    end if;

    if p_work_date = v_local_today and exists (
      select 1
      from public.workdays w
      where w.employee_id = p_employee_id
        and w.status in ('working','on_break','in_meeting')
    ) then
      raise exception 'Employee already has an open workday.';
    end if;

    insert into public.workdays(
      employee_id,
      work_date,
      schedule_id,
      timezone,
      status,
      closed_at
    )
    values(
      p_employee_id,
      p_work_date,
      v_schedule_id,
      v_timezone,
      case
        when p_final_sign_off_at is not null then 'signed_off'::public.workday_status
        else 'working'::public.workday_status
      end,
      p_final_sign_off_at
    )
    returning id into v_workday_id;

    select
      w.first_sign_in_at,
      w.final_sign_off_at,
      w.break_minutes,
      to_jsonb(w)
    into
      v_old_first,
      v_old_final,
      v_old_break,
      v_before
    from public.workdays w
    where w.id = v_workday_id;
  end if;

  v_effective_first := coalesce(p_first_sign_in_at, v_old_first);
  v_effective_final := coalesce(p_final_sign_off_at, v_old_final);

  if v_effective_first is not null
     and v_effective_final is not null
     and v_effective_final < v_effective_first then
    raise exception 'Final sign-off time cannot be earlier than first sign-in time.';
  end if;

  if p_first_sign_in_at is not null then
    insert into public.attendance_corrections(
      workday_id,
      field_name,
      old_value,
      new_value,
      reason,
      requested_by,
      approved_by,
      approved_at
    )
    values(
      v_workday_id,
      'first_sign_in_at',
      to_jsonb(v_old_first),
      to_jsonb(p_first_sign_in_at),
      btrim(p_reason),
      v_actor,
      v_actor,
      now()
    );
  end if;

  if p_final_sign_off_at is not null then
    insert into public.attendance_corrections(
      workday_id,
      field_name,
      old_value,
      new_value,
      reason,
      requested_by,
      approved_by,
      approved_at
    )
    values(
      v_workday_id,
      'final_sign_off_at',
      to_jsonb(v_old_final),
      to_jsonb(p_final_sign_off_at),
      btrim(p_reason),
      v_actor,
      v_actor,
      now()
    );

    update public.workdays
    set
      status = 'signed_off',
      closed_at = p_final_sign_off_at,
      updated_at = now()
    where id = v_workday_id;
  end if;

  if p_break_minutes is not null then
    insert into public.attendance_corrections(
      workday_id,
      field_name,
      old_value,
      new_value,
      reason,
      requested_by,
      approved_by,
      approved_at
    )
    values(
      v_workday_id,
      'break_minutes',
      to_jsonb(v_old_break),
      to_jsonb(p_break_minutes),
      btrim(p_reason),
      v_actor,
      v_actor,
      now()
    );
  end if;

  insert into public.attendance_events(
    workday_id,
    event_type,
    occurred_at,
    source,
    notes,
    created_by
  )
  values(
    v_workday_id,
    'correction',
    now(),
    'ems-admin',
    btrim(p_reason),
    v_actor
  );

  perform private.recalculate_workday(v_workday_id, now());

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason
  )
  select
    v_actor,
    'attendance_corrected',
    'workday',
    v_workday_id::text,
    v_before,
    to_jsonb(w),
    btrim(p_reason)
  from public.workdays w
  where w.id = v_workday_id;

  return v_workday_id;
end;
$$;

revoke all on function public.attendance_correct_day(
  uuid,date,timestamptz,timestamptz,integer,text
) from public, anon;

grant execute on function public.attendance_correct_day(
  uuid,date,timestamptz,timestamptz,integer,text
) to authenticated;

create or replace function private.phase5_presence_maintenance()
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_settings public.company_settings%rowtype;
  v_row record;
  v_status public.presence_status;
  v_connected boolean;
  v_cutoff timestamptz;
  v_local_today date;
begin
  perform set_config('app.phase4_workflow', 'on', true);
  select * into v_settings from public.company_settings where id = 1;

  for v_row in
    select
      ep.employee_id,
      ep.workday_id,
      ep.status as presence_status,
      ep.last_heartbeat_at,
      ep.last_activity_at,
      ep.tab_connected,
      w.status as workday_status,
      w.work_date,
      p.timezone,
      coalesce(
        ep.last_activity_at,
        ep.last_heartbeat_at,
        w.updated_at,
        w.created_at
      ) as last_seen
    from public.employee_presence ep
    join public.profiles p on p.id = ep.employee_id
    left join public.workdays w on w.id = ep.workday_id
  loop
    v_local_today :=
      (now() at time zone coalesce(nullif(v_row.timezone,''),'Asia/Karachi'))::date;

    v_connected :=
      v_row.last_heartbeat_at is not null
      and v_row.last_heartbeat_at >=
        now() - make_interval(mins => v_settings.heartbeat_stale_minutes);

    if v_row.workday_id is not null
       and v_row.workday_status = 'signed_off'
       and v_row.work_date < v_local_today then
      update public.employee_presence
      set workday_id = null,
          status = 'offline',
          status_changed_at = case
            when status is distinct from 'offline'
              or workday_id is not null
            then now()
            else status_changed_at
          end,
          tab_connected = v_connected,
          updated_at = now()
      where employee_id = v_row.employee_id;

      continue;
    end if;

    v_status := private.effective_presence_status(
      v_row.workday_status,
      v_row.last_heartbeat_at,
      v_row.last_activity_at,
      now(),
      v_settings.presence_idle_minutes,
      v_settings.presence_away_minutes,
      v_settings.heartbeat_stale_minutes
    );

    if v_row.presence_status is distinct from v_status
       or v_row.tab_connected is distinct from v_connected then
      update public.employee_presence
      set status = v_status,
          status_changed_at = case
            when status is distinct from v_status then now() else status_changed_at end,
          tab_connected = v_connected,
          updated_at = now()
      where employee_id = v_row.employee_id;
    end if;

    if v_row.workday_id is not null
       and v_row.workday_status in ('working','on_break','in_meeting') then
      v_cutoff := v_row.last_seen
        + make_interval(mins => v_settings.auto_signoff_idle_minutes);

      if v_cutoff <= now() then
        perform private.auto_signoff_workday(v_row.workday_id, v_cutoff);
      else
        perform private.recalculate_workday(v_row.workday_id, now());
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function private.phase5_presence_maintenance()
from public, anon, authenticated;
