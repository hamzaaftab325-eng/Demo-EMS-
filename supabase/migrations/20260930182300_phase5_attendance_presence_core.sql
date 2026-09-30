-- Phase 5: production attendance and presence.
-- Reuses the Phase 4 workday, interval and presence tables; no duplicate attendance model.

alter table public.workdays
  add column if not exists scheduled_minutes integer not null default 0,
  add column if not exists first_sign_in_at timestamptz,
  add column if not exists final_sign_off_at timestamptz,
  add column if not exists gross_minutes integer not null default 0,
  add column if not exists break_minutes integer not null default 0,
  add column if not exists meeting_minutes integer not null default 0,
  add column if not exists net_work_minutes integer not null default 0,
  add column if not exists late_minutes integer not null default 0,
  add column if not exists early_leave_minutes integer not null default 0,
  add column if not exists overtime_minutes integer not null default 0,
  add column if not exists calculated_at timestamptz;

alter table public.workdays
  drop constraint if exists workdays_attendance_minutes_nonnegative,
  add constraint workdays_attendance_minutes_nonnegative check (
    scheduled_minutes >= 0 and gross_minutes >= 0 and break_minutes >= 0
    and meeting_minutes >= 0 and net_work_minutes >= 0 and late_minutes >= 0
    and early_leave_minutes >= 0 and overtime_minutes >= 0
  );

alter table public.company_settings
  add column if not exists heartbeat_interval_seconds integer not null default 60,
  add column if not exists presence_idle_minutes integer not null default 5,
  add column if not exists presence_away_minutes integer not null default 15,
  add column if not exists heartbeat_stale_minutes integer not null default 3;

alter table public.company_settings
  drop constraint if exists company_settings_presence_thresholds_valid,
  add constraint company_settings_presence_thresholds_valid check (
    heartbeat_interval_seconds between 30 and 300
    and presence_idle_minutes between 1 and 120
    and presence_away_minutes > presence_idle_minutes
    and presence_away_minutes <= 480
    and heartbeat_stale_minutes between 2 and 30
  );

with open_events as (
  select id, employee_id,
    row_number() over (
      partition by employee_id
      order by started_at desc, id desc
    ) as rn
  from public.presence_events
  where ended_at is null
)
update public.presence_events pe
set ended_at = greatest(pe.started_at, now())
from open_events oe
where pe.id = oe.id
  and oe.rn > 1;

create unique index if not exists presence_events_one_open_per_employee
on public.presence_events(employee_id)
where ended_at is null;

create index if not exists workdays_work_date_employee_idx
on public.workdays(work_date, employee_id);

drop policy if exists presence_events_update_own on public.presence_events;
create policy presence_events_update_own
on public.presence_events
for update
to authenticated
using (employee_id = (select private.current_profile_id()))
with check (employee_id = (select private.current_profile_id()));

revoke delete, truncate, references, trigger
on table public.presence_events from authenticated;
grant select, insert, update
on table public.presence_events to authenticated;

drop policy if exists attendance_corrections_insert_super
on public.attendance_corrections;
create policy attendance_corrections_insert_super
on public.attendance_corrections
for insert
to authenticated
with check ((select private.is_super_admin()));

grant insert on table public.attendance_corrections to authenticated;
revoke delete, update, truncate, references, trigger
on table public.attendance_corrections from authenticated;

CREATE OR REPLACE FUNCTION private.effective_presence_status(p_workday_status workday_status, p_last_heartbeat_at timestamp with time zone, p_last_activity_at timestamp with time zone, p_now timestamp with time zone, p_idle_minutes integer, p_away_minutes integer, p_stale_minutes integer)
 RETURNS presence_status
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if p_workday_status is null or p_workday_status = 'not_started' then return 'offline'; end if;
  if p_workday_status = 'signed_off' then return 'workday_ended'; end if;
  if p_workday_status = 'on_break' then return 'on_break'; end if;
  if p_workday_status = 'in_meeting' then return 'in_meeting'; end if;
  if p_last_heartbeat_at is null
     or p_last_heartbeat_at < p_now - make_interval(mins => p_stale_minutes) then
    return 'away';
  end if;
  if p_last_activity_at is null then return 'idle'; end if;
  if p_last_activity_at >= p_now - make_interval(mins => p_idle_minutes) then return 'active'; end if;
  if p_last_activity_at >= p_now - make_interval(mins => p_away_minutes) then return 'idle'; end if;
  return 'away';
