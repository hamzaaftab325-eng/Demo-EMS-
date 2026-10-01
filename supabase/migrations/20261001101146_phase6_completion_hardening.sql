
-- Phase 6 completion hardening:
-- canonical leave/attendance state, schedule consistency, balance enforcement,
-- environment isolation, approval reassignment, and least-privilege grants.

create or replace function private.same_profile_environment(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles target on target.id = target_employee_id
    where me.id = private.current_profile_id()
      and me.is_test_account = target.is_test_account
  )
$$;

create or replace function private.can_access_employee(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with recursive target as (
    select p.is_test_account
    from public.profiles p
    where p.id = target_employee_id
  ),
  manager_chain(manager_id) as (
    select rl.manager_id
    from public.reporting_lines rl
    join public.profiles m on m.id = rl.manager_id
    cross join target t
    where rl.employee_id = target_employee_id
      and rl.is_primary
      and rl.effective_from <= current_date
      and (rl.effective_to is null or rl.effective_to >= current_date)
      and m.is_active
      and m.employment_status <> 'deactivated'
      and m.is_test_account = t.is_test_account

    union

    select rl.manager_id
    from public.reporting_lines rl
    join manager_chain mc on rl.employee_id = mc.manager_id
    join public.profiles m on m.id = rl.manager_id
    cross join target t
    where rl.is_primary
      and rl.effective_from <= current_date
      and (rl.effective_to is null or rl.effective_to >= current_date)
      and m.is_active
      and m.employment_status <> 'deactivated'
      and m.is_test_account = t.is_test_account
  )
  select
    auth.uid() is not null
    and private.same_profile_environment(target_employee_id)
    and (
      target_employee_id = private.current_profile_id()
      or private.is_super_admin()
      or exists (
        select 1
        from manager_chain
        where manager_id = private.current_profile_id()
      )
    )
$$;

create or replace function private.can_manage_employee(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    auth.uid() is not null
    and private.same_profile_environment(target_employee_id)
    and (
      private.is_super_admin()
      or (
        private.current_app_role() in ('manager','director')
        and target_employee_id <> private.current_profile_id()
        and private.can_access_employee(target_employee_id)
      )
    )
$$;

create or replace function private.request_active_manager_id(
  p_employee_id uuid,
  p_on_date date default current_date
)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select rl.manager_id
  from public.reporting_lines rl
  join public.profiles employee on employee.id = p_employee_id
  join public.profiles manager on manager.id = rl.manager_id
  where rl.employee_id = p_employee_id
    and rl.is_primary
    and rl.effective_from <= p_on_date
    and (rl.effective_to is null or rl.effective_to >= p_on_date)
    and manager.is_active
    and manager.employment_status <> 'deactivated'
    and manager.is_test_account = employee.is_test_account
  order by rl.effective_from desc, rl.created_at desc
  limit 1
$$;

create or replace function private.request_valid_manager_approver(
  p_employee_id uuid,
  p_candidate_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with recursive target as (
    select p.id, p.is_test_account
    from public.profiles p
    where p.id = p_employee_id
      and p.is_active
      and p.employment_status <> 'deactivated'
  ),
  candidate as (
    select p.id, p.role, p.is_test_account
    from public.profiles p
    where p.id = p_candidate_id
      and p.is_active
      and p.employment_status <> 'deactivated'
      and p.role in ('manager','director','super_admin')
  ),
  manager_chain(manager_id) as (
    select rl.manager_id
    from public.reporting_lines rl
    join public.profiles m on m.id = rl.manager_id
    cross join target t
    where rl.employee_id = p_employee_id
      and rl.is_primary
      and rl.effective_from <= current_date
      and (rl.effective_to is null or rl.effective_to >= current_date)
      and m.is_active
      and m.employment_status <> 'deactivated'
      and m.is_test_account = t.is_test_account

    union

    select rl.manager_id
    from public.reporting_lines rl
    join manager_chain mc on rl.employee_id = mc.manager_id
    join public.profiles m on m.id = rl.manager_id
    cross join target t
    where rl.is_primary
      and rl.effective_from <= current_date
      and (rl.effective_to is null or rl.effective_to >= current_date)
      and m.is_active
      and m.employment_status <> 'deactivated'
      and m.is_test_account = t.is_test_account
  )
  select exists (
    select 1
    from target t
    join candidate c on c.is_test_account = t.is_test_account
    where c.id <> t.id
      and (
        c.role = 'super_admin'
        or exists (
          select 1 from manager_chain mc where mc.manager_id = c.id
        )
      )
  )
$$;

create or replace function private.request_is_approved_leave_workday(
  p_employee_id uuid,
  p_work_date date
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    extract(isodow from p_work_date) < 6
    and not exists (
      select 1
      from public.holidays h
      join public.profiles p on p.id = p_employee_id
      where h.holiday_date = p_work_date
        and (h.is_company_wide or h.department_id = p.department_id)
    )
    and exists (
      select 1
      from public.requests r
      where r.employee_id = p_employee_id
        and r.request_type = 'leave'
        and r.status = 'approved'
        and r.start_date <= p_work_date
        and r.end_date >= p_work_date
    )
$$;

create or replace function private.request_leave_remaining_days(
  p_employee_id uuid,
  p_leave_type_id uuid,
  p_year_start date
)
returns numeric
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_default numeric;
  v_allocations numeric;
  v_allocation_count integer;
  v_delta numeric;
begin
  select lt.default_annual_days
  into v_default
  from public.leave_types lt
  where lt.id = p_leave_type_id;

  if not found then
    return null;
  end if;

  select
    count(*) filter (where ll.transaction_type = 'allocation'),
    coalesce(sum(ll.days) filter (where ll.transaction_type = 'allocation'), 0),
    coalesce(sum(ll.days) filter (
      where ll.transaction_type in ('approved_leave','adjustment','reversal')
    ), 0)
  into v_allocation_count, v_allocations, v_delta
  from public.leave_ledger ll
  where ll.employee_id = p_employee_id
    and ll.leave_type_id = p_leave_type_id
    and ll.effective_date >= date_trunc('year', p_year_start)::date
    and ll.effective_date < (date_trunc('year', p_year_start) + interval '1 year')::date;

  if v_allocation_count > 0 then
    return v_allocations + v_delta;
  end if;

  if v_default is null then
    return null;
  end if;

  return v_default + v_delta;
end;
$$;

create or replace function private.request_assert_leave_balance(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests%rowtype;
  v_detail public.leave_request_details%rowtype;
  v_year date;
  v_segment_start date;
  v_segment_end date;
  v_requested numeric;
  v_remaining numeric;
begin
  select * into v_request
  from public.requests
  where id = p_request_id;

  if not found or v_request.request_type <> 'leave' then
    raise exception 'Leave request not found.';
  end if;

  select * into v_detail
  from public.leave_request_details
  where request_id = p_request_id;

  if not found then
    raise exception 'Leave details are missing.';
  end if;

  v_year := date_trunc('year', v_request.start_date)::date;

  while v_year <= v_request.end_date loop
    v_segment_start := greatest(v_request.start_date, v_year);
    v_segment_end := least(
      v_request.end_date,
      (v_year + interval '1 year - 1 day')::date
    );

    v_requested := private.request_working_days(
      v_request.employee_id,
      v_segment_start,
      v_segment_end
    );

    v_remaining := private.request_leave_remaining_days(
      v_request.employee_id,
      v_detail.leave_type_id,
      v_year
    );

    if v_remaining is not null and v_requested > v_remaining then
      raise exception
        'Insufficient leave balance for %. Requested % working day(s), remaining %.',
        extract(year from v_year)::integer,
        v_requested,
        greatest(v_remaining, 0);
    end if;

    v_year := (v_year + interval '1 year')::date;
  end loop;
end;
$$;

create unique index if not exists leave_ledger_request_year_effect_unique
  on public.leave_ledger(
    request_id,
    leave_type_id,
    effective_date,
    transaction_type
  )
  where request_id is not null;

create or replace function private.request_sync_approved_leave_workdays(
  p_request_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests%rowtype;
  v_profile public.profiles%rowtype;
  v_day date;
  v_schedule_id uuid;
  v_close_at timestamptz;
begin
  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found or v_request.request_type <> 'leave' then
    raise exception 'Leave request not found.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_request.employee_id;

  if exists (
    select 1
    from public.workdays w
    where w.employee_id = v_request.employee_id
      and w.work_date between v_request.start_date and v_request.end_date
      and (
        w.first_sign_in_at is not null
        or exists (
          select 1
          from public.attendance_events ae
          where ae.workday_id = w.id
            and ae.event_type in ('sign_in','sign_back_in')
        )
      )
  ) then
    raise exception
      'Leave cannot be approved for a date where the employee has already started work.';
  end if;

  for v_day in
    select d::date
    from generate_series(
      v_request.start_date::timestamp,
      v_request.end_date::timestamp,
      interval '1 day'
    ) d
    where extract(isodow from d::date) < 6
      and not exists (
        select 1
        from public.holidays h
        where h.holiday_date = d::date
          and (h.is_company_wide or h.department_id = v_profile.department_id)
      )
  loop
    select sa.schedule_id
    into v_schedule_id
    from public.schedule_assignments sa
    where sa.employee_id = v_request.employee_id
      and sa.effective_from <= v_day
      and (sa.effective_to is null or sa.effective_to >= v_day)
    order by sa.effective_from desc, sa.created_at desc
    limit 1;

    if v_schedule_id is null then
      select cs.default_schedule_id
      into v_schedule_id
      from public.company_settings cs
      where cs.id = 1;
    end if;

    v_close_at := (
      (v_day + time '23:59:59')
      at time zone coalesce(nullif(v_profile.timezone,''),'Asia/Karachi')
    );

    insert into public.workdays as w(
      employee_id,
      work_date,
      schedule_id,
      timezone,
      status,
      attendance_status,
      scheduled_minutes,
      gross_minutes,
      break_minutes,
      meeting_minutes,
      net_work_minutes,
      late_minutes,
      early_leave_minutes,
      overtime_minutes,
      closed_at,
      calculated_at,
      notes
    )
    values(
      v_request.employee_id,
      v_day,
      v_schedule_id,
      coalesce(nullif(v_profile.timezone,''),'Asia/Karachi'),
      'signed_off',
      'on_leave',
      0,
      0,0,0,0,0,0,0,
      v_close_at,
      now(),
      format('Approved leave request #%s', v_request.request_number)
    )
    on conflict (employee_id, work_date) do update
    set
      schedule_id = coalesce(w.schedule_id, excluded.schedule_id),
      status = 'signed_off',
      attendance_status = 'on_leave',
      scheduled_minutes = 0,
      gross_minutes = 0,
      break_minutes = 0,
      meeting_minutes = 0,
      net_work_minutes = 0,
      late_minutes = 0,
      early_leave_minutes = 0,
      overtime_minutes = 0,
      final_sign_off_at = null,
      closed_at = excluded.closed_at,
      calculated_at = now(),
      notes = case
        when w.notes is null or btrim(w.notes) = '' then excluded.notes
        when position(excluded.notes in w.notes) > 0 then w.notes
        else w.notes || ' · ' || excluded.notes
      end,
      updated_at = now()
    where w.first_sign_in_at is null;
  end loop;
end;
$$;

create or replace function private.enforce_approved_leave_workday()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.first_sign_in_at is null
     and private.request_is_approved_leave_workday(
       new.employee_id,
       new.work_date
     ) then
    new.attendance_status := 'on_leave';
    new.scheduled_minutes := 0;
    new.late_minutes := 0;
    new.early_leave_minutes := 0;
    new.overtime_minutes := 0;
  end if;

  return new;
end;
$$;

drop trigger if exists workdays_enforce_approved_leave on public.workdays;
create trigger workdays_enforce_approved_leave
before insert or update on public.workdays
for each row
execute function private.enforce_approved_leave_workday();

create or replace function private.block_signin_on_approved_leave()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_employee_id uuid;
  v_work_date date;
begin
  if new.event_type not in ('sign_in','sign_back_in') then
    return new;
  end if;

  select w.employee_id, w.work_date
  into v_employee_id, v_work_date
  from public.workdays w
  where w.id = new.workday_id;

  if v_employee_id is not null
     and private.request_is_approved_leave_workday(
       v_employee_id,
       v_work_date
     ) then
    raise exception
      'You are on approved leave for this date. Contact an administrator if the leave must be corrected.';
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_events_block_approved_leave on public.attendance_events;
create trigger attendance_events_block_approved_leave
before insert on public.attendance_events
for each row
execute function private.block_signin_on_approved_leave();

create or replace function private.request_apply_schedule_change(
  p_request_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests%rowtype;
  v_detail public.schedule_change_details%rowtype;
  v_cover public.schedule_assignments%rowtype;
  v_schedule_id uuid;
  v_restore_from date;
  v_target_minutes integer;
  v_workday record;
begin
  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  select * into v_detail
  from public.schedule_change_details
  where request_id = p_request_id
  for update;

  if not found then
    raise exception 'Schedule-change details are missing.';
  end if;

  if v_detail.applied_at is not null then
    return;
  end if;

  if exists (
    select 1
    from public.workdays w
    where w.employee_id = v_request.employee_id
      and (
        (v_detail.is_permanent and w.work_date >= v_request.start_date)
        or (
          not v_detail.is_permanent
          and w.work_date between v_request.start_date and v_request.end_date
        )
      )
      and (
        w.first_sign_in_at is not null
        or exists (
          select 1
          from public.attendance_events ae
          where ae.workday_id = w.id
            and ae.event_type in ('sign_in','sign_back_in')
        )
      )
  ) then
    raise exception
      'This schedule change cannot be approved because work has already started on an affected date.';
  end if;

  v_schedule_id := private.request_create_fixed_schedule(p_request_id, p_actor);

  select daily_target_minutes
  into v_target_minutes
  from public.work_schedules
  where id = v_schedule_id;

  if v_detail.is_permanent then
    if exists (
      select 1
      from public.schedule_assignments sa
      where sa.employee_id = v_request.employee_id
        and sa.effective_from > v_request.start_date
    ) then
      raise exception
        'A future schedule assignment already exists. Resolve it before approving this permanent change.';
    end if;

    select * into v_cover
    from public.schedule_assignments sa
    where sa.employee_id = v_request.employee_id
      and sa.effective_from <= v_request.start_date
      and (sa.effective_to is null or sa.effective_to >= v_request.start_date)
    order by sa.effective_from desc, sa.created_at desc
    limit 1
    for update;

    if v_cover.id is not null then
      if v_cover.effective_from < v_request.start_date then
        update public.schedule_assignments
        set effective_to = v_request.start_date - 1
        where id = v_cover.id;
      else
        delete from public.schedule_assignments
        where id = v_cover.id;
      end if;
    end if;

    insert into public.schedule_assignments(
      employee_id,
      schedule_id,
      effective_from,
      effective_to,
      assigned_by
    )
    values (
      v_request.employee_id,
      v_schedule_id,
      v_request.start_date,
      null,
      p_actor
    );

    update public.workdays
    set
      schedule_id = v_schedule_id,
      scheduled_minutes = case
        when attendance_status in ('on_leave','holiday','weekend') then 0
        else coalesce(v_target_minutes, scheduled_minutes)
      end,
      updated_at = now()
    where employee_id = v_request.employee_id
      and work_date >= v_request.start_date
      and first_sign_in_at is null;
  else
    select * into v_cover
    from public.schedule_assignments sa
    where sa.employee_id = v_request.employee_id
      and sa.effective_from <= v_request.start_date
      and (sa.effective_to is null or sa.effective_to >= v_request.end_date)
    order by sa.effective_from desc, sa.created_at desc
    limit 1
    for update;

    if v_cover.id is null then
      raise exception
        'The requested dates are not covered by one current schedule assignment.';
    end if;

    if exists (
      select 1
      from public.schedule_assignments sa
      where sa.employee_id = v_request.employee_id
        and sa.id <> v_cover.id
        and sa.effective_from <= v_request.end_date
        and (sa.effective_to is null or sa.effective_to >= v_request.start_date)
    ) then
      raise exception
        'The requested dates overlap another schedule assignment.';
    end if;

    if v_cover.effective_from < v_request.start_date then
      update public.schedule_assignments
      set effective_to = v_request.start_date - 1
      where id = v_cover.id;
    else
      delete from public.schedule_assignments
      where id = v_cover.id;
    end if;

    insert into public.schedule_assignments(
      employee_id,
      schedule_id,
      effective_from,
      effective_to,
      assigned_by
    )
    values (
      v_request.employee_id,
      v_schedule_id,
      v_request.start_date,
      v_request.end_date,
      p_actor
    );

    v_restore_from := v_request.end_date + 1;

    if v_cover.effective_to is null or v_cover.effective_to >= v_restore_from then
      insert into public.schedule_assignments(
        employee_id,
        schedule_id,
        effective_from,
        effective_to,
        assigned_by
      )
      values (
        v_request.employee_id,
        v_cover.schedule_id,
        v_restore_from,
        v_cover.effective_to,
        p_actor
      );
    end if;

    update public.workdays
    set
      schedule_id = v_schedule_id,
      scheduled_minutes = case
        when attendance_status in ('on_leave','holiday','weekend') then 0
        else coalesce(v_target_minutes, scheduled_minutes)
      end,
      updated_at = now()
    where employee_id = v_request.employee_id
      and work_date between v_request.start_date and v_request.end_date
      and first_sign_in_at is null;
  end if;

  for v_workday in
    select w.id
    from public.workdays w
    where w.employee_id = v_request.employee_id
      and w.first_sign_in_at is null
      and w.attendance_status not in ('on_leave','holiday','weekend')
      and (
        (v_detail.is_permanent and w.work_date >= v_request.start_date)
        or (
          not v_detail.is_permanent
          and w.work_date between v_request.start_date and v_request.end_date
        )
      )
  loop
    perform private.recalculate_workday(v_workday.id, now());
  end loop;

  update public.schedule_change_details
  set applied_at = now()
  where request_id = p_request_id;
end;
$$;

create or replace function private.request_apply_approved(
  p_request_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_request public.requests%rowtype;
  v_leave public.leave_request_details%rowtype;
  v_year date;
  v_segment_start date;
  v_segment_end date;
  v_segment_days numeric;
begin
  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if v_request.status = 'approved' then
    return;
  end if;

  if v_request.status not in ('pending_manager', 'pending_final') then
    raise exception 'Request is no longer awaiting approval.';
  end if;

  if v_request.request_type = 'leave' then
    select * into v_leave
    from public.leave_request_details
    where request_id = p_request_id;

    if not found then
      raise exception 'Leave details are missing.';
    end if;

    perform private.request_assert_leave_balance(v_request.id);
    perform private.request_sync_approved_leave_workdays(v_request.id, p_actor);

    v_year := date_trunc('year', v_request.start_date)::date;

    while v_year <= v_request.end_date loop
      v_segment_start := greatest(v_request.start_date, v_year);
      v_segment_end := least(
        v_request.end_date,
        (v_year + interval '1 year - 1 day')::date
      );

      v_segment_days := private.request_working_days(
        v_request.employee_id,
        v_segment_start,
        v_segment_end
      );

      if v_segment_days > 0 then
        insert into public.leave_ledger(
          employee_id,
          leave_type_id,
          transaction_type,
          days,
          request_id,
          effective_date,
          note,
          created_by
        )
        values(
          v_request.employee_id,
          v_leave.leave_type_id,
          'approved_leave',
          -v_segment_days,
          v_request.id,
          v_segment_start,
          format(
            'Approved request #%s · %s',
            v_request.request_number,
            extract(year from v_year)::integer
          ),
          p_actor
        )
        on conflict (
          request_id,
          leave_type_id,
          effective_date,
          transaction_type
        )
        where request_id is not null
        do nothing;
      end if;

      v_year := (v_year + interval '1 year')::date;
    end loop;
  else
    perform private.request_apply_schedule_change(p_request_id, p_actor);
  end if;

  update public.requests
  set
    status = 'approved',
    current_stage = null,
    completed_at = now(),
    updated_at = now()
  where id = p_request_id;

  -- The workday sync above runs before request status changes so it can
  -- validate safely. Refresh leave rows after the request becomes canonical.
  if v_request.request_type = 'leave' then
    perform private.request_sync_approved_leave_workdays(v_request.id, p_actor);
  end if;

  perform private.request_notify(
    v_request.employee_id,
    'request_approved',
    format('Request #%s approved', v_request.request_number),
    'Your request has completed the approval process.',
    v_request.id
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  )
  values (
    p_actor,
    'request_approved',
    'request',
    v_request.id::text,
    jsonb_build_object(
      'request_number', v_request.request_number,
      'request_type', v_request.request_type,
      'status', 'approved'
    ),
    'Request completed through EMS approval workflow'
  );
end;
$$;

create or replace function public.request_submit_leave(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid;
  v_actor_profile public.profiles%rowtype;
  v_manager uuid;
  v_request_id uuid;
  v_days numeric;
  v_today date;
  v_leave_type public.leave_types%rowtype;
  v_year date;
  v_segment_start date;
  v_segment_end date;
  v_requested numeric;
  v_pending numeric;
  v_remaining numeric;
begin
  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  select * into v_actor_profile
  from public.profiles
  where id = v_actor
  for share;

  v_today := (now() at time zone v_actor_profile.timezone)::date;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Enter a valid request date range.';
  end if;

  if p_start_date < v_today then
    raise exception 'Leave cannot start in the past.';
  end if;

  select * into v_leave_type
  from public.leave_types
  where id = p_leave_type_id
    and is_active;

  if not found then
    raise exception 'Select an active leave type.';
  end if;

  if v_leave_type.requires_reason
     and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for this leave type.';
  end if;

  v_days := private.request_working_days(v_actor, p_start_date, p_end_date);

  if v_days <= 0 then
    raise exception 'The selected range contains no working days.';
  end if;

  if exists (
    select 1
    from public.workdays w
    where w.employee_id = v_actor
      and w.work_date between p_start_date and p_end_date
      and w.first_sign_in_at is not null
  ) then
    raise exception
      'Leave cannot be requested for a date where you have already started work.';
  end if;

  if exists (
    select 1
    from public.requests r
    where r.employee_id = v_actor
      and r.request_type = 'leave'
      and r.status in ('pending_manager', 'pending_final', 'approved')
      and r.start_date <= p_end_date
      and r.end_date >= p_start_date
  ) then
    raise exception 'This leave overlaps another active leave request.';
  end if;

  v_year := date_trunc('year', p_start_date)::date;

  while v_year <= p_end_date loop
    v_segment_start := greatest(p_start_date, v_year);
    v_segment_end := least(
      p_end_date,
      (v_year + interval '1 year - 1 day')::date
    );

    v_requested := private.request_working_days(
      v_actor,
      v_segment_start,
      v_segment_end
    );

    v_remaining := private.request_leave_remaining_days(
      v_actor,
      p_leave_type_id,
      v_year
    );

    if v_remaining is not null then
      select coalesce(sum(
        private.request_working_days(
          v_actor,
          greatest(r.start_date, v_year),
          least(r.end_date, (v_year + interval '1 year - 1 day')::date)
        )
      ), 0)
      into v_pending
      from public.requests r
      join public.leave_request_details lrd on lrd.request_id = r.id
      where r.employee_id = v_actor
        and r.request_type = 'leave'
        and r.status in ('pending_manager','pending_final')
        and lrd.leave_type_id = p_leave_type_id
        and r.start_date < (v_year + interval '1 year')::date
        and r.end_date >= v_year;

      if v_requested + v_pending > v_remaining then
        raise exception
          'Insufficient leave balance for %. Requested % working day(s), % already pending, % remaining.',
          extract(year from v_year)::integer,
          v_requested,
          v_pending,
          greatest(v_remaining, 0);
      end if;
    end if;

    v_year := (v_year + interval '1 year')::date;
  end loop;

  v_manager := private.request_active_manager_id(v_actor, v_today);

  if v_manager is null then
    raise exception 'No active approver is configured for your profile.';
  end if;

  if v_manager = v_actor then
    raise exception 'Self-approval is not allowed.';
  end if;

  insert into public.requests(
    employee_id,
    request_type,
    start_date,
    end_date,
    reason,
    status,
    current_stage,
    submitted_at
  )
  values (
    v_actor,
    'leave',
    p_start_date,
    p_end_date,
    nullif(btrim(coalesce(p_reason, '')), ''),
    'pending_manager',
    'manager',
    now()
  )
  returning id into v_request_id;

  insert into public.leave_request_details(
    request_id,
    leave_type_id,
    days_requested,
    employee_note
  )
  values (
    v_request_id,
    p_leave_type_id,
    v_days,
    nullif(btrim(coalesce(p_reason, '')), '')
  );

  insert into public.request_approvals(
    request_id,
    stage,
    approver_id,
    decision
  )
  values (
    v_request_id,
    'manager',
    v_manager,
    'pending'
  );

  perform private.request_notify(
    v_manager,
    'request_approval_required',
    format(
      'Request #%s needs review',
      (select request_number from public.requests where id = v_request_id)
    ),
    format('%s submitted a leave request.', v_actor_profile.full_name),
    v_request_id
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  )
  values (
    v_actor,
    'request_submitted',
    'request',
    v_request_id::text,
    jsonb_build_object(
      'request_type', 'leave',
      'start_date', p_start_date,
      'end_date', p_end_date,
      'days_requested', v_days
    ),
    'Employee submitted request'
  );

  return v_request_id;
end;
$$;

create or replace function public.request_submit_schedule_change(
  p_request_type public.request_type,
  p_start_date date,
  p_end_date date,
  p_new_start_time time,
  p_new_end_time time,
  p_is_permanent boolean default false,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid;
  v_actor_profile public.profiles%rowtype;
  v_manager uuid;
  v_request_id uuid;
  v_today date;
  v_end_date date;
  v_duration integer;
  v_start_minutes integer;
  v_end_minutes integer;
begin
  v_actor := private.current_profile_id();

  if v_actor is null then
    raise exception 'Active EMS profile required.';
  end if;

  if p_request_type not in ('shift_change', 'hour_change') then
    raise exception 'Invalid schedule request type.';
  end if;

  if p_new_start_time is null or p_new_end_time is null then
    raise exception 'Start and end times are required.';
  end if;

  select * into v_actor_profile
  from public.profiles
  where id = v_actor
  for share;

  v_today := (now() at time zone v_actor_profile.timezone)::date;

  if p_request_type = 'hour_change'
     and p_end_date is not null
     and p_end_date <> p_start_date then
    raise exception 'Hour changes must be for a single date.';
  end if;

  v_end_date := case
    when p_request_type = 'hour_change' then p_start_date
    when p_is_permanent then p_start_date
    else p_end_date
  end;

  if p_start_date is null or v_end_date is null or v_end_date < p_start_date then
    raise exception 'Enter a valid request date range.';
  end if;

  if p_start_date < v_today then
    raise exception 'Schedule changes cannot start in the past.';
  end if;

  if p_request_type = 'hour_change' and p_is_permanent then
    raise exception
      'Hour changes are temporary. Use Shift Change for a permanent schedule change.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'A reason is required for schedule changes.';
  end if;

  if exists (
    select 1
    from public.workdays w
    where w.employee_id = v_actor
      and (
        (p_is_permanent and w.work_date >= p_start_date)
        or (
          not p_is_permanent
          and w.work_date between p_start_date and v_end_date
        )
      )
      and w.first_sign_in_at is not null
  ) then
    raise exception
      'A schedule change cannot include a date where you have already started work.';
  end if;

  v_start_minutes :=
    extract(hour from p_new_start_time)::integer * 60
    + extract(minute from p_new_start_time)::integer;
  v_end_minutes :=
    extract(hour from p_new_end_time)::integer * 60
    + extract(minute from p_new_end_time)::integer;

  v_duration := v_end_minutes - v_start_minutes;
  if v_duration <= 0 then
    v_duration := v_duration + 1440;
  end if;

  if v_duration < 60 or v_duration > 960 then
    raise exception 'Requested work hours must span between 1 and 16 hours.';
  end if;

  if exists (
    select 1
    from public.requests r
    join public.schedule_change_details scd on scd.request_id = r.id
    where r.employee_id = v_actor
      and r.request_type in ('shift_change', 'hour_change')
      and r.status in ('pending_manager', 'pending_final')
      and (
        scd.is_permanent
        or p_is_permanent
        or (r.start_date <= v_end_date and r.end_date >= p_start_date)
      )
  ) then
    raise exception 'Another schedule-change request is already pending.';
  end if;

  if not p_is_permanent
     and not exists (
       select 1
       from public.schedule_assignments sa
       where sa.employee_id = v_actor
         and sa.effective_from <= p_start_date
         and (sa.effective_to is null or sa.effective_to >= v_end_date)
     ) then
    raise exception 'Your current schedule does not cover the requested dates.';
  end if;

  v_manager := private.request_active_manager_id(v_actor, v_today);

  if v_manager is null then
    raise exception 'No active approver is configured for your profile.';
  end if;

  if v_manager = v_actor then
    raise exception 'Self-approval is not allowed.';
  end if;

  insert into public.requests(
    employee_id,
    request_type,
    start_date,
    end_date,
    reason,
    status,
    current_stage,
    submitted_at
  )
  values (
    v_actor,
    p_request_type,
    p_start_date,
    v_end_date,
    btrim(p_reason),
    'pending_manager',
    'manager',
    now()
  )
  returning id into v_request_id;

  insert into public.schedule_change_details(
    request_id,
    new_start_time,
    new_end_time,
    is_permanent
  )
  values (
    v_request_id,
    p_new_start_time,
    p_new_end_time,
    case when p_request_type = 'hour_change' then false else p_is_permanent end
  );

  insert into public.request_approvals(
    request_id,
    stage,
    approver_id,
    decision
  )
  values (
    v_request_id,
    'manager',
    v_manager,
    'pending'
  );

  perform private.request_notify(
    v_manager,
    'request_approval_required',
    format(
      'Request #%s needs review',
      (select request_number from public.requests where id = v_request_id)
    ),
    format(
      '%s submitted a %s request.',
      v_actor_profile.full_name,
      case when p_request_type = 'shift_change'
        then 'shift change'
        else 'hour change'
      end
    ),
    v_request_id
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    after_data,
    reason
  )
  values (
    v_actor,
    'request_submitted',
    'request',
    v_request_id::text,
    jsonb_build_object(
      'request_type', p_request_type,
      'start_date', p_start_date,
      'end_date', v_end_date,
      'new_start_time', p_new_start_time,
      'new_end_time', p_new_end_time,
      'is_permanent',
      case when p_request_type = 'hour_change' then false else p_is_permanent end
    ),
    'Employee submitted request'
  );

  return v_request_id;
end;
$$;

create or replace function public.request_reassign_approver(
  p_request_id uuid,
  p_new_approver_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid;
  v_request public.requests%rowtype;
  v_approval public.request_approvals%rowtype;
  v_new public.profiles%rowtype;
  v_old_name text;
begin
  if not private.is_super_admin() then
    raise exception 'Super Admin access required.';
  end if;

  v_actor := private.current_profile_id();

  select * into v_request
  from public.requests
  where id = p_request_id
  for update;

  if not found
     or not private.same_profile_environment(v_request.employee_id) then
    raise exception 'Request not found.';
  end if;

  if v_request.status not in ('pending_manager','pending_final')
     or v_request.current_stage is null then
    raise exception 'Only pending requests can be reassigned.';
  end if;

  select * into v_approval
  from public.request_approvals
  where request_id = v_request.id
    and stage = v_request.current_stage
    and decision = 'pending'
  for update;

  if not found then
    raise exception 'Pending approval row not found.';
  end if;

  if v_approval.approver_id = p_new_approver_id then
    raise exception 'This approver is already assigned.';
  end if;

  select * into v_new
  from public.profiles
  where id = p_new_approver_id
    and is_active
    and employment_status <> 'deactivated';

  if not found then
    raise exception 'New approver is not active.';
  end if;

  if not private.same_profile_environment(v_new.id) then
    raise exception 'Approver must be in the same EMS environment.';
  end if;

  if v_new.id = v_request.employee_id then
    raise exception 'Self-approval is not allowed.';
  end if;

  if v_request.current_stage = 'manager' then
    if not private.request_valid_manager_approver(
      v_request.employee_id,
      v_new.id
    ) then
      raise exception
        'The selected approver is not in the employee management chain.';
    end if;
  elsif v_new.role <> 'super_admin' then
    raise exception 'Final approval must be assigned to a Super Admin.';
  end if;

  select full_name into v_old_name
  from public.profiles
  where id = v_approval.approver_id;

  update public.request_approvals
  set
    approver_id = v_new.id,
    comment = concat_ws(
      ' · ',
      nullif(comment,''),
      nullif(btrim(coalesce(p_comment,'')),''),
      format('Reassigned from %s', coalesce(v_old_name,'previous approver'))
    ),
    updated_at = now()
  where id = v_approval.id;

  perform private.request_notify(
    v_approval.approver_id,
    'request_reassigned',
    format('Request #%s reassigned', v_request.request_number),
    'This request no longer requires your approval.',
    v_request.id
  );

  perform private.request_notify(
    v_new.id,
    'request_approval_required',
    format('Request #%s needs review', v_request.request_number),
    'A pending request was reassigned to you by a Super Admin.',
    v_request.id
  );

  insert into public.audit_logs(
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    reason
  )
  values (
    v_actor,
    'request_approver_reassigned',
    'request',
    v_request.id::text,
    jsonb_build_object(
      'stage', v_request.current_stage,
      'approver_id', v_approval.approver_id
    ),
    jsonb_build_object(
      'stage', v_request.current_stage,
      'approver_id', v_new.id
    ),
    coalesce(
      nullif(btrim(coalesce(p_comment,'')),''),
      'Approval reassigned by Super Admin'
    )
  );
end;
$$;

-- Least privilege for Phase 6 tables.
revoke all on public.requests from authenticated;
revoke all on public.leave_request_details from authenticated;
revoke all on public.schedule_change_details from authenticated;
revoke all on public.request_approvals from authenticated;
revoke all on public.leave_ledger from authenticated;
revoke all on public.notifications from authenticated;

grant select on public.requests to authenticated;
grant select on public.leave_request_details to authenticated;
grant select on public.schedule_change_details to authenticated;
grant select on public.request_approvals to authenticated;
grant select on public.leave_ledger to authenticated;
grant select on public.notifications to authenticated;
grant update (is_read, read_at) on public.notifications to authenticated;

revoke all on function public.request_reassign_approver(uuid, uuid, text)
  from public, anon;
grant execute on function public.request_reassign_approver(uuid, uuid, text)
  to authenticated;

revoke all on function private.same_profile_environment(uuid)
  from public, anon, authenticated;
revoke all on function private.request_valid_manager_approver(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.request_is_approved_leave_workday(uuid, date)
  from public, anon, authenticated;
revoke all on function private.request_leave_remaining_days(uuid, uuid, date)
  from public, anon, authenticated;
revoke all on function private.request_assert_leave_balance(uuid)
  from public, anon, authenticated;
revoke all on function private.request_sync_approved_leave_workdays(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.enforce_approved_leave_workday()
  from public, anon, authenticated;
revoke all on function private.block_signin_on_approved_leave()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
