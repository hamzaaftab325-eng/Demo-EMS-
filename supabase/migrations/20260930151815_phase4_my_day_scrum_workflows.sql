create unique index if not exists work_intervals_one_active_per_workday
on public.work_intervals(workday_id)
where status = 'active';

CREATE OR REPLACE FUNCTION private.can_manage_employee(target_employee_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select
    (select auth.uid()) is not null
    and (
      (select private.is_super_admin())
      or (
        (select private.current_app_role()) in ('manager','director')
        and target_employee_id <> (select private.current_profile_id())
        and (select private.can_access_employee(target_employee_id))
      )
    )
$function$


CREATE OR REPLACE FUNCTION public.my_day_add_cycle_item(p_project_code text, p_title text, p_starting_percent integer DEFAULT 0, p_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_scrum_id uuid;
  v_item_id uuid;
  v_entry_item_id uuid;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'Task title is required.';
  end if;

  if p_starting_percent < 0 or p_starting_percent > 99 then
    raise exception 'Starting percentage must be between 0 and 99.';
  end if;

  select coalesce(nullif(p.timezone, ''), 'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id;

  v_work_date := (now() at time zone v_timezone)::date;

  select se.id
  into v_scrum_id
  from public.scrum_entries se
  join public.workdays w on w.id = se.workday_id
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
    and w.status in ('working','on_break','in_meeting')
    and se.status in ('signed_in','reopened')
  limit 1;

  if v_scrum_id is null then
    raise exception 'Sign in before adding a task to this scrum cycle.';
  end if;

  insert into public.scrum_items (
    employee_id,
    project_code,
    title,
    description,
    status,
    source,
    created_by
  )
  values (
    v_profile_id,
    nullif(upper(btrim(coalesce(p_project_code, ''))), ''),
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    'active',
    'employee',
    v_profile_id
  )
  returning id into v_item_id;

  insert into public.scrum_entry_items (
    scrum_entry_id,
    scrum_item_id,
    starting_percent
  )
  values (
    v_scrum_id,
    v_item_id,
    p_starting_percent
  )
  returning id into v_entry_item_id;

  insert into public.scrum_item_progress (
    scrum_entry_item_id,
    percent,
    event_type,
    recorded_by
  )
  values (
    v_entry_item_id,
    p_starting_percent,
    'update',
    v_profile_id
  );

  return jsonb_build_object(
    'item_id', v_item_id,
    'entry_item_id', v_entry_item_id
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_add_obstacle(p_description text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_scrum_id uuid;
  v_obstacle_id uuid;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  if btrim(coalesce(p_description, '')) = '' then
    raise exception 'Obstacle description is required.';
  end if;

  select coalesce(nullif(p.timezone, ''), 'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id;

  v_work_date := (now() at time zone v_timezone)::date;

  select se.id
  into v_scrum_id
  from public.scrum_entries se
  join public.workdays w on w.id = se.workday_id
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
    and w.status in ('working','on_break','in_meeting')
    and se.status in ('signed_in','reopened')
  limit 1;

  if v_scrum_id is null then
    raise exception 'Active scrum not found.';
  end if;

  insert into public.scrum_obstacles (
    scrum_entry_id,
    description,
    reported_stage
  )
  values (
    v_scrum_id,
    btrim(p_description),
    'during_day'
  )
  returning id into v_obstacle_id;

  return v_obstacle_id;
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_end_interval()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_workday_id uuid;
  v_interval_id uuid;
  v_interval_type public.interval_type;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  select coalesce(nullif(p.timezone, ''), 'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id;

  v_work_date := (now() at time zone v_timezone)::date;

  select w.id
  into v_workday_id
  from public.workdays w
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
    and w.status in ('on_break','in_meeting')
  for update;

  if v_workday_id is null then
    raise exception 'No active break or meeting found.';
  end if;

  select wi.id, wi.interval_type
  into v_interval_id, v_interval_type
  from public.work_intervals wi
  where wi.workday_id = v_workday_id
    and wi.status = 'active'
  order by wi.started_at desc
  limit 1
  for update;

  if v_interval_id is null then
    raise exception 'No active break or meeting found.';
  end if;

  update public.work_intervals
  set status = 'completed',
      ended_at = now(),
      updated_at = now()
  where id = v_interval_id;

  update public.workdays
  set status = 'working',
      updated_at = now()
  where id = v_workday_id;

  insert into public.employee_presence (
    employee_id, workday_id, status, last_activity_at,
    status_changed_at, tab_connected, updated_at
  )
  values (
    v_profile_id, v_workday_id, 'active', now(),
    now(), true, now()
  )
  on conflict (employee_id) do update
    set workday_id = excluded.workday_id,
        status = excluded.status,
        last_activity_at = excluded.last_activity_at,
        status_changed_at = excluded.status_changed_at,
        tab_connected = excluded.tab_connected,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'interval_id', v_interval_id,
    'interval_type', v_interval_type,
    'ended_at', now()
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_get_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_workday_id uuid;
  v_scrum_id uuid;
  v_prev_scrum_id uuid;
  v_schedule_id uuid;
  v_result jsonb;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  select p.timezone
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id;

  v_timezone := coalesce(nullif(v_timezone, ''), 'Asia/Karachi');
  v_work_date := (now() at time zone v_timezone)::date;

  select w.id, w.schedule_id
  into v_workday_id, v_schedule_id
  from public.workdays w
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
  limit 1;

  if v_schedule_id is null then
    select sa.schedule_id
    into v_schedule_id
    from public.schedule_assignments sa
    where sa.employee_id = v_profile_id
      and sa.effective_from <= v_work_date
      and (sa.effective_to is null or sa.effective_to >= v_work_date)
    order by sa.effective_from desc, sa.created_at desc
    limit 1;
  end if;

  if v_schedule_id is null then
    select cs.default_schedule_id
    into v_schedule_id
    from public.company_settings cs
    where cs.id = 1;
  end if;

  if v_workday_id is not null then
    select se.id
    into v_scrum_id
    from public.scrum_entries se
    where se.workday_id = v_workday_id
    limit 1;
  end if;

  select se.id
  into v_prev_scrum_id
  from public.scrum_entries se
  join public.workdays w on w.id = se.workday_id
  where w.employee_id = v_profile_id
    and w.work_date < v_work_date
    and se.signed_off_at is not null
  order by w.work_date desc, se.signed_off_at desc
  limit 1;

  select jsonb_build_object(
    'work_date', v_work_date,
    'timezone', v_timezone,
    'profile', (
      select jsonb_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'employee_code', p.employee_code,
        'job_title', p.job_title,
        'role', p.role
      )
      from public.profiles p
      where p.id = v_profile_id
    ),
    'settings', (
      select jsonb_build_object(
        'require_scrum_for_signin', cs.require_scrum_for_signin,
        'require_scrum_for_signoff', cs.require_scrum_for_signoff
      )
      from public.company_settings cs
      where cs.id = 1
    ),
    'schedule', (
      select case when ws.id is null then null else jsonb_build_object(
        'id', ws.id,
        'name', ws.name,
        'schedule_type', ws.schedule_type,
        'daily_target_minutes', ws.daily_target_minutes,
        'start_time', ws.start_time,
        'end_time', ws.end_time,
        'core_start_time', ws.core_start_time,
        'core_end_time', ws.core_end_time,
        'timezone', ws.timezone
      ) end
      from (select 1) x
      left join public.work_schedules ws on ws.id = v_schedule_id
    ),
    'workday', (
      select case when w.id is null then null else jsonb_build_object(
        'id', w.id,
        'status', w.status,
        'attendance_status', w.attendance_status,
        'closed_at', w.closed_at,
        'created_at', w.created_at,
        'updated_at', w.updated_at
      ) end
      from (select 1) x
      left join public.workdays w on w.id = v_workday_id
    ),
    'scrum_entry', (
      select case when se.id is null then null else jsonb_build_object(
        'id', se.id,
        'status', se.status,
        'signed_in_at', se.signed_in_at,
        'signed_off_at', se.signed_off_at
      ) end
      from (select 1) x
      left join public.scrum_entries se on se.id = v_scrum_id
    ),
    'current_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'entry_item_id', sei.id,
          'item_id', si.id,
          'project_code', si.project_code,
          'title', si.title,
          'description', si.description,
          'source', si.source,
          'status', si.status,
          'starting_percent', sei.starting_percent,
          'current_percent', coalesce(
            (
              select sip.percent
              from public.scrum_item_progress sip
              where sip.scrum_entry_item_id = sei.id
              order by sip.recorded_at desc, sip.id desc
              limit 1
            ),
            sei.final_percent,
            sei.starting_percent
          ),
          'final_percent', sei.final_percent,
          'sign_off_note', sei.sign_off_note,
          'carried_from_entry_item_id', sei.carried_from_entry_item_id,
          'added_at', sei.added_at
        )
        order by sei.added_at, sei.id
      )
      from public.scrum_entry_items sei
      join public.scrum_items si on si.id = sei.scrum_item_id
      where sei.scrum_entry_id = v_scrum_id
    ), '[]'::jsonb),
    'candidate_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_id', si.id,
          'project_code', si.project_code,
          'title', si.title,
          'description', si.description,
          'source', si.source,
          'status', si.status,
          'current_percent', coalesce(last_item.current_percent, 0),
          'last_entry_item_id', last_item.entry_item_id,
          'origin', case
            when si.status = 'backlog' then 'backlog'
            when last_item.entry_item_id is not null then 'carried_over'
            when si.source = 'manager' then 'manager'
            else 'active'
          end
        )
        order by
          case when si.status = 'active' then 0 else 1 end,
          si.updated_at desc,
          si.created_at desc
      )
      from public.scrum_items si
      left join lateral (
        select
          sei.id as entry_item_id,
          coalesce(
            (
              select sip.percent
              from public.scrum_item_progress sip
              where sip.scrum_entry_item_id = sei.id
              order by sip.recorded_at desc, sip.id desc
              limit 1
            ),
            sei.final_percent,
            sei.starting_percent
          ) as current_percent
        from public.scrum_entry_items sei
        join public.scrum_entries se on se.id = sei.scrum_entry_id
        join public.workdays w on w.id = se.workday_id
        where sei.scrum_item_id = si.id
          and w.employee_id = v_profile_id
        order by w.work_date desc, sei.added_at desc
        limit 1
      ) last_item on true
      where si.employee_id = v_profile_id
        and si.status in ('active','backlog')
        and not exists (
          select 1
          from public.scrum_entry_items current_sei
          where current_sei.scrum_entry_id = v_scrum_id
            and current_sei.scrum_item_id = si.id
        )
    ), '[]'::jsonb),
    'previous_items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'project_code', si.project_code,
          'title', si.title,
          'final_percent', coalesce(
            sei.final_percent,
            (
              select sip.percent
              from public.scrum_item_progress sip
              where sip.scrum_entry_item_id = sei.id
              order by sip.recorded_at desc, sip.id desc
              limit 1
            ),
            sei.starting_percent
          )
        )
        order by sei.added_at
      )
      from public.scrum_entry_items sei
      join public.scrum_items si on si.id = sei.scrum_item_id
      where sei.scrum_entry_id = v_prev_scrum_id
    ), '[]'::jsonb),
    'obstacles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', so.id,
          'description', so.description,
          'reported_stage', so.reported_stage,
          'status', so.status,
          'reported_at', so.reported_at,
          'resolution_note', so.resolution_note
        )
        order by so.reported_at
      )
      from public.scrum_obstacles so
      where so.scrum_entry_id = v_scrum_id
    ), '[]'::jsonb),
    'intervals', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', wi.id,
          'interval_type', wi.interval_type,
          'status', wi.status,
          'started_at', wi.started_at,
          'ended_at', wi.ended_at,
          'notes', wi.notes
        )
        order by wi.started_at
      )
      from public.work_intervals wi
      where wi.workday_id = v_workday_id
    ), '[]'::jsonb),
    'attendance_events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ae.id,
          'event_type', ae.event_type,
          'occurred_at', ae.occurred_at,
          'source', ae.source
        )
        order by ae.occurred_at, ae.id
      )
      from public.attendance_events ae
      where ae.workday_id = v_workday_id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_sign_back_in()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_workday_id uuid;
  v_scrum_id uuid;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  select coalesce(nullif(p.timezone, ''), 'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id;

  v_work_date := (now() at time zone v_timezone)::date;

  select w.id
  into v_workday_id
  from public.workdays w
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
    and w.status = 'signed_off'
  for update;

  if v_workday_id is null then
    raise exception 'Signed-off workday not found.';
  end if;

  select se.id
  into v_scrum_id
  from public.scrum_entries se
  where se.workday_id = v_workday_id
    and se.status = 'signed_off'
  for update;

  if v_scrum_id is null then
    raise exception 'Signed-off scrum not found.';
  end if;

  update public.workdays
  set status = 'working',
      closed_at = null,
      updated_at = now()
  where id = v_workday_id;

  update public.scrum_entries
  set status = 'reopened',
      updated_at = now()
  where id = v_scrum_id;

  insert into public.attendance_events (
    workday_id,
    event_type,
    occurred_at,
    source,
    created_by
  )
  values (
    v_workday_id,
    'sign_back_in',
    now(),
    'ems',
    v_profile_id
  );

  insert into public.employee_presence (
    employee_id, workday_id, status, last_activity_at,
    status_changed_at, tab_connected, updated_at
  )
  values (
    v_profile_id, v_workday_id, 'active', now(),
    now(), true, now()
  )
  on conflict (employee_id) do update
    set workday_id = excluded.workday_id,
        status = excluded.status,
        last_activity_at = excluded.last_activity_at,
        status_changed_at = excluded.status_changed_at,
        tab_connected = excluded.tab_connected,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'workday_id', v_workday_id,
    'scrum_entry_id', v_scrum_id,
    'signed_back_in_at', now()
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_sign_in(p_existing_item_ids uuid[] DEFAULT '{}'::uuid[], p_new_cycle_items jsonb DEFAULT '[]'::jsonb, p_new_backlog_items jsonb DEFAULT '[]'::jsonb, p_obstacle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_schedule_id uuid;
  v_workday_id uuid;
  v_workday_status public.workday_status;
  v_scrum_id uuid;
  v_require_scrum boolean;
  v_selected_id uuid;
  v_entry_item_id uuid;
  v_prev_entry_item_id uuid;
  v_start_percent integer;
  v_item jsonb;
  v_new_item_id uuid;
  v_title text;
  v_project text;
  v_percent integer;
  v_scrum_count integer;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  select p.timezone
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id
    and p.is_active
    and p.employment_status <> 'deactivated';

  if v_timezone is null then
    raise exception 'Active EMS profile required.';
  end if;

  v_timezone := coalesce(nullif(v_timezone, ''), 'Asia/Karachi');
  v_work_date := (now() at time zone v_timezone)::date;

  select sa.schedule_id
  into v_schedule_id
  from public.schedule_assignments sa
  where sa.employee_id = v_profile_id
    and sa.effective_from <= v_work_date
    and (sa.effective_to is null or sa.effective_to >= v_work_date)
  order by sa.effective_from desc, sa.created_at desc
  limit 1;

  if v_schedule_id is null then
    select cs.default_schedule_id
    into v_schedule_id
    from public.company_settings cs
    where cs.id = 1;
  end if;

  insert into public.workdays (
    employee_id, work_date, schedule_id, timezone, status
  )
  values (
    v_profile_id, v_work_date, v_schedule_id, v_timezone, 'not_started'
  )
  on conflict (employee_id, work_date) do nothing;

  select w.id, w.status
  into v_workday_id, v_workday_status
  from public.workdays w
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
  for update;

  if v_workday_status = 'signed_off' then
    raise exception 'Workday is signed off. Use Sign back in.';
  end if;

  if v_workday_status <> 'not_started' then
    raise exception 'You are already signed in.';
  end if;

  insert into public.scrum_entries (
    workday_id, status, signed_in_at
  )
  values (
    v_workday_id, 'signed_in', now()
  )
  on conflict (workday_id) do update
    set status = 'signed_in',
        signed_in_at = coalesce(public.scrum_entries.signed_in_at, excluded.signed_in_at),
        updated_at = now()
  returning id into v_scrum_id;

  if coalesce(array_length(p_existing_item_ids, 1), 0) > 0 then
    if exists (
      select 1
      from (
        select distinct unnest(p_existing_item_ids) as id
      ) selected
      left join public.scrum_items si on si.id = selected.id
      where si.id is null
         or si.employee_id <> v_profile_id
         or si.status not in ('active','backlog')
    ) then
      raise exception 'One or more selected scrum items are invalid.';
    end if;
  end if;

  for v_selected_id in
    select distinct unnest(coalesce(p_existing_item_ids, '{}'::uuid[]))
  loop
    v_prev_entry_item_id := null;
    v_start_percent := 0;

    select
      sei.id,
      coalesce(
        (
          select sip.percent
          from public.scrum_item_progress sip
          where sip.scrum_entry_item_id = sei.id
          order by sip.recorded_at desc, sip.id desc
          limit 1
        ),
        sei.final_percent,
        sei.starting_percent
      )
    into v_prev_entry_item_id, v_start_percent
    from public.scrum_entry_items sei
    join public.scrum_entries se on se.id = sei.scrum_entry_id
    join public.workdays w on w.id = se.workday_id
    where sei.scrum_item_id = v_selected_id
      and w.employee_id = v_profile_id
      and w.work_date < v_work_date
    order by w.work_date desc, sei.added_at desc
    limit 1;

    v_start_percent := coalesce(v_start_percent, 0);

    insert into public.scrum_entry_items (
      scrum_entry_id,
      scrum_item_id,
      starting_percent,
      carried_from_entry_item_id
    )
    values (
      v_scrum_id,
      v_selected_id,
      v_start_percent,
      v_prev_entry_item_id
    )
    returning id into v_entry_item_id;

    insert into public.scrum_item_progress (
      scrum_entry_item_id,
      percent,
      event_type,
      recorded_by
    )
    values (
      v_entry_item_id,
      v_start_percent,
      'sign_in',
      v_profile_id
    );

    update public.scrum_items
    set status = 'active',
        updated_at = now()
    where id = v_selected_id;
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_new_cycle_items, '[]'::jsonb))
  loop
    v_title := btrim(coalesce(v_item->>'title', ''));
    v_project := nullif(upper(btrim(coalesce(v_item->>'project_code', ''))), '');

    if v_title = '' then
      raise exception 'Every scrum item needs a title.';
    end if;

    begin
      v_percent := coalesce((v_item->>'percent')::integer, 0);
    exception when invalid_text_representation then
      raise exception 'Scrum percentage must be a number.';
    end;

    if v_percent < 0 or v_percent > 99 then
      raise exception 'Starting percentage must be between 0 and 99.';
    end if;

    insert into public.scrum_items (
      employee_id,
      project_code,
      title,
      description,
      status,
      source,
      created_by
    )
    values (
      v_profile_id,
      v_project,
      v_title,
      nullif(btrim(coalesce(v_item->>'description', '')), ''),
      'active',
      'employee',
      v_profile_id
    )
    returning id into v_new_item_id;

    insert into public.scrum_entry_items (
      scrum_entry_id,
      scrum_item_id,
      starting_percent
    )
    values (
      v_scrum_id,
      v_new_item_id,
      v_percent
    )
    returning id into v_entry_item_id;

    insert into public.scrum_item_progress (
      scrum_entry_item_id,
      percent,
      event_type,
      recorded_by
    )
    values (
      v_entry_item_id,
      v_percent,
      'sign_in',
      v_profile_id
    );
  end loop;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_new_backlog_items, '[]'::jsonb))
  loop
    v_title := btrim(coalesce(v_item->>'title', ''));
    v_project := nullif(upper(btrim(coalesce(v_item->>'project_code', ''))), '');

    if v_title = '' then
      raise exception 'Every backlog item needs a title.';
    end if;

    insert into public.scrum_items (
      employee_id,
      project_code,
      title,
      description,
      status,
      source,
      created_by
    )
    values (
      v_profile_id,
      v_project,
      v_title,
      nullif(btrim(coalesce(v_item->>'description', '')), ''),
      'backlog',
      'backlog',
      v_profile_id
    );
  end loop;

  select cs.require_scrum_for_signin
  into v_require_scrum
  from public.company_settings cs
  where cs.id = 1;

  select count(*)
  into v_scrum_count
  from public.scrum_entry_items sei
  where sei.scrum_entry_id = v_scrum_id;

  if coalesce(v_require_scrum, true) and v_scrum_count = 0 then
    raise exception 'Add at least one scrum item before signing in.';
  end if;

  if nullif(btrim(coalesce(p_obstacle, '')), '') is not null then
    insert into public.scrum_obstacles (
      scrum_entry_id,
      description,
      reported_stage
    )
    values (
      v_scrum_id,
      btrim(p_obstacle),
      'sign_in'
    );
  end if;

  update public.workdays
  set status = 'working',
      closed_at = null,
      updated_at = now()
  where id = v_workday_id;

  insert into public.attendance_events (
    workday_id,
    event_type,
    occurred_at,
    source,
    created_by
  )
  values (
    v_workday_id,
    'sign_in',
    now(),
    'ems',
    v_profile_id
  );

  insert into public.employee_presence (
    employee_id,
    workday_id,
    status,
    last_activity_at,
    status_changed_at,
    tab_connected,
    updated_at
  )
  values (
    v_profile_id,
    v_workday_id,
    'active',
    now(),
    now(),
    true,
    now()
  )
  on conflict (employee_id) do update
    set workday_id = excluded.workday_id,
        status = excluded.status,
        last_activity_at = excluded.last_activity_at,
        status_changed_at = excluded.status_changed_at,
        tab_connected = excluded.tab_connected,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'workday_id', v_workday_id,
    'scrum_entry_id', v_scrum_id,
    'work_date', v_work_date,
    'signed_in_at', now()
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_sign_off(p_items jsonb DEFAULT '[]'::jsonb, p_obstacle text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_workday_id uuid;
  v_scrum_id uuid;
  v_workday_status public.workday_status;
  v_require_scrum boolean;
  v_expected_count integer;
  v_payload_count integer;
  v_entry record;
  v_payload jsonb;
  v_percent integer;
  v_note text;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  select coalesce(nullif(p.timezone, ''), 'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id;

  v_work_date := (now() at time zone v_timezone)::date;

  select w.id, w.status
  into v_workday_id, v_workday_status
  from public.workdays w
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
  for update;

  if v_workday_id is null
     or v_workday_status not in ('working','on_break','in_meeting') then
    raise exception 'Active workday not found.';
  end if;

  select se.id
  into v_scrum_id
  from public.scrum_entries se
  where se.workday_id = v_workday_id
    and se.status in ('signed_in','reopened')
  for update;

  if v_scrum_id is null then
    raise exception 'Active scrum not found.';
  end if;

  select cs.require_scrum_for_signoff
  into v_require_scrum
  from public.company_settings cs
  where cs.id = 1;

  select count(*)
  into v_expected_count
  from public.scrum_entry_items sei
  where sei.scrum_entry_id = v_scrum_id;

  select count(*)
  into v_payload_count
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb));

  if coalesce(v_require_scrum, true)
     and v_expected_count > 0
     and v_payload_count <> v_expected_count then
    raise exception 'Provide a final percentage for every scrum item.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) payload
    where not exists (
      select 1
      from public.scrum_entry_items sei
      where sei.scrum_entry_id = v_scrum_id
        and sei.id = (payload->>'entry_item_id')::uuid
    )
  ) then
    raise exception 'One or more sign-off items are invalid.';
  end if;

  for v_entry in
    select sei.id, sei.scrum_item_id, sei.starting_percent
    from public.scrum_entry_items sei
    where sei.scrum_entry_id = v_scrum_id
    order by sei.added_at, sei.id
  loop
    select value
    into v_payload
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
    where value->>'entry_item_id' = v_entry.id::text
    limit 1;

    if v_payload is null then
      if coalesce(v_require_scrum, true) then
        raise exception 'Provide a final percentage for every scrum item.';
      end if;

      select coalesce(
        (
          select sip.percent
          from public.scrum_item_progress sip
          where sip.scrum_entry_item_id = v_entry.id
          order by sip.recorded_at desc, sip.id desc
          limit 1
        ),
        v_entry.starting_percent
      )
      into v_percent;

      v_note := null;
    else
      begin
        v_percent := (v_payload->>'percent')::integer;
      exception when invalid_text_representation or null_value_not_allowed then
        raise exception 'Final percentage must be a number.';
      end;

      v_note := nullif(btrim(coalesce(v_payload->>'note', '')), '');
    end if;

    if v_percent < 0 or v_percent > 100 then
      raise exception 'Final percentage must be between 0 and 100.';
    end if;

    update public.scrum_entry_items
    set final_percent = v_percent,
        sign_off_note = v_note
    where id = v_entry.id;

    insert into public.scrum_item_progress (
      scrum_entry_item_id,
      percent,
      note,
      event_type,
      recorded_by
    )
    values (
      v_entry.id,
      v_percent,
      v_note,
      'sign_off',
      v_profile_id
    );

    if v_percent = 100 then
      update public.scrum_items
      set status = 'completed',
          completed_at = coalesce(completed_at, now()),
          updated_at = now()
      where id = v_entry.scrum_item_id;
    else
      update public.scrum_items
      set status = 'active',
          completed_at = null,
          updated_at = now()
      where id = v_entry.scrum_item_id;
    end if;
  end loop;

  if nullif(btrim(coalesce(p_obstacle, '')), '') is not null then
    insert into public.scrum_obstacles (
      scrum_entry_id,
      description,
      reported_stage
    )
    values (
      v_scrum_id,
      btrim(p_obstacle),
      'sign_off'
    );
  end if;

  update public.work_intervals
  set status = 'completed',
      ended_at = now(),
      notes = coalesce(notes, 'Auto-closed at sign off'),
      updated_at = now()
  where workday_id = v_workday_id
    and status = 'active';

  update public.scrum_entries
  set status = 'signed_off',
      signed_off_at = now(),
      updated_at = now()
  where id = v_scrum_id;

  update public.workdays
  set status = 'signed_off',
      closed_at = now(),
      updated_at = now()
  where id = v_workday_id;

  insert into public.attendance_events (
    workday_id,
    event_type,
    occurred_at,
    source,
    created_by
  )
  values (
    v_workday_id,
    'sign_off',
    now(),
    'ems',
    v_profile_id
  );

  insert into public.employee_presence (
    employee_id, workday_id, status, last_activity_at,
    status_changed_at, tab_connected, updated_at
  )
  values (
    v_profile_id, v_workday_id, 'workday_ended', now(),
    now(), true, now()
  )
  on conflict (employee_id) do update
    set workday_id = excluded.workday_id,
        status = excluded.status,
        last_activity_at = excluded.last_activity_at,
        status_changed_at = excluded.status_changed_at,
        tab_connected = excluded.tab_connected,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'workday_id', v_workday_id,
    'scrum_entry_id', v_scrum_id,
    'signed_off_at', now()
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_start_interval(p_interval_type interval_type, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_timezone text;
  v_work_date date;
  v_workday_id uuid;
  v_status public.workday_status;
  v_interval_id uuid;
  v_presence public.presence_status;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  select coalesce(nullif(p.timezone, ''), 'Asia/Karachi')
  into v_timezone
  from public.profiles p
  where p.id = v_profile_id;

  v_work_date := (now() at time zone v_timezone)::date;

  select w.id, w.status
  into v_workday_id, v_status
  from public.workdays w
  where w.employee_id = v_profile_id
    and w.work_date = v_work_date
  for update;

  if v_workday_id is null or v_status <> 'working' then
    raise exception 'You must be actively working before starting a break or meeting.';
  end if;

  if exists (
    select 1 from public.work_intervals wi
    where wi.workday_id = v_workday_id
      and wi.status = 'active'
  ) then
    raise exception 'Another break or meeting is already active.';
  end if;

  insert into public.work_intervals (
    workday_id,
    interval_type,
    status,
    started_at,
    notes
  )
  values (
    v_workday_id,
    p_interval_type,
    'active',
    now(),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning id into v_interval_id;

  if p_interval_type = 'break' then
    update public.workdays
    set status = 'on_break', updated_at = now()
    where id = v_workday_id;
    v_presence := 'on_break';
  else
    update public.workdays
    set status = 'in_meeting', updated_at = now()
    where id = v_workday_id;
    v_presence := 'in_meeting';
  end if;

  insert into public.employee_presence (
    employee_id, workday_id, status, last_activity_at,
    status_changed_at, tab_connected, updated_at
  )
  values (
    v_profile_id, v_workday_id, v_presence, now(),
    now(), true, now()
  )
  on conflict (employee_id) do update
    set workday_id = excluded.workday_id,
        status = excluded.status,
        last_activity_at = excluded.last_activity_at,
        status_changed_at = excluded.status_changed_at,
        tab_connected = excluded.tab_connected,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'interval_id', v_interval_id,
    'interval_type', p_interval_type,
    'started_at', now()
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.my_day_update_progress(p_entry_item_id uuid, p_percent integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_profile_id uuid;
  v_item_id uuid;
begin
  v_profile_id := (select private.current_profile_id());
  if v_profile_id is null then
    raise exception 'Active EMS profile required.';
  end if;

  if p_percent < 0 or p_percent > 100 then
    raise exception 'Progress must be between 0 and 100.';
  end if;

  select sei.scrum_item_id
  into v_item_id
  from public.scrum_entry_items sei
  join public.scrum_entries se on se.id = sei.scrum_entry_id
  join public.workdays w on w.id = se.workday_id
  where sei.id = p_entry_item_id
    and w.employee_id = v_profile_id
    and w.status in ('working','on_break','in_meeting')
    and se.status in ('signed_in','reopened')
  limit 1;

  if v_item_id is null then
    raise exception 'Active scrum item not found.';
  end if;

  insert into public.scrum_item_progress (
    scrum_entry_item_id,
    percent,
    note,
    event_type,
    recorded_by
  )
  values (
    p_entry_item_id,
    p_percent,
    nullif(btrim(coalesce(p_note, '')), ''),
    'update',
    v_profile_id
  );

  update public.scrum_items
  set updated_at = now()
  where id = v_item_id;

  return jsonb_build_object(
    'entry_item_id', p_entry_item_id,
    'percent', p_percent,
    'recorded_at', now()
  );
end;
$function$


revoke all on function private.can_manage_employee(uuid) from public, anon;
grant execute on function private.can_manage_employee(uuid) to authenticated;

revoke all on function public.my_day_get_state() from public, anon;
grant execute on function public.my_day_get_state() to authenticated;

revoke all on function public.my_day_sign_in(uuid[],jsonb,jsonb,text) from public, anon;
grant execute on function public.my_day_sign_in(uuid[],jsonb,jsonb,text) to authenticated;

revoke all on function public.my_day_update_progress(uuid,integer,text) from public, anon;
grant execute on function public.my_day_update_progress(uuid,integer,text) to authenticated;

revoke all on function public.my_day_add_cycle_item(text,text,integer,text) from public, anon;
grant execute on function public.my_day_add_cycle_item(text,text,integer,text) to authenticated;

revoke all on function public.my_day_add_obstacle(text) from public, anon;
grant execute on function public.my_day_add_obstacle(text) to authenticated;

revoke all on function public.my_day_start_interval(public.interval_type,text) from public, anon;
grant execute on function public.my_day_start_interval(public.interval_type,text) to authenticated;

revoke all on function public.my_day_end_interval() from public, anon;
grant execute on function public.my_day_end_interval() to authenticated;

revoke all on function public.my_day_sign_off(jsonb,text) from public, anon;
grant execute on function public.my_day_sign_off(jsonb,text) to authenticated;

revoke all on function public.my_day_sign_back_in() from public, anon;
grant execute on function public.my_day_sign_back_in() to authenticated;

revoke delete, truncate, references, trigger on table public.workdays from authenticated;
revoke delete, update, truncate, references, trigger on table public.attendance_events from authenticated;
revoke delete, truncate, references, trigger on table public.work_intervals from authenticated;
revoke delete, truncate, references, trigger on table public.scrum_entries from authenticated;
revoke delete, truncate, references, trigger on table public.scrum_items from authenticated;
revoke delete, truncate, references, trigger on table public.scrum_entry_items from authenticated;
revoke delete, update, truncate, references, trigger on table public.scrum_item_progress from authenticated;
revoke delete, truncate, references, trigger on table public.scrum_obstacles from authenticated;
revoke delete, truncate, references, trigger on table public.employee_presence from authenticated;