end;
$function$;

CREATE OR REPLACE FUNCTION private.sync_presence_event_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if tg_op = 'INSERT'
     or old.status is distinct from new.status
     or old.workday_id is distinct from new.workday_id then
    update public.presence_events
    set ended_at = greatest(started_at, new.status_changed_at)
    where employee_id = new.employee_id and ended_at is null;

    insert into public.presence_events(employee_id, workday_id, status, started_at)
    values(new.employee_id, new.workday_id, new.status, new.status_changed_at);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.recalculate_workday(p_workday_id uuid, p_now timestamp with time zone DEFAULT now())
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_workday public.workdays%rowtype;
  v_profile public.profiles%rowtype;
  v_schedule public.work_schedules%rowtype;
  v_company public.company_settings%rowtype;
  v_raw_first timestamptz;
  v_raw_final timestamptz;
  v_first timestamptz;
  v_final timestamptz;
  v_corr_first timestamptz;
  v_corr_final timestamptz;
  v_corr_break integer;
  v_gross integer := 0;
  v_break integer := 0;
  v_meeting integer := 0;
  v_net integer := 0;
  v_target integer := 0;
  v_late integer := 0;
  v_early integer := 0;
  v_overtime integer := 0;
  v_expected_start timestamptz;
  v_expected_end timestamptz;
  v_grace integer := 0;
  v_attendance public.attendance_status;
  v_is_holiday boolean := false;
  v_is_weekend boolean := false;
  v_local_today date;
begin
  perform set_config('app.phase4_workflow', 'on', true);

  select * into v_workday from public.workdays where id = p_workday_id for update;
  if not found then return; end if;

  select * into v_profile from public.profiles where id = v_workday.employee_id;
  select * into v_company from public.company_settings where id = 1;

  if v_workday.schedule_id is not null then
    select * into v_schedule from public.work_schedules where id = v_workday.schedule_id;
  end if;

  v_target := coalesce(v_schedule.daily_target_minutes, v_company.default_daily_target_minutes, 480);
  v_grace := coalesce(v_schedule.grace_minutes, v_company.grace_period_minutes, 15);
  v_local_today := (p_now at time zone v_workday.timezone)::date;

  select min(ae.occurred_at) into v_raw_first
  from public.attendance_events ae
  where ae.workday_id = p_workday_id and ae.event_type = 'sign_in';

  select max(ae.occurred_at) into v_raw_final
  from public.attendance_events ae
  where ae.workday_id = p_workday_id and ae.event_type in ('sign_off','auto_sign_off');

  select (ac.new_value #>> '{}')::timestamptz into v_corr_first
  from public.attendance_corrections ac
  where ac.workday_id = p_workday_id and ac.field_name = 'first_sign_in_at'
    and ac.approved_at is not null
  order by ac.approved_at desc, ac.created_at desc limit 1;

  select (ac.new_value #>> '{}')::timestamptz into v_corr_final
  from public.attendance_corrections ac
  where ac.workday_id = p_workday_id and ac.field_name = 'final_sign_off_at'
    and ac.approved_at is not null
  order by ac.approved_at desc, ac.created_at desc limit 1;

  select (ac.new_value #>> '{}')::integer into v_corr_break
  from public.attendance_corrections ac
  where ac.workday_id = p_workday_id and ac.field_name = 'break_minutes'
    and ac.approved_at is not null
  order by ac.approved_at desc, ac.created_at desc limit 1;

  v_first := coalesce(v_corr_first, v_raw_first);
  v_final := coalesce(
    v_corr_final,
    case when v_workday.status = 'signed_off'
      then coalesce(v_raw_final, v_workday.closed_at) else null end
  );

  select coalesce(round(sum(
    extract(epoch from (
      coalesce(
        (
          select min(end_event.occurred_at)
          from public.attendance_events end_event
          where end_event.workday_id = start_event.workday_id
            and end_event.event_type in ('sign_off','auto_sign_off')
            and end_event.occurred_at >= start_event.occurred_at
        ),
        case when v_workday.status = 'signed_off'
          then coalesce(v_raw_final, v_workday.closed_at, p_now)
          else p_now end
      ) - start_event.occurred_at
    )) / 60.0
  ))::integer, 0) into v_gross
  from public.attendance_events start_event
  where start_event.workday_id = p_workday_id
    and start_event.event_type in ('sign_in','sign_back_in');

  if v_raw_first is null and v_first is not null then
    v_gross := greatest(
      0, round(extract(epoch from (coalesce(v_final, p_now) - v_first)) / 60.0)::integer
    );
  else
    if v_corr_first is not null and v_raw_first is not null then
      v_gross := greatest(
        0, v_gross + round(extract(epoch from (v_raw_first - v_corr_first)) / 60.0)::integer
      );
    end if;

    if v_corr_final is not null and v_raw_final is not null then
      v_gross := greatest(
        0, v_gross + round(extract(epoch from (v_corr_final - v_raw_final)) / 60.0)::integer
      );
    end if;
  end if;

  select coalesce(round(sum(
    extract(epoch from (coalesce(wi.ended_at, p_now) - wi.started_at)) / 60.0
  ))::integer, 0) into v_break
  from public.work_intervals wi
  where wi.workday_id = p_workday_id and wi.interval_type = 'break';

  if v_corr_break is not null then v_break := greatest(0, v_corr_break); end if;

  select coalesce(round(sum(
    extract(epoch from (coalesce(wi.ended_at, p_now) - wi.started_at)) / 60.0
  ))::integer, 0) into v_meeting
  from public.work_intervals wi
  where wi.workday_id = p_workday_id and wi.interval_type = 'meeting';

  v_net := greatest(0, v_gross - v_break);
  v_overtime := greatest(0, v_net - v_target);

  if v_schedule.schedule_type = 'fixed' and v_schedule.start_time is not null then
    v_expected_start :=
      (v_workday.work_date + v_schedule.start_time)
      at time zone coalesce(v_schedule.timezone, v_workday.timezone);

    if v_schedule.end_time is not null then
      v_expected_end :=
        (
          v_workday.work_date + v_schedule.end_time
          + case when v_schedule.end_time <= v_schedule.start_time
              then interval '1 day' else interval '0 day' end
        ) at time zone coalesce(v_schedule.timezone, v_workday.timezone);
    end if;

  elsif v_schedule.schedule_type = 'flexible_core'
        and v_schedule.core_start_time is not null then
    v_expected_start :=
      (v_workday.work_date + v_schedule.core_start_time)
      at time zone coalesce(v_schedule.timezone, v_workday.timezone);

    if v_schedule.core_end_time is not null then
      v_expected_end :=
        (
          v_workday.work_date + v_schedule.core_end_time
          + case when v_schedule.core_end_time <= v_schedule.core_start_time
              then interval '1 day' else interval '0 day' end
        ) at time zone coalesce(v_schedule.timezone, v_workday.timezone);
    end if;
  end if;

  if v_first is not null and v_expected_start is not null then
    v_late := greatest(
      0,
      floor(extract(epoch from (
        v_first - (v_expected_start + make_interval(mins => v_grace))
      )) / 60.0)::integer
    );
  end if;

  if v_final is not null and v_expected_end is not null then
    v_early := greatest(
      0, floor(extract(epoch from (v_expected_end - v_final)) / 60.0)::integer
    );
  end if;

  v_is_weekend := extract(isodow from v_workday.work_date) in (6,7);

  select exists(
    select 1 from public.holidays h
    where h.holiday_date = v_workday.work_date
      and (h.is_company_wide or h.department_id = v_profile.department_id)
  ) into v_is_holiday;

  if v_is_holiday then
    v_attendance := 'holiday'; v_target := 0;
  elsif v_is_weekend then
    v_attendance := 'weekend'; v_target := 0;
  elsif v_profile.employment_status = 'on_leave' then
    v_attendance := 'on_leave'; v_target := 0;
  elsif v_first is null then
    if v_workday.status = 'signed_off' or v_workday.work_date < v_local_today then
      v_attendance := 'absent';
    else
      v_attendance := null;
    end if;
  elsif v_workday.work_date < v_local_today and v_workday.status <> 'signed_off' then
    v_attendance := 'missing_sign_off';
  elsif v_late > 0 then
    v_attendance := 'late';
  else
    v_attendance := 'present';
  end if;

  update public.workdays
  set scheduled_minutes = greatest(0, v_target),
      first_sign_in_at = v_first,
      final_sign_off_at = v_final,
      gross_minutes = greatest(0, v_gross),
      break_minutes = greatest(0, v_break),
      meeting_minutes = greatest(0, v_meeting),
      net_work_minutes = greatest(0, v_net),
      late_minutes = greatest(0, v_late),
      early_leave_minutes = greatest(0, v_early),
      overtime_minutes = greatest(0, v_overtime),
      attendance_status = v_attendance,
      calculated_at = p_now,
      updated_at = now()
  where id = p_workday_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.recalculate_from_attendance_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform private.recalculate_workday(new.workday_id, now());
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.recalculate_from_interval()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  perform private.recalculate_workday(new.workday_id, now());
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.presence_heartbeat(p_last_activity_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_workday_id uuid;
  v_workday_status public.workday_status;
  v_settings public.company_settings%rowtype;
  v_existing public.employee_presence%rowtype;
  v_activity timestamptz;
  v_status public.presence_status;
  v_now timestamptz := now();
begin
  perform set_config('app.phase4_workflow', 'on', true);

  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then raise exception 'Active EMS profile required.'; end if;

  select coalesce(nullif(p.timezone,''),'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id and p.is_active and p.employment_status <> 'deactivated';

  if v_timezone is null then raise exception 'Active EMS profile required.'; end if;

  v_work_date := (v_now at time zone v_timezone)::date;

  select w.id, w.status into v_workday_id, v_workday_status
  from public.workdays w
  where w.employee_id = v_profile_id and w.work_date = v_work_date
  limit 1;

  select * into v_settings from public.company_settings where id = 1;
  select * into v_existing from public.employee_presence
  where employee_id = v_profile_id for update;

  v_activity := greatest(
    coalesce(v_existing.last_activity_at, '-infinity'::timestamptz),
    least(coalesce(p_last_activity_at, v_now), v_now)
  );
  if v_activity = '-infinity'::timestamptz then v_activity := v_now; end if;

  v_status := private.effective_presence_status(
    v_workday_status, v_now, v_activity, v_now,
    v_settings.presence_idle_minutes,
    v_settings.presence_away_minutes,
    v_settings.heartbeat_stale_minutes
  );

  insert into public.employee_presence(
    employee_id, workday_id, status, last_heartbeat_at, last_activity_at,
    status_changed_at, tab_connected, updated_at
  )
  values(
    v_profile_id, v_workday_id, v_status, v_now, v_activity,
    case
      when v_existing.employee_id is null
        or v_existing.status is distinct from v_status
        or v_existing.workday_id is distinct from v_workday_id
      then v_now else coalesce(v_existing.status_changed_at, v_now)
    end,
    true, v_now
  )
  on conflict (employee_id) do update
    set workday_id = excluded.workday_id,
        status = excluded.status,
        last_heartbeat_at = excluded.last_heartbeat_at,
        last_activity_at = excluded.last_activity_at,
        status_changed_at = excluded.status_changed_at,
        tab_connected = true,
        updated_at = excluded.updated_at;

  if v_workday_id is not null then
    perform private.recalculate_workday(v_workday_id, v_now);
  end if;

  return jsonb_build_object(
    'status', v_status,
    'heartbeat_at', v_now,
    'last_activity_at', v_activity,
    'workday_id', v_workday_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.attendance_correct_day(p_employee_id uuid, p_work_date date, p_first_sign_in_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_final_sign_off_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_break_minutes integer DEFAULT NULL::integer, p_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_actor uuid;
  v_workday_id uuid;
  v_schedule_id uuid;
  v_timezone text;
  v_before jsonb;
  v_old_first timestamptz;
  v_old_final timestamptz;
  v_old_break integer;
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

  if not exists(
    select 1
    from public.profiles p
    where p.id = p_employee_id
      and p.is_active
  ) then
    raise exception 'Employee not found.';
  end if;

  v_actor := (select private.current_profile_id());

  select p.timezone
  into v_timezone
  from public.profiles p
  where p.id = p_employee_id;

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

  insert into public.workdays(
    employee_id,
    work_date,
    schedule_id,
    timezone,
    status
  )
  values(
    p_employee_id,
    p_work_date,
    v_schedule_id,
    coalesce(nullif(v_timezone,''),'Asia/Karachi'),
    (
      case
        when p_final_sign_off_at is not null then 'signed_off'
        else 'working'
      end
    )::public.workday_status
  )
  on conflict (employee_id, work_date) do nothing;

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
$function$;

CREATE OR REPLACE FUNCTION private.auto_signoff_workday(p_workday_id uuid, p_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_workday public.workdays%rowtype;
  v_entry record;
  v_percent integer;
begin
  perform set_config('app.phase4_workflow', 'on', true);

  select * into v_workday from public.workdays where id = p_workday_id for update;
  if not found or v_workday.status = 'signed_off' then return; end if;

  update public.work_intervals
  set status = 'completed',
      ended_at = greatest(started_at, p_at),
      notes = coalesce(notes, 'Auto-closed after inactivity'),
      updated_at = now()
  where workday_id = p_workday_id and status = 'active';

  for v_entry in
    select sei.id, sei.scrum_item_id, sei.starting_percent
    from public.scrum_entry_items sei
    join public.scrum_entries se on se.id = sei.scrum_entry_id
    where se.workday_id = p_workday_id and sei.final_percent is null
  loop
    select coalesce(
      (
        select sip.percent from public.scrum_item_progress sip
        where sip.scrum_entry_item_id = v_entry.id
        order by sip.recorded_at desc, sip.id desc limit 1
      ),
      v_entry.starting_percent
    ) into v_percent;

    update public.scrum_entry_items
    set final_percent = v_percent,
        sign_off_note = coalesce(sign_off_note, 'Auto sign-off after inactivity')
    where id = v_entry.id;

    insert into public.scrum_item_progress(
      scrum_entry_item_id, percent, note, event_type, recorded_by
    )
    values(
      v_entry.id, v_percent, 'Auto sign-off after inactivity',
      'sign_off', v_workday.employee_id
    );

    update public.scrum_items
    set status = case when v_percent = 100 then 'completed' else 'active' end,
        completed_at = case
          when v_percent = 100 then coalesce(completed_at, p_at) else null end,
        updated_at = now()
    where id = v_entry.scrum_item_id;
  end loop;

  update public.scrum_entries
  set status = 'signed_off',
      signed_off_at = coalesce(signed_off_at, p_at),
      updated_at = now()
  where workday_id = p_workday_id and status in ('signed_in','reopened');

  update public.workdays
  set status = 'signed_off', closed_at = p_at, updated_at = now()
  where id = p_workday_id;

  if not exists(
    select 1 from public.attendance_events ae
    where ae.workday_id = p_workday_id and ae.event_type = 'auto_sign_off'
  ) then
    insert into public.attendance_events(
      workday_id, event_type, occurred_at, source, notes, created_by
    )
    values(
      p_workday_id, 'auto_sign_off', p_at, 'system',
      'Auto sign-off after configured inactivity', v_workday.employee_id
    );
  end if;

  insert into public.employee_presence(
    employee_id, workday_id, status, status_changed_at, tab_connected, updated_at
  )
  values(
    v_workday.employee_id, p_workday_id, 'workday_ended', p_at, false, now()
  )
  on conflict (employee_id) do update
    set workday_id = excluded.workday_id,
        status = excluded.status,
        status_changed_at = excluded.status_changed_at,
        tab_connected = false,
        updated_at = excluded.updated_at;

  perform private.recalculate_workday(p_workday_id, p_at);
end;
$function$;

CREATE OR REPLACE FUNCTION private.phase5_presence_maintenance()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_settings public.company_settings%rowtype;
  v_row record;
  v_status public.presence_status;
  v_connected boolean;
  v_cutoff timestamptz;
begin
  perform set_config('app.phase4_workflow', 'on', true);
  select * into v_settings from public.company_settings where id = 1;

  for v_row in
    select ep.employee_id, ep.workday_id,
      ep.status as presence_status,
      ep.last_heartbeat_at, ep.last_activity_at, ep.tab_connected,
      w.status as workday_status,
      coalesce(ep.last_activity_at, ep.last_heartbeat_at, w.updated_at, w.created_at) as last_seen
    from public.employee_presence ep
    left join public.workdays w on w.id = ep.workday_id
  loop
    v_status := private.effective_presence_status(
      v_row.workday_status,
      v_row.last_heartbeat_at,
      v_row.last_activity_at,
      now(),
      v_settings.presence_idle_minutes,
      v_settings.presence_away_minutes,
      v_settings.heartbeat_stale_minutes
    );

    v_connected :=
      v_row.last_heartbeat_at is not null
      and v_row.last_heartbeat_at >=
        now() - make_interval(mins => v_settings.heartbeat_stale_minutes);

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
$function$;

CREATE OR REPLACE FUNCTION private.phase5_daily_attendance_maintenance()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_settings public.company_settings%rowtype;
  v_row public.profiles%rowtype;
  v_day date;
  v_schedule_id uuid;
  v_schedule_minutes integer;
  v_attendance public.attendance_status;
  v_is_holiday boolean;
  v_is_weekend boolean;
begin
  perform set_config('app.phase4_workflow', 'on', true);
  select * into v_settings from public.company_settings where id = 1;

  for v_row in
    select p.* from public.profiles p
    where p.is_active and p.employment_status <> 'deactivated'
      and p.auth_user_id is not null
  loop
    v_day := (now() at time zone v_row.timezone)::date - 1;
    v_schedule_id := null;
    v_schedule_minutes := v_settings.default_daily_target_minutes;

    if exists(
      select 1 from public.workdays w
      where w.employee_id = v_row.id and w.work_date = v_day
    ) then
      continue;
    end if;

    select sa.schedule_id into v_schedule_id
    from public.schedule_assignments sa
    where sa.employee_id = v_row.id
      and sa.effective_from <= v_day
      and (sa.effective_to is null or sa.effective_to >= v_day)
    order by sa.effective_from desc, sa.created_at desc limit 1;

    if v_schedule_id is null then v_schedule_id := v_settings.default_schedule_id; end if;

    select coalesce(ws.daily_target_minutes, v_settings.default_daily_target_minutes)
    into v_schedule_minutes
    from public.work_schedules ws where ws.id = v_schedule_id;

    v_schedule_minutes := coalesce(
      v_schedule_minutes, v_settings.default_daily_target_minutes, 480
    );

    v_is_weekend := extract(isodow from v_day) in (6,7);

    select exists(
      select 1 from public.holidays h
      where h.holiday_date = v_day
        and (h.is_company_wide or h.department_id = v_row.department_id)
    ) into v_is_holiday;

    if v_is_holiday then
      v_attendance := 'holiday'; v_schedule_minutes := 0;
    elsif v_is_weekend then
      v_attendance := 'weekend'; v_schedule_minutes := 0;
    elsif v_row.employment_status = 'on_leave' then
      v_attendance := 'on_leave'; v_schedule_minutes := 0;
    else
      v_attendance := 'absent';
    end if;

    insert into public.workdays(
      employee_id, work_date, schedule_id, timezone, status, attendance_status,
      scheduled_minutes, gross_minutes, break_minutes, meeting_minutes,
      net_work_minutes, late_minutes, early_leave_minutes, overtime_minutes,
      closed_at, calculated_at
    )
    values(
      v_row.id, v_day, v_schedule_id, v_row.timezone,
      'signed_off', v_attendance, v_schedule_minutes,
      0,0,0,0,0,0,0,
      ((v_day + time '23:59:59') at time zone v_row.timezone),
      now()
    )
    on conflict (employee_id, work_date) do nothing;
  end loop;
end;
$function$;

revoke all on function private.effective_presence_status(
  public.workday_status,timestamptz,timestamptz,timestamptz,integer,integer,integer
) from public, anon;
grant execute on function private.effective_presence_status(
  public.workday_status,timestamptz,timestamptz,timestamptz,integer,integer,integer
) to authenticated;

revoke all on function private.sync_presence_event_history()
from public, anon, authenticated;

revoke all on function private.recalculate_workday(uuid,timestamptz)
from public, anon;
grant execute on function private.recalculate_workday(uuid,timestamptz)
to authenticated;

revoke all on function private.recalculate_from_attendance_event()
from public, anon, authenticated;

revoke all on function private.recalculate_from_interval()
from public, anon, authenticated;

revoke all on function public.presence_heartbeat(timestamptz)
from public, anon;
grant execute on function public.presence_heartbeat(timestamptz)
to authenticated;

revoke all on function public.attendance_correct_day(
  uuid,date,timestamptz,timestamptz,integer,text
) from public, anon;
grant execute on function public.attendance_correct_day(
  uuid,date,timestamptz,timestamptz,integer,text
) to authenticated;

revoke all on function private.auto_signoff_workday(uuid,timestamptz)
from public, anon, authenticated;

revoke all on function private.phase5_presence_maintenance()
from public, anon, authenticated;

revoke all on function private.phase5_daily_attendance_maintenance()
from public, anon, authenticated;

drop trigger if exists phase5_guard_presence_events
on public.presence_events;
create trigger phase5_guard_presence_events
before insert or update on public.presence_events
for each row execute function private.require_phase4_workflow();

drop trigger if exists phase5_guard_attendance_corrections
on public.attendance_corrections;
create trigger phase5_guard_attendance_corrections
before insert or update on public.attendance_corrections
for each row execute function private.require_phase4_workflow();

drop trigger if exists phase5_presence_history
on public.employee_presence;
create trigger phase5_presence_history
after insert or update of status, workday_id
on public.employee_presence
for each row execute function private.sync_presence_event_history();

insert into public.presence_events(
  employee_id, workday_id, status, started_at
)
select
  ep.employee_id,
  ep.workday_id,
  ep.status,
  ep.status_changed_at
from public.employee_presence ep
where not exists (
  select 1
  from public.presence_events pe
  where pe.employee_id = ep.employee_id
    and pe.ended_at is null
);

drop trigger if exists phase5_recalculate_attendance_event
on public.attendance_events;
create trigger phase5_recalculate_attendance_event
after insert on public.attendance_events
for each row execute function private.recalculate_from_attendance_event();

drop trigger if exists phase5_recalculate_interval
on public.work_intervals;
create trigger phase5_recalculate_interval
after insert or update of status, started_at, ended_at, interval_type
on public.work_intervals
for each row execute function private.recalculate_from_interval();
